/**
 * platform-routes.ts — Quản trị NỀN TẢNG (super-admin), khác admin của org.
 *
 * SaaS: bạn (chủ nền tảng) bán cho nhiều org. Super-admin = chủ (owner) của
 * TỔ CHỨC ĐẦU TIÊN được tạo (org cũ nhất) — chính là người setup hệ thống.
 * Dùng để: xem mọi org + đổi gói thủ công sau khi nhận chuyển khoản.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../shared/database/prisma-client.js';
import { authMiddleware } from './auth-middleware.js';
import { PLAN_LIMITS, PLAN_LABELS } from './plans.js';

// Cache id chủ nền tảng (owner org cũ nhất) — ổn định suốt vòng đời process.
let superAdminUserId: string | null = null;
async function getSuperAdminUserId(): Promise<string | null> {
  if (superAdminUserId) return superAdminUserId;
  const firstOrg = await prisma.organization.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!firstOrg) return null;
  const owner = await prisma.user.findFirst({
    where: { orgId: firstOrg.id, role: 'owner' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  superAdminUserId = owner?.id ?? null;
  return superAdminUserId;
}

async function requireSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  const uid = request.user!.id;
  const sa = await getSuperAdminUserId();
  if (!sa || uid !== sa) {
    reply.status(403).send({ error: 'Chỉ chủ nền tảng mới truy cập được' });
    return false;
  }
  return true;
}

export async function platformRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // GET /api/v1/platform/me — kiểm tra user hiện tại có phải super-admin
  app.get('/api/v1/platform/me', async (request) => {
    const sa = await getSuperAdminUserId();
    return { isSuperAdmin: !!sa && request.user!.id === sa };
  });

  // GET /api/v1/platform/orgs — danh sách mọi tổ chức + gói + usage + chủ
  app.get('/api/v1/platform/orgs', async (request, reply) => {
    if (!(await requireSuperAdmin(request, reply))) return;
    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        plan: true,
        createdAt: true,
        _count: { select: { zaloAccounts: true, users: true, contacts: true } },
        users: {
          where: { role: 'owner' },
          select: { email: true, fullName: true },
          take: 1,
        },
      },
    });
    return {
      orgs: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        plan: o.plan,
        planLabel: PLAN_LABELS[o.plan] ?? o.plan,
        createdAt: o.createdAt,
        owner: o.users[0] ?? null,
        usage: {
          nicks: o._count.zaloAccounts,
          staff: o._count.users,
          contacts: o._count.contacts,
        },
      })),
      plans: Object.keys(PLAN_LIMITS).map((k) => ({
        key: k,
        label: PLAN_LABELS[k] ?? k,
        limits: PLAN_LIMITS[k],
      })),
    };
  });

  // PATCH /api/v1/platform/orgs/:id/plan — đổi gói 1 org (sau khi nhận tiền)
  app.patch<{ Params: { id: string }; Body: { plan: string } }>(
    '/api/v1/platform/orgs/:id/plan',
    async (request, reply) => {
      if (!(await requireSuperAdmin(request, reply))) return;
      const { plan } = request.body ?? {};
      if (!plan || !PLAN_LIMITS[plan]) {
        return reply.status(400).send({ error: 'Gói không hợp lệ' });
      }
      await prisma.organization.update({
        where: { id: request.params.id },
        data: { plan },
      });
      return { ok: true, plan };
    },
  );
}
