/**
 * zalo-reconnect-cron.ts — Tự động kết nối lại nick bị 'disconnected'.
 *
 * Vấn đề: khi WebSocket Zalo rớt bất thường (vd code 1006), nick chuyển sang
 * status='disconnected' và TRƯỚC ĐÂY không có gì tự nối lại (reconnect lúc boot
 * bỏ qua disconnected; không có cron). → nick kẹt offline tới khi bấm tay.
 *
 * Cron này (mỗi 2 phút) quét account disconnected CÒN sessionData và thử
 * reconnect, có **exponential backoff** để không spam phiên đã chết:
 *   lần 1 ngay, rồi 2,4,8,16,30,30… phút (cap 30'), tối đa MAX_ATTEMPTS lần
 *   thì ngừng (coi như session chết → cần quét QR lại).
 * Reset backoff khi nick connected trở lại.
 */
import cron from 'node-cron';
import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import { zaloPool } from './zalo-pool.js';

const CRON_SCHEDULE = '*/2 * * * *'; // mỗi 2 phút
const BASE_MS = 60_000; // 1 phút
const MAX_BACKOFF_MS = 30 * 60_000; // cap 30 phút
const MAX_ATTEMPTS = 8; // sau 8 lần thất bại → ngừng tự thử (cần QR)

interface BackoffState {
  attempts: number;
  nextAt: number; // epoch ms — thời điểm sớm nhất được thử lại
}
const backoff = new Map<string, BackoffState>();
let cronTask: ReturnType<typeof cron.schedule> | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const accounts = await prisma.zaloAccount.findMany({
      where: {
        archivedAt: null,
        sessionData: { not: Prisma.JsonNull },
      },
      select: { id: true, sessionData: true, proxyUrl: true, status: true },
    });

    const now = Date.now();
    for (const acc of accounts) {
      // Live status (ưu tiên pool) — connected thì reset backoff, bỏ qua.
      const live = zaloPool.getStatus(acc.id) ?? acc.status;
      if (live === 'connected') {
        backoff.delete(acc.id);
        continue;
      }
      // Chỉ tự nối lại nick disconnected (không đụng qr_pending/connecting…).
      if (live !== 'disconnected') continue;

      const session = acc.sessionData as
        | { cookie: unknown; imei: string; userAgent: string }
        | null;
      if (!session?.imei) continue; // không có phiên → phải quét QR, bỏ qua

      const st = backoff.get(acc.id) ?? { attempts: 0, nextAt: 0 };
      if (st.attempts >= MAX_ATTEMPTS) continue; // đã thử đủ → ngừng
      if (now < st.nextAt) continue; // chưa tới hạn backoff

      st.attempts += 1;
      const delay = Math.min(BASE_MS * 2 ** (st.attempts - 1), MAX_BACKOFF_MS);
      st.nextAt = now + delay;
      backoff.set(acc.id, st);

      logger.info(
        `[zalo-reconnect-cron] Thử reconnect ${acc.id} (lần ${st.attempts}/${MAX_ATTEMPTS})`,
      );
      zaloPool
        .reconnect(acc.id, session as never, acc.proxyUrl)
        .then(() => {
          // Thành công → listener sẽ set status=connected; reset ở tick sau.
          backoff.delete(acc.id);
        })
        .catch((err) => {
          logger.warn(
            `[zalo-reconnect-cron] reconnect ${acc.id} thất bại (lần ${st.attempts}): ${String(err)}`,
          );
        });
    }
  } catch (err) {
    logger.error('[zalo-reconnect-cron] tick error:', err);
  } finally {
    running = false;
  }
}

export function startZaloReconnectCron(): void {
  if (cronTask) {
    logger.info('[zalo-reconnect-cron] Already started, skipping');
    return;
  }
  cronTask = cron.schedule(CRON_SCHEDULE, () => void tick());
  logger.info(`[zalo-reconnect-cron] Started, schedule="${CRON_SCHEDULE}"`);
}

export function stopZaloReconnectCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
  backoff.clear();
}
