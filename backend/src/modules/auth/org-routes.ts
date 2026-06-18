/**
 * Organization settings routes — get and update current org info + branding.
 * GET is accessible to all authenticated users; mutations require owner role.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../shared/database/prisma-client.js';
import { authMiddleware } from './auth-middleware.js';
import { requireRole } from './role-middleware.js';
import { uploadBuffer } from '../../shared/storage/minio-client.js';
import { logger } from '../../shared/utils/logger.js';

// Offset string "+HH:MM" hoặc "-HH:MM" (vd "+07:00"). HH 00-14, MM 00/15/30/45.
const TIMEZONE_REGEX = /^[+-](0\d|1[0-4]):(00|15|30|45)$/;
// Màu thương hiệu — hex 6 ký tự, vd #4F46E5.
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
// Slug subdomain — chữ thường, số, gạch ngang; 3–30 ký tự; không đầu/cuối gạch.
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;
// Subdomain hệ thống không được chiếm dụng.
const RESERVED_SLUGS = new Set([
  'www', 'api', 'app', 'admin', 'mail', 'ftp', 'smtp', 'root', 'support',
  'help', 'status', 'blog', 'docs', 'cdn', 'static', 'assets', 'dashboard',
  'login', 'signup', 'auth', 'public', 'zalo', 'zalocrm', 'crm', 'system',
]);

function normalizeTimezone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!TIMEZONE_REGEX.test(trimmed)) return null;
  return trimmed;
}

/** Trả lỗi (chuỗi) nếu slug không hợp lệ, hoặc null nếu ok. Slug đã được normalize. */
function validateSlug(slug: string): string | null {
  if (slug.length < 3 || slug.length > 30) return 'Địa chỉ phải dài 3–30 ký tự';
  if (!SLUG_REGEX.test(slug)) {
    return 'Chỉ dùng chữ thường, số và gạch ngang (không bắt đầu/kết thúc bằng gạch)';
  }
  if (slug.includes('--')) return 'Không dùng hai gạch ngang liền nhau';
  if (RESERVED_SLUGS.has(slug)) return 'Địa chỉ này thuộc hệ thống, vui lòng chọn tên khác';
  return null;
}

const ORG_SELECT = {
  id: true, name: true, timezone: true, slug: true, logoUrl: true,
  brandColor: true, plan: true, createdAt: true, updatedAt: true,
  // Phase Privacy v2 2026-05-23 — system notify nick (org-wide sender)
  systemNotifyZaloAccountId: true,
  systemNotifyNick: {
    select: { id: true, displayName: true, avatarUrl: true, zaloUid: true, status: true },
  },
} as const;

const LOGO_MAX = 2 * 1024 * 1024; // 2MB
const LOGO_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

