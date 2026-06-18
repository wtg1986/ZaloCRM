/**
 * agent-service.ts — Quản lý AI Agent + sinh & gửi câu trả lời tự động.
 *
 * Tách bạch:
 *  - CRUD agent (scoped theo org)
 *  - đính/gỡ/tạm dừng/bật lại agent trên 1 hội thoại (đổi Conversation.aiState)
 *  - buildAgentPrompt: ghép systemPrompt + tri thức + guardrails chung
 *  - generateAgentReply: gọi LLM (tái dùng provider của module ai)
 *  - sendAgentText: gửi Zalo + lưu Message (đánh dấu sentByAgentId) + emit socket
 *
 * State machine xem [agent-autopilot.ts]. File này KHÔNG tự lên lịch — chỉ thực thi.
 */
import { randomUUID } from 'node:crypto';
import type { Server } from 'socket.io';
import { prisma } from '../../../shared/database/prisma-client.js';
import { logger } from '../../../shared/utils/logger.js';
import { zaloPool } from '../../zalo/zalo-pool.js';
import { zaloRateLimiter } from '../../zalo/zalo-rate-limiter.js';
import { getAiConfig, getProviderApiKey, generateText } from '../ai-service.js';
import { BASE_GUARDRAILS } from './agent-presets.js';

const CONTEXT_MESSAGES = 16; // số tin gần nhất đưa vào ngữ cảnh

export type AiState = 'off' | 'armed' | 'active' | 'paused';

/* ── CRUD ──────────────────────────────────────────────────────────────── */

export interface AgentInput {
  name: string;
  role?: string | null;
  industry?: string | null;
  avatarUrl?: string | null;
  systemPrompt: string;
  knowledge?: string | null;
  greeting?: string | null;
  provider?: string | null;
  model?: string | null;
  temperature?: number;
  autonomy?: 'auto' | 'draft';
  takeoverDelaySec?: number;
  maxAutoReplies?: number;
  handoffKeywords?: string[];
  handleGroups?: boolean;
  activeHours?: unknown;
  enabled?: boolean;
}

export function listAgents(orgId: string) {
  return prisma.aiAgent.findMany({
    where: { orgId },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { conversations: true } } },
  });
}

export function getAgent(orgId: string, id: string) {
  return prisma.aiAgent.findFirst({ where: { id, orgId } });
}

function sanitize(input: Partial<AgentInput>) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = String(input.name).trim().slice(0, 120);
  if (input.role !== undefined) data.role = input.role ? String(input.role).trim().slice(0, 120) : null;
  if (input.industry !== undefined) data.industry = input.industry || null;
  if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl || null;
  if (input.systemPrompt !== undefined) data.systemPrompt = String(input.systemPrompt).trim().slice(0, 8000);
  if (input.knowledge !== undefined) data.knowledge = input.knowledge ? String(input.knowledge).slice(0, 12000) : null;
  if (input.greeting !== undefined) data.greeting = input.greeting ? String(input.greeting).trim().slice(0, 1000) : null;
  if (input.provider !== undefined) data.provider = input.provider || null;
  if (input.model !== undefined) data.model = input.model || null;
  if (input.temperature !== undefined) data.temperature = Math.max(0, Math.min(1, Number(input.temperature) || 0.7));
  if (input.autonomy !== undefined) data.autonomy = input.autonomy === 'draft' ? 'draft' : 'auto';
  if (input.takeoverDelaySec !== undefined) data.takeoverDelaySec = Math.max(0, Math.min(600, Math.round(Number(input.takeoverDelaySec) || 10)));
  if (input.maxAutoReplies !== undefined) data.maxAutoReplies = Math.max(1, Math.min(100, Math.round(Number(input.maxAutoReplies) || 5)));
  if (input.handoffKeywords !== undefined) {
    data.handoffKeywords = Array.isArray(input.handoffKeywords)
      ? input.handoffKeywords.map((k) => String(k).trim().toLowerCase()).filter(Boolean).slice(0, 40)
      : [];
  }
  if (input.handleGroups !== undefined) data.handleGroups = !!input.handleGroups;
  if (input.activeHours !== undefined) data.activeHours = input.activeHours ?? null;
  if (input.enabled !== undefined) data.enabled = !!input.enabled;
  return data;
}

export async function createAgent(orgId: string, userId: string | null, input: AgentInput) {
  if (!input.name?.trim()) throw new Error('Tên agent là bắt buộc');
  if (!input.systemPrompt?.trim()) throw new Error('System prompt là bắt buộc');
  return prisma.aiAgent.create({
    data: {
      orgId,
      createdByUserId: userId,
      ...(sanitize(input) as any),
      name: String(input.name).trim().slice(0, 120),
      systemPrompt: String(input.systemPrompt).trim().slice(0, 8000),
    },
  });
}

export async function updateAgent(orgId: string, id: string, input: Partial<AgentInput>) {
  const existing = await getAgent(orgId, id);
  if (!existing) throw new Error('Agent không tồn tại');
  return prisma.aiAgent.update({ where: { id }, data: sanitize(input) as any });
}

