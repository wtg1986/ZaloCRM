/**
 * agent-autopilot.ts — Máy trạng thái tiếp quản hội thoại của AI Agent.
 *
 * Luồng:
 *  1. Khách nhắn (tin non-self) vào hội thoại đã đính agent (armed/active)
 *     → onInboundCustomerMessage(): hẹn giờ takeoverDelaySec (mặc định 10s).
 *     Khách nhắn dồn dập → reset timer (gộp, trả lời 1 lần đủ ngữ cảnh).
 *  2. Hết giờ mà KHÔNG có người thật trả lời → fire(): qua guardrails → AI gửi.
 *  3. Người thật nhắn vào (qua CRM hoặc điện thoại) → onHumanIntervention():
 *     paused, huỷ timer. Ở trạng thái paused tới khi người dùng bật lại tay.
 *
 * Timer in-memory (Map). Restart server: hội thoại armed vẫn còn trong DB; tin
 * khách kế tiếp sẽ kích hoạt lại timer. Đủ an toàn vì cửa sổ chờ chỉ ~10s.
 *
 * Lazy default-agent: nick có defaultAiAgentId → tin đầu của hội thoại "off" sẽ
 * tự đính agent mặc định (không cần hook lúc tạo conversation).
 */
import type { Server } from 'socket.io';
import { prisma } from '../../../shared/database/prisma-client.js';
import { logger } from '../../../shared/utils/logger.js';
import { getAiConfig } from '../ai-service.js';
import {
  generateAgentReply,
  sendAgentText,
  emitAiState,
} from './agent-service.js';

const timers = new Map<string, NodeJS.Timeout>();

// msgId các tin AI vừa gửi (TTL) — để listener bỏ qua "echo" self của chính agent,
// không nhầm thành "người thật xen vào".
const agentMsgIds = new Map<string, number>();
const ECHO_TTL_MS = 90_000;

export function noteAgentSentMsgId(zaloMsgId: string | null | undefined) {
  if (!zaloMsgId) return;
  agentMsgIds.set(zaloMsgId, Date.now());
}
export function isAgentEcho(zaloMsgId: string | null | undefined): boolean {
  if (!zaloMsgId) return false;
  const t = agentMsgIds.get(zaloMsgId);
  if (!t) return false;
  if (Date.now() - t > ECHO_TTL_MS) {
    agentMsgIds.delete(zaloMsgId);
    return false;
  }
  return true;
}
// Dọn map định kỳ.
setInterval(() => {
  const now = Date.now();
  for (const [k, t] of agentMsgIds) if (now - t > ECHO_TTL_MS) agentMsgIds.delete(k);
}, 60_000).unref?.();

type ConvWithAgent = Awaited<ReturnType<typeof loadConv>>;

function loadConv(conversationId: string) {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { aiAgent: true, zaloAccount: true, contact: true },
  });
}

function cancelTimer(conversationId: string) {
  const t = timers.get(conversationId);
  if (t) {
    clearTimeout(t);
    timers.delete(conversationId);
  }
}

/** Tin khách (non-self) đến → quyết định lazy-attach + lên lịch tiếp quản. */
export async function onInboundCustomerMessage(conversationId: string, io?: Server | null) {
  try {
    let conv = await loadConv(conversationId);
    if (!conv) return;

    // Lazy default-agent: hội thoại chưa đính + nick có agent mặc định → đính.
    if (conv.aiState === 'off' && !conv.aiAgentId && conv.zaloAccount?.defaultAiAgentId) {
      const def = await prisma.aiAgent.findFirst({
        where: { id: conv.zaloAccount.defaultAiAgentId, orgId: conv.orgId, enabled: true },
      });
      const isGroup = conv.threadType === 'group';
      if (def && (!isGroup || def.handleGroups)) {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { aiAgentId: def.id, aiState: 'armed', aiAutoReplyCount: 0, aiPausedReason: null },
        });
        conv = await loadConv(conversationId);
      }
    }

    if (!conv || !conv.aiAgent || !conv.aiAgent.enabled) return;
    if (conv.aiState !== 'armed' && conv.aiState !== 'active') return; // paused/off → bỏ qua
    // Phạm vi nhóm theo từng agent.
    if (conv.threadType === 'group' && !conv.aiAgent.handleGroups) return;

    const delayMs = Math.max(500, (conv.aiAgent.takeoverDelaySec ?? 10) * 1000);
    cancelTimer(conversationId);
    const t = setTimeout(() => {
      void fire(conversationId, io).catch((e) => logger.error('[agent] fire error:', e));
    }, delayMs);
    t.unref?.();
    timers.set(conversationId, t);
  } catch (err) {
    logger.error('[agent] onInboundCustomerMessage error:', err);
  }
}

/** Người thật xen vào (gửi tin) → tắt AI (paused) tới khi bật tay. */
export async function onHumanIntervention(conversationId: string, io?: Server | null) {
  try {
    cancelTimer(conversationId);
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { aiAgent: true },
    });
    if (!conv || !conv.aiAgentId) return;
    if (conv.aiState !== 'armed' && conv.aiState !== 'active') return;
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { aiState: 'paused', aiPausedReason: 'human' },
      include: { aiAgent: true },
    });
    emitAiState(io, updated);
    logger.info(`[agent] Hội thoại ${conversationId} tạm dừng AI (người thật xen vào)`);
  } catch (err) {
    logger.error('[agent] onHumanIntervention error:', err);
  }
}