export async function orgRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // GET /api/v1/organization — get current org info
  app.get('/api/v1/organization', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    try {
      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: ORG_SELECT,
      });
      if (!org) return reply.status(404).send({ error: 'Organization not found' });
      return org;
    } catch {
      return reply.status(500).send({ error: 'Failed to fetch organization' });
    }
  });

  // GET /api/v1/organization/slug-available?slug=acme — kiểm tra subdomain còn trống.
  // Owner/admin. Trả { available, reason? }.
  app.get(
    '/api/v1/organization/slug-available',
    { preHandler: requireRole('owner', 'admin') },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user!;
      const raw = (request.query as { slug?: string }).slug ?? '';
      const slug = String(raw).trim().toLowerCase();
      const reason = validateSlug(slug);
      if (reason) return { available: false, reason };
      const taken = await prisma.organization.findFirst({
        where: { slug, NOT: { id: user.orgId } },
        select: { id: true },
      });
      if (taken) return { available: false, reason: 'Địa chỉ này đã có tổ chức khác dùng' };
      return reply.send({ available: true });
    },
  );

  // POST /api/v1/organization/logo — upload logo (multipart, 1 file ảnh). Owner only.
  app.post(
    '/api/v1/organization/logo',
    { preHandler: requireRole('owner') },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user!;
      const file = await (request as any).file?.();
      if (!file) return reply.status(400).send({ error: 'Chưa chọn ảnh logo' });
      if (!LOGO_MIME.includes(file.mimetype)) {
        return reply.status(415).send({ error: 'Logo phải là ảnh PNG, JPG, WEBP hoặc SVG' });
      }
      const buf = await file.toBuffer();
      if (buf.length > LOGO_MAX) {
        return reply.status(413).send({ error: 'Logo tối đa 2MB' });
      }
      try {
        const { url } = await uploadBuffer(buf, file.mimetype, file.filename);
        await prisma.organization.update({ where: { id: user.orgId }, data: { logoUrl: url } });
        logger.info(`Org logo updated by ${user.email}`);
        return { logoUrl: url };
      } catch (err) {
        logger.error('[org] logo upload failed:', err);
        return reply.status(500).send({ error: 'Tải logo thất bại' });
      }
    },
  );

  // Phase Privacy v2 2026-05-23 — admin pick nick chuyên gửi system notification cho cả org.
  // PATCH /api/v1/organization/system-notify-nick { zaloAccountId: string | null }
  // Admin pick bất kỳ nick org có. Validation: nick exists, in same org. KHÔNG yêu cầu admin own.
  app.patch(
    '/api/v1/organization/system-notify-nick',
    { preHandler: requireRole('owner', 'admin') },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user!;
      const body = (request.body ?? {}) as { zaloAccountId?: string | null };
      const accountId = body.zaloAccountId ?? null;

      if (accountId !== null) {
        const nick = await prisma.zaloAccount.findFirst({
          where: { id: accountId, orgId: user.orgId },
          select: { id: true, status: true, displayName: true },
        });
        if (!nick) return reply.status(404).send({ error: 'Nick không tồn tại trong org' });
        // Warning nếu nick disconnected — không block, để admin biết
        if (nick.status !== 'connected') {
          logger.warn(`Org system-notify-nick set to disconnected nick: ${nick.displayName} (${accountId})`);
        }
      }

      await prisma.organization.update({
        where: { id: user.orgId },
        data: { systemNotifyZaloAccountId: accountId },
      });

      return { ok: true, systemNotifyZaloAccountId: accountId };
    },
  );

  // PUT /api/v1/organization — update org info + branding (owner only).
  // Mọi field optional, nhưng phải có ít nhất 1 field hợp lệ.
  app.put(
    '/api/v1/organization',
    { preHandler: requireRole('owner') },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user!;
      const body = (request.body ?? {}) as {
        name?: string;
        timezone?: string;
        slug?: string | null;
        brandColor?: string | null;
        logoUrl?: string | null;
      };

      const data: {
        name?: string;
        timezone?: string;
        slug?: string | null;
        brandColor?: string | null;
        logoUrl?: string | null;
      } = {};

      if (body.name !== undefined) {
        const trimmed = String(body.name).trim();
        if (!trimmed) return reply.status(400).send({ error: 'Tên tổ chức là bắt buộc' });
        data.name = trimmed;
      }

      if (body.timezone !== undefined) {
        const tz = normalizeTimezone(body.timezone);
        if (!tz) {
          return reply
            .status(400)
            .send({ error: 'Múi giờ không hợp lệ. Định dạng: +HH:MM hoặc -HH:MM (vd +07:00).' });
        }
        data.timezone = tz;
      }

      if (body.slug !== undefined) {
        if (body.slug === null || String(body.slug).trim() === '') {
          data.slug = null; // bỏ subdomain
        } else {
          const slug = String(body.slug).trim().toLowerCase();
          const reason = validateSlug(slug);
          if (reason) return reply.status(400).send({ error: reason });
          data.slug = slug;
        }
      }

      if (body.brandColor !== undefined) {
        if (body.brandColor === null || String(body.brandColor).trim() === '') {
          data.brandColor = null;
        } else {
          const color = String(body.brandColor).trim();
          if (!HEX_COLOR_REGEX.test(color)) {
            return reply.status(400).send({ error: 'Màu thương hiệu phải là mã hex, vd #4F46E5' });
          }
          data.brandColor = color;
        }
      }

      if (body.logoUrl !== undefined) {
        // Chỉ cho phép gỡ logo qua đây (đặt null). Upload đi qua POST /logo.
        if (body.logoUrl === null || String(body.logoUrl).trim() === '') {
          data.logoUrl = null;
        }
      }

      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ error: 'Không có thay đổi nào để lưu' });
      }

      try {
        const org = await prisma.organization.update({
          where: { id: user.orgId },
          data,
          select: ORG_SELECT,
        });
        logger.info(`Organization updated by ${user.email}: ${Object.keys(data).join(', ')}`);
        return org;
      } catch (err: any) {
        // P2002 — vi phạm unique (slug đã có org khác dùng)
        if (err?.code === 'P2002') {
          return reply.status(409).send({ error: 'Địa chỉ subdomain này đã có tổ chức khác dùng' });
        }
        logger.error('[org] update failed:', err);
        return reply.status(500).send({ error: 'Failed to update organization' });
      }
    },
  );
}