export async function deleteAgent(orgId: string, id: string) {
  const existing = await getAgent(orgId, id);
  if (!existing) throw new Error('Agent không tồn tại');
  // Gỡ khỏi mọi hội thoại + nick mặc định trước khi xoá (FK SetNull tự lo, nhưng
  // ta cũng reset aiState để không còn hội thoại "armed" trỏ tới agent đã xoá).
  await prisma.conversation.updateMany({
    where: { aiAgentId: id },
    data: { aiAgentId: null, aiState: 'off', aiPausedReason: null },
  });
  await prisma.zaloAccount.updateMany({ where: { defaultAiAgentId: id }, data: { defaultAiAgentId: null } });
  await prisma.aiAgent.delete({ where: { id } });
}

/* ── Đính / gỡ / tạm dừng / bật lại ────────────────────────────────────── */

export async function setConversationAgent(
  orgId: string,
  conversationId: string,
  agentId: string | null,
  io?: Server | null,
) {
  const conv = await prisma.conversation.findFirst({ where: { id: conversationId, orgId } });
  if (!conv) throw new Error('Hội thoại không tồn tại');

  if (agentId) {
    const agent = await getAgent(orgId, agentId);
    if (!agent) throw new Error('Agent không tồn tại');
    if (!agent.enabled) throw new Error('Agent đang tắt — bật agent trước khi đính');
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      aiAgentId: agentId,
      aiState: agentId ? 'armed' : 'off',
      aiAutoReplyCount: 0,
      aiPausedReason: null,
    },
    include: { aiAgent: true },
  });
  emitAiState(io, updated);
  return updated;
}

export async function setConversationAiState(
  orgId: string,
  conversationId: string,
  state: AiState,
  reason: string | null,
  io?: Server | null,
) {
  const conv = await prisma.conversation.findFirst({ where: { id: conversationId, orgId } });
  if (!conv) throw new Error('Hội thoại không tồn tại');
  if (!conv.aiAgentId && state !== 'off') throw new Error('Chưa đính agent vào hội thoại này');
  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { aiState: state, aiPausedReason: state === 'paused' ? reason : null },
    include: { aiAgent: true },
  });
  emitAiState(io, updated);
  return updated;
}

export async function setNickDefaultAgent(orgId: string, accountId: string, agentId: string | null) {
  const acc = await prisma.zaloAccount.findFirst({ where: { id: accountId, orgId } });
  if (!acc) throw new Error('Nick không tồn tại');
  if (agentId) {
    const agent = await getAgent(orgId, agentId);
    if (!agent) throw new Error('Agent không tồn tại');
  }
  return prisma.zaloAccount.update({ where: { id: accountId }, data: { defaultAiAgentId: agentId } });
}

/** Phát socket cho FE cập nhật badge trạng thái realtime. */
export function emitAiState(io: Server | null | undefined, conv: { id: string; aiState: string; aiAgentId: string | null; aiPausedReason?: string | null; aiAgent?: { name: string } | null }) {
  io?.emit('ai:state', {
    conversationId: conv.id,
    aiState: conv.aiState,
    aiAgentId: conv.aiAgentId,
    agentName: conv.aiAgent?.name ?? null,
    pausedReason: conv.aiPausedReason ?? null,
  });
}

/* ── Prompt + sinh câu trả lời ─────────────────────────────────────────── */

type AgentRow = NonNullable<Awaited<ReturnType<typeof getAgent>>>;

export function buildAgentPrompt(agent: AgentRow): string {
  const parts = [agent.systemPrompt.trim()];
  if (agent.role) parts.unshift(`Vai trò của bạn: ${agent.role}.`);
  if (agent.knowledge?.trim()) {
    parts.push(`\n# Tri thức / FAQ (chỉ dùng thông tin trong đây, không bịa)\n${agent.knowledge.trim()}`);
  }
  parts.push('\n' + BASE_GUARDRAILS);
  return parts.join('\n');
}

interface CtxMessage {
  senderType: string;
  content: string | null;
  contentType: string;
  senderName?: string | null;
}

function renderContext(messages: CtxMessage[], customerName: string): string {
  const lines: string[] = [];
  for (const m of messages) {
    const who = m.senderType === 'self' ? 'Bạn' : customerName || 'Khách';
    let text = '';
    if (m.contentType === 'text' || m.contentType === 'rich' || !m.contentType) {
      text = (m.content || '').slice(0, 1000);
    } else {
      // media/sự kiện → nhãn gọn để AI biết khách gửi gì.
      const label: Record<string, string> = {
        image: '[gửi hình ảnh]', video: '[gửi video]', file: '[gửi tệp]',
        sticker: '[sticker]', voice: '[tin nhắn thoại]', audio: '[ghi âm]',
        link: '[gửi liên kết]', gif: '[gif]', contact_card: '[danh thiếp]',
        call: '[cuộc gọi]', location: '[vị trí]',
      };
      text = label[m.contentType] || `[${m.contentType}]`;
    }
    if (text.trim()) lines.push(`${who}: ${text.trim()}`);
  }
  return lines.join('\n');
}