async function pause(conv: NonNullable<ConvWithAgent>, reason: string, io?: Server | null) {
  const updated = await prisma.conversation.update({
    where: { id: conv.id },
    data: { aiState: 'paused', aiPausedReason: reason },
    include: { aiAgent: true },
  });
  emitAiState(io, updated);
  io?.emit('ai:handoff', { conversationId: conv.id, reason, agentName: conv.aiAgent?.name ?? null });
}

/** Hết giờ chờ — kiểm tra guardrails rồi sinh & gửi câu trả lời. */
async function fire(conversationId: string, io?: Server | null) {
  timers.delete(conversationId);
  const conv = await loadConv(conversationId);
  if (!conv || !conv.aiAgent) return;
  const agent = conv.aiAgent;
  if (!agent.enabled) return;
  if (conv.aiState !== 'armed' && conv.aiState !== 'active') return;
  if (conv.threadType === 'group' && !agent.handleGroups) return;

  // Nick riêng tư (privacy=main) → agent không gửi thay được.
  if (conv.zaloAccount?.privacyMode === 'main') {
    await pause(conv, 'privacy_locked', io);
    return;
  }

  // Tin cuối phải là của KHÁCH (chưa ai trả lời). Nếu là self → đã có người/agent trả lời.
  const lastMsg = await prisma.message.findFirst({
    where: { conversationId, isDeleted: false },
    orderBy: { sentAt: 'desc' },
    select: { senderType: true, content: true, contentType: true },
  });
  if (!lastMsg || lastMsg.senderType === 'self') return;

  // Giới hạn số lần tự trả lời / hội thoại → buộc bàn giao người thật.
  if (conv.aiAutoReplyCount >= agent.maxAutoReplies) {
    await pause(conv, 'max_replies', io);
    return;
  }

  // Từ khoá bàn giao trong tin gần nhất của khách.
  const lastText = (lastMsg.content || '').toLowerCase();
  if (agent.handoffKeywords.length && agent.handoffKeywords.some((k) => k && lastText.includes(k))) {
    await pause(conv, 'handoff_keyword', io);
    return;
  }

  // Giờ hoạt động (nếu cấu hình).
  if (!withinActiveHours(agent.activeHours)) return; // ngoài giờ → để người thật, giữ armed

  // Công tắc AI toàn org + quota ngày.
  const cfg = await getAiConfig(conv.orgId);
  if (!cfg.enabled) return;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const usedToday = await prisma.message.count({
    where: { sentByAgentId: { not: null }, createdAt: { gte: startOfDay }, conversation: { orgId: conv.orgId } },
  });
  if (usedToday >= cfg.maxDaily) {
    await pause(conv, 'quota', io);
    return;
  }

  const customerName = conv.contact?.crmName || conv.contact?.fullName || 'Khách';
  const reply = await generateAgentReply({
    orgId: conv.orgId,
    agent,
    conversationId,
    customerName,
  });
  if (!reply) {
    logger.warn(`[agent] Không sinh được câu trả lời cho ${conversationId}`);
    // Báo ra UI thay vì im lặng — thường do thiếu API key hoặc hết hạn mức (quota/429).
    io?.emit('ai:error', {
      conversationId,
      agentName: agent.name,
      message: 'AI chưa trả lời được — kiểm tra API key / hạn mức (quota) hoặc đổi model.',
    });
    return; // giữ armed, lần khách nhắn sau sẽ thử lại
  }

  // Chế độ soạn nháp: lưu gợi ý + báo, KHÔNG gửi.
  if (agent.autonomy === 'draft') {
    await prisma.aiSuggestion.create({
      data: {
        orgId: conv.orgId,
        conversationId,
        type: 'agent_draft',
        content: reply,
        confidence: 0.8,
      },
    });
    io?.emit('ai:draft', { conversationId, agentName: agent.name, content: reply });
    return;
  }

  // Chế độ tự gửi.
  const sent = await sendAgentText({
    conversation: {
      id: conv.id,
      zaloAccountId: conv.zaloAccountId,
      externalThreadId: conv.externalThreadId,
      threadType: conv.threadType,
    },
    zaloAccount: { zaloUid: conv.zaloAccount?.zaloUid ?? null, privacyMode: conv.zaloAccount?.privacyMode ?? 'sub' },
    agentId: agent.id,
    agentName: agent.name,
    text: reply,
    io,
  });
  if (!sent) return; // gửi fail → giữ armed, thử lại sau

  noteAgentSentMsgId(sent.zaloMsgId);
  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { aiState: 'active', aiAutoReplyCount: { increment: 1 }, aiLastReplyAt: new Date() },
    include: { aiAgent: true },
  });
  emitAiState(io, updated);
}

/** Giờ hoạt động: activeHours = { start: "08:00", end: "21:00", days?: [1..7] } theo giờ VN. */
function withinActiveHours(activeHours: unknown): boolean {
  if (!activeHours || typeof activeHours !== 'object') return true;
  const ah = activeHours as { start?: string; end?: string; days?: number[] };
  if (!ah.start || !ah.end) return true;
  // Giờ VN (UTC+7) đơn giản — đủ cho v1.
  const now = new Date(Date.now() + 7 * 3600_000);
  const dow = now.getUTCDay() === 0 ? 7 : now.getUTCDay(); // 1=Mon..7=Sun
  if (Array.isArray(ah.days) && ah.days.length && !ah.days.includes(dow)) return false;
  const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
  const [sh, sm] = ah.start.split(':').map(Number);
  const [eh, em] = ah.end.split(':').map(Number);
  const start = sh * 60 + (sm || 0);
  const end = eh * 60 + (em || 0);
  return start <= end ? cur >= start && cur <= end : cur >= start || cur <= end;
}
