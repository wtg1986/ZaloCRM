/**
 * agent-routes.ts — REST cho AI Agents.
 *  - CRUD agent (owner/admin)
 *  - đính/gỡ/tạm dừng/bật lại agent trên hội thoại (người có quyền chat)
 *  - đặt agent mặc định cho nick (owner/admin)
 *  - presets ngành + danh sách provider/model
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Server } from 'socket.io';
import { authMiddleware } from '../../auth/auth-middleware.js';
import { requireRole } from '../../auth/role-middleware.js';
import { getAvailableProviders } from '../provider-registry.js';
import { AGENT_PRESETS } from './agent-presets.js';
import {
  listAgents, getAgent, createAgent, updateAgent, deleteAgent,
  setConversationAgent, setConversationAiState, setNickDefaultAgent,
} from './agent-service.js';

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  const io = () => (app as any).io as Server | undefined;

  // ── Presets + providers (cho form tạo agent) ──────────────────────────
  app.get('/api/v1/ai-agents/presets', async () => ({ presets: AGENT_PRESETS }));
  app.get('/api/v1/ai-agents/providers', async () => ({ providers: getAvailableProviders() }));

  // ── List / get ────────────────────────────────────────────────────────
  app.get('/api/v1/ai-agents', async (request: FastifyRequest) => {
    const user = request.user!;
    const agents = await listAgents(user.orgId);
    return { agents };
  });

  app.get('/api/v1/ai-agents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const agent = await getAgent(user.orgId, id);
    if (!agent) return reply.status(404).send({ error: 'Agent không tồn tại' });
    return agent;
  });

  // ── Create / update / delete (owner/admin) ─────────────────────────────
  app.post('/api/v1/ai-agents', { preHandler: requireRole('owner', 'admin') }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    try {
      const agent = await createAgent(user.orgId, user.id, request.body as any);
      return reply.status(201).send(agent);
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Không tạo được agent' });
    }
  });

  app.put('/api/v1/ai-agents/:id', { preHandler: requireRole('owner', 'admin') }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    try {
      const agent = await updateAgent(user.orgId, id, request.body as any);
      return agent;
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Không lưu được agent' });
    }
  });

  app.delete('/api/v1/ai-agents/:id', { preHandler: requireRole('owner', 'admin') }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    try {
      await deleteAgent(user.orgId, id);
      return { ok: true };
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Không xoá được agent' });
    }
  });

  // ── Đính / gỡ agent vào hội thoại ──────────────────────────────────────
  // POST /conversations/:id/ai-agent { agentId: string | null }
  app.post('/api/v1/conversations/:id/ai-agent', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { agentId } = (request.body ?? {}) as { agentId?: string | null };
    try {
      // Chỉ đính (armed) — KHÔNG gửi gì cho khách. Agent chỉ trả lời khi khách nhắn tin.
      const conv = await setConversationAgent(user.orgId, id, agentId ?? null, io());
      return conv;
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Không đính được agent' });
    }
  });

  // Tạm dừng / bật lại
  app.post('/api/v1/conversations/:id/ai-agent/pause', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    try {
      return await setConversationAiState(user.orgId, id, 'paused', 'manual', io());
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Lỗi' });
    }
  });

  app.post('/api/v1/conversations/:id/ai-agent/resume', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    try {
      return await setConversationAiState(user.orgId, id, 'armed', null, io());
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Lỗi' });
    }
  });

  // ── Agent mặc định cho nick (owner/admin) ──────────────────────────────
  app.post('/api/v1/zalo-accounts/:id/default-ai-agent', { preHandler: requireRole('owner', 'admin') }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { agentId } = (request.body ?? {}) as { agentId?: string | null };
    try {
      const acc = await setNickDefaultAgent(user.orgId, id, agentId ?? null);
      return { ok: true, defaultAiAgentId: acc.defaultAiAgentId };
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Lỗi' });
    }
  });
}