/** Sinh câu trả lời từ ngữ cảnh hội thoại. Trả về text (đã trim) hoặc null nếu fail. */
export async function generateAgentReply(input: {
  orgId: string;
  agent: AgentRow;
  conversationId: string;
  customerName?: string;
}): Promise<string | null> {
  const cfg = await getAiConfig(input.orgId);
  const provider = input.agent.provider || cfg.provider;
  const model = input.agent.model || cfg.model;
  const apiKey = await getProviderApiKey(input.orgId, provider);
  if (!apiKey) {
    logger.warn(`[agent] Không có API key cho provider ${provider} (org ${input.orgId})`);
    return null;
  }

  const recent = await prisma.message.findMany({
    where: { conversationId: input.conversationId, isDeleted: false },
    orderBy: { sentAt: 'desc' },
    take: CONTEXT_MESSAGES,
    select: { senderType: true, content: true, contentType: true, senderName: true },
  });
  recent.reverse();

  const customerName = input.customerName || 'Khách';
  const context = renderContext(recent, customerName);
  const system = buildAgentPrompt(input.agent);
  const userPrompt = [
    '<hoi_thoai>',
    `Khách hàng: ${customerName}`,
    context,
    '</hoi_thoai>',
    '',
    'Hãy soạn DUY NHẤT nội dung tin nhắn tiếp theo bạn gửi cho khách (không thêm tiền tố tên, không giải thích, không đặt trong ngoặc kép).',
  ].join('\n');

  try {
    const raw = await generateText(provider, apiKey, model, system, userPrompt, 600);
    const text = (raw || '').trim();
    if (!text) return null;
    // Bóc ngoặc kép bao ngoài nếu model lỡ thêm.
    return text.replace(/^["“](.*)["”]$/s, '$1').trim().slice(0, 4000);
  } catch (err) {
    logger.error('[agent] generate reply error:', err);
    return null;
  }
}

/* ── Gửi tin (đánh dấu sentByAgentId) ──────────────────────────────────── */

/**
 * Gửi text qua Zalo thay mặt agent + lưu Message + emit. Mirror logic của
 * POST /conversations/:id/messages nhưng đánh dấu sentByAgentId & sentVia.
 * Trả về message đã lưu (đã cast BigInt) hoặc null nếu không gửi được.
 */
export async function sendAgentText(input: {
  conversation: { id: string; zaloAccountId: string; externalThreadId: string | null; threadType: string };
  zaloAccount: { zaloUid: string | null; privacyMode: string };
  agentId: string;
  agentName: string;
  text: string;
  io?: Server | null;
}): Promise<{ id: string; zaloMsgId: string | null } | null> {
  const { conversation, zaloAccount, text } = input;
  const instance = zaloPool.getInstance(conversation.zaloAccountId);
  if (!instance?.api) {
    logger.warn(`[agent] Nick ${conversation.zaloAccountId} chưa kết nối — bỏ qua gửi`);
    return null;
  }

  const limits = await zaloRateLimiter.checkLimits(conversation.zaloAccountId);
  if (!limits.allowed) {
    logger.warn(`[agent] Rate limit nick ${conversation.zaloAccountId}: ${limits.reason}`);
    return null;
  }

  const threadId = conversation.externalThreadId || '';
  const threadType = conversation.threadType === 'group' ? 1 : 0;

  try {
    zaloRateLimiter.recordSend(conversation.zaloAccountId);
    const sendResult = await instance.api.sendMessage({ msg: text }, threadId, threadType);
    const sr = sendResult as unknown as { message?: { msgId?: number | string } | null; attachment?: Array<{ msgId?: number | string }> };
    const rawId = sr?.message?.msgId ?? sr?.attachment?.[0]?.msgId ?? '';
    const zaloMsgId = String(rawId || '');

    const message = await prisma.message.create({
      data: {
        id: randomUUID(),
        conversationId: conversation.id,
        zaloMsgId: zaloMsgId || null,
        zaloMsgIdNum: zaloMsgId && /^\d+$/.test(zaloMsgId) ? BigInt(zaloMsgId) : null,
        senderType: 'self',
        senderUid: zaloAccount.zaloUid || '',
        senderName: input.agentName,
        content: text,
        contentType: 'text',
        sentAt: new Date(),
        sentVia: 'ai_agent',
        sentByAgentId: input.agentId,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), isReplied: true, unreadCount: 0 },
    });

    const safeMessage = { ...message, zaloMsgIdNum: message.zaloMsgIdNum?.toString() ?? null };
    input.io?.emit('chat:message', {
      accountId: conversation.zaloAccountId,
      message: safeMessage,
      conversationId: conversation.id,
      _privacyMeta: { privacyMode: zaloAccount.privacyMode, ownerUserId: null },
    });

    return { id: message.id, zaloMsgId: zaloMsgId || null };
  } catch (err) {
    logger.error('[agent] send error:', err);
    return null;
  }
}
