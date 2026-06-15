/**
 * Auth routes — setup, login, and profile endpoints.
 * Registered as a Fastify plugin via app.register(authRoutes).
 */
import type { FastifyInstance } from 'fastify';
import { authMiddleware } from './auth-middleware.js';
import {
  checkSetupStatus,
  setup,
  register,
  login,
  getProfile,
} from './auth-service.js';
import { prisma } from '../../shared/database/prisma-client.js';
import {
  getOrgUsage,
  planLimits,
  PLAN_LABELS,
} from './plans.js';
import { seedScoringDefaults } from '../scoring/seed-defaults.js';
import { getUserGrantsInfo } from '../rbac/permission-group-service.js';
import { logger } from '../../shared/utils/logger.js';

/**
 * Fire-and-forget auto-seed Phase 6 scoring config + rules nếu org chưa có.
 * Idempotent — seedScoringDefaults() tự skip khi config đã tồn tại.
 * KHÔNG await để không chặn login/setup response.
 */
function autoSeedScoringIfNeeded(orgId: string): void {
  seedScoringDefaults(orgId).catch((err) => {
    logger.warn({ orgId, err: err?.message }, '[auto-seed-scoring] failed silently');
  });
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/setup/status — check if first-run setup is needed
  app.get('/api/v1/setup/status', async () => {
    return checkSetupStatus();
  });

  // POST /api/v1/setup — create org + owner user, return JWT
  app.post<{
    Body: { orgName: string; fullName: string; email: string; password: string };
  }>('/api/v1/setup', async (request, reply) => {
    const { orgName, fullName, email, password } = request.body;
    if (!orgName || !fullName || !email || !password) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }
    const payload = await setup(orgName, fullName, email, password);
    const token = app.jwt.sign(payload, { expiresIn: '7d' });
    // Phase 6 polish — auto-seed scoring defaults cho org mới tạo
    autoSeedScoringIfNeeded(payload.orgId);
    return { token, user: payload };
  });

  // POST /api/v1/auth/register — đăng ký tự phục vụ: tạo org mới + owner, gói free
  app.post<{
    Body: { orgName: string; fullName: string; email: string; password: string };
  }>('/api/v1/auth/register', async (request, reply) => {
    const { orgName, fullName, email, password } = request.body;
    if (!orgName || !fullName || !email || !password) {
      return reply.status(400).send({ error: 'Thiếu thông tin đăng ký' });
    }
    if (password.length < 6) {
      return reply.status(400).send({ error: 'Mật khẩu tối thiểu 6 ký tự' });
    }
    const payload = await register(orgName, fullName, email, password);
    const token = app.jwt.sign(payload, { expiresIn: '7d' });
    autoSeedScoringIfNeeded(payload.orgId);
    return { token, user: payload };
  });

  // GET /api/v1/me/plan — gói hiện tại + giới hạn + mức dùng (cho FE hiển thị)
  app.get('/api/v1/me/plan', { preHandler: authMiddleware }, async (request) => {
    const user = request.user as { orgId: string };
    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { plan: true },
    });
    const plan = org?.plan ?? 'free';
    const [limits, usage] = await Promise.all([
      Promise.resolve(planLimits(plan)),
      getOrgUsage(user.orgId),
    ]);
    return { plan, label: PLAN_LABELS[plan] ?? plan, limits, usage };
  });

  // POST /api/v1/auth/login — verify credentials, return JWT
  app.post<{
    Body: { email: string; password: string };
  }>('/api/v1/auth/login', async (request, reply) => {
    const { email, password } = request.body;
    if (!email || !password) {
      return reply.status(400).send({ error: 'Missing email or password' });
    }
    const payload = await login(email, password);
    const token = app.jwt.sign(payload, { expiresIn: '7d' });
    // Phase 6 polish — fire-and-forget seed nếu org cũ chưa có scoring config.
    // Idempotent — skip nếu đã tồn tại. Không await.
    autoSeedScoringIfNeeded(payload.orgId);
    return { token, user: payload };
  });

  // GET /api/v1/profile — return current user (requires auth)
  app.get('/api/v1/profile', { preHandler: authMiddleware }, async (request) => {
    const user = request.user as { id: string; email: string; role: string; orgId: string };
    const [profile, perms] = await Promise.all([
      getProfile(user.id),
      getUserGrantsInfo(user.id),
    ]);
    // Gắn quyền hiệu lực để FE gate UI (nav/nút).
    return { ...(profile as object), ...perms };
  });
}
