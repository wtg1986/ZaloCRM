import { prisma } from '../../shared/database/prisma-client.js';
import { config } from '../../config/index.js';
import { logger } from '../../shared/utils/logger.js';
import { getProviderConfig, getAvailableProviders } from './provider-registry.js';
import { generateWithAnthropic } from './providers/anthropic.js';
import { generateWithGemini } from './providers/gemini.js';
import { generateWithOpenaiCompat } from './providers/openai-compat.js';
import { buildReplyDraftPrompt } from './prompts/reply-draft.js';
import { buildSummaryPrompt } from './prompts/summary.js';
import { buildSentimentPrompt } from './prompts/sentiment.js';
import { parseAppointmentRuleBased } from './appointment-fallback-parser.js';

export type AiTaskType = 'reply_draft' | 'summary' | 'sentiment';

type MessageContext = { senderType: string; senderName: string | null; content: string | null; sentAt: Date };
type SentimentResult = { label: 'positive' | 'neutral' | 'negative'; confidence: number; reason: string };

function detectLanguage(text: string): 'vi' | 'en' {
  if (/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(text)) return 'vi';
  const vietnameseHints = [' khách ', ' chào ', ' tư vấn ', ' báo giá ', ' sản phẩm ', ' giúp ', ' nhé ', ' không '];
  return vietnameseHints.some((hint) => (` ${text.toLowerCase()} `).includes(hint)) ? 'vi' : 'en';
}

function escapeXmlBoundary(text: string): string {
  return text.replace(/<\/?conversation_context>/gi, '');
}

function buildConversationContext(messages: MessageContext[]) {
  return messages
    .map((msg) => {
      const author = msg.senderType === 'self' ? 'staff' : (msg.senderName || 'customer');
      const content = escapeXmlBoundary(msg.content || '(empty)');
      return `[${msg.sentAt.toISOString()}] ${author}: ${content}`;
    })
    .join('\n');
}

async function getProviderApiKey(orgId: string, provider: string) {
  /* 1. Check registry (env-based) */
  const providerDef = getProviderConfig(provider);
  if (providerDef?.authToken) return providerDef.authToken;

  /* 2. Fallback: per-org DB setting */
  const setting = await prisma.appSetting.findFirst({
    where: { orgId, settingKey: `ai_${provider}_api_key` },
  });
  return setting?.valuePlain || '';
}

export async function getAiConfig(orgId: string) {
  let aiConfig = await prisma.aiConfig.findUnique({ where: { orgId } });
  if (!aiConfig) {
    aiConfig = await prisma.aiConfig.create({
      data: { orgId, provider: config.aiDefaultProvider, model: config.aiDefaultModel, maxDaily: 500, enabled: true },
    });
  }
  const availableProviders = getAvailableProviders();
  const hasKey = async (p: string) => !!(await getProviderApiKey(orgId, p));
  const [hasAnthropicKey, hasGeminiKey] = await Promise.all([hasKey('anthropic'), hasKey('gemini')]);
  return { ...aiConfig, hasAnthropicKey, hasGeminiKey, availableProviders };
}

export async function updateAiConfig(orgId: string, input: { provider?: string; model?: string; maxDaily?: number; enabled?: boolean }) {
  return prisma.aiConfig.upsert({
    where: { orgId },
    create: {
      orgId,
      provider: input.provider || config.aiDefaultProvider,
      model: input.model || config.aiDefaultModel,
      maxDaily: input.maxDaily ?? 500,
      enabled: input.enabled ?? true,
    },
    update: {
      provider: input.provider,
      model: input.model,
      maxDaily: input.maxDaily,
      enabled: input.enabled,
    },
  });
}

export async function getAiUsage(orgId: string) {
  const currentConfig = await getAiConfig(orgId);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const usedToday = await prisma.aiSuggestion.count({ where: { orgId, createdAt: { gte: startOfDay } } });
  return {
    usedToday,
    maxDaily: currentConfig.maxDaily,
    remaining: Math.max(0, currentConfig.maxDaily - usedToday),
    enabled: currentConfig.enabled,
  };
}

async function loadConversation(conversationId: string, orgId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, orgId },
    include: {
      contact: { select: { fullName: true } },
      messages: {
        where: { isDeleted: false },
        orderBy: { sentAt: 'desc' },
        take: 40,
        select: { senderType: true, senderName: true, content: true, sentAt: true },
      },
    },
  });
  if (!conversation) throw new Error('Conversation not found');
  return { ...conversation, messages: [...conversation.messages].reverse() };
}

async function generateText(provider: string, apiKey: string, model: string, system: string, prompt: string) {
  const providerDef = getProviderConfig(provider);
  const baseUrl = providerDef?.baseUrl || '';

  if (provider === 'anthropic') return generateWithAnthropic(baseUrl, apiKey, model, system, prompt);
  if (provider === 'gemini') return generateWithGemini(baseUrl, apiKey, model, system, prompt);

  /* OpenAI, Qwen, Kimi all use OpenAI-compatible chat/completions API */
  if (provider === 'openai') return generateWithOpenaiCompat(`${baseUrl}/v1/chat/completions`, apiKey, model, system, prompt);
  if (provider === 'qwen') return generateWithOpenaiCompat(`${baseUrl}/compatible-mode/v1/chat/completions`, apiKey, model, system, prompt);
  if (provider === 'kimi') return generateWithOpenaiCompat(`${baseUrl}/v1/chat/completions`, apiKey, model, system, prompt);

  throw new Error(`Unsupported AI provider: ${provider}`);
}

async function saveSuggestion(input: { orgId: string; conversationId: string; messageId?: string; type: AiTaskType; content: string; confidence: number }) {
  return prisma.aiSuggestion.create({
    data: {
      orgId: input.orgId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      type: input.type,
      content: input.content,
      confidence: input.confidence,
    },
  });
}

export async function generateAiOutput(input: { orgId: string; conversationId: string; type: AiTaskType; messageId?: string }) {
  const [currentConfig, conversation] = await Promise.all([
    getAiConfig(input.orgId),
    loadConversation(input.conversationId, input.orgId),
  ]);

  if (!currentConfig.enabled) throw new Error('AI is disabled for this organization');

  // Atomic quota check — count inside transaction to prevent TOCTOU race
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const withinQuota = await prisma.$transaction(async (tx) => {
    const usedToday = await tx.aiSuggestion.count({ where: { orgId: input.orgId, createdAt: { gte: startOfDay } } });
    return usedToday < currentConfig.maxDaily;
  });
  if (!withinQuota) throw new Error('AI daily quota exceeded');

  const apiKey = await getProviderApiKey(input.orgId, currentConfig.provider);
  if (!apiKey) throw new Error('AI provider key is not configured');

  const contextText = buildConversationContext(conversation.messages);
  const language = detectLanguage(contextText);
  const customerName = conversation.contact?.fullName || 'customer';
  const userPrompt = [
    `<conversation_context>`,
    `Customer: ${customerName}`,
    contextText,
    `</conversation_context>`,
  ].join('\n');

  const system = input.type === 'reply_draft'
    ? buildReplyDraftPrompt(language)
    : input.type === 'summary'
      ? buildSummaryPrompt(language)
      : buildSentimentPrompt(language);

  const raw = await generateText(currentConfig.provider, apiKey, currentConfig.model, system, userPrompt);

  if (input.type === 'sentiment') {
    let parsed: SentimentResult;
    try {
      parsed = JSON.parse(raw) as SentimentResult;
    } catch {
      parsed = { label: 'neutral', confidence: 0.4, reason: raw };
    }
    const normalized = {
      label: ['positive', 'negative', 'neutral'].includes(parsed.label) ? parsed.label : 'neutral',
      confidence: Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, parsed.confidence)) : 0.4,
      reason: parsed.reason || raw,
    };
    await saveSuggestion({
      orgId: input.orgId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      type: 'sentiment',
      content: JSON.stringify(normalized),
      confidence: normalized.confidence,
    });
    return normalized;
  }

  const text = raw.trim();
  await saveSuggestion({
    orgId: input.orgId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    type: input.type,
    content: text,
    confidence: 0.8,
  });
  return { content: text, confidence: 0.8 };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Parse a free-form note ("Thứ 6 gọi lại khách", "3 ngày nữa nhắn tin chốt giá")
 * into a structured appointment proposal. Returns null if AI can't find a clear
 * date/time intent — caller falls back to manual create.
 * ────────────────────────────────────────────────────────────────────────── */
export type ParsedAppointment = {
  date: string | null;       // YYYY-MM-DD
  time: string | null;       // HH:MM (24h)
  type: string | null;       // 'call' | 'message' | 'meeting' | 'follow_up' | null
  location: string | null;   // địa điểm gặp (nếu detect)
  summary: string;           // tiêu đề ngắn cho lịch hẹn
  hasIntent: boolean;        // true nếu phát hiện ý định lập lịch (kể cả thông tin chưa đủ)
  missingFields: string[];   // ['date','time','location'] — field nào AI thiếu, FE prompt user điền
  confidence: number;        // 0..1
  source?: 'ai' | 'fallback'; // 'ai'=Gemini OK, 'fallback'=rule-based (AI fail/quota)
};

export async function parseAppointmentFromText(input: { orgId: string; text: string; now?: Date }): Promise<ParsedAppointment & { source?: 'ai' | 'fallback' } | null> {
  const now = input.now || new Date();
  const currentConfig = await getAiConfig(input.orgId);

  // ── Fallback rule-based parser luôn chạy trước/song song để có kết quả nếu AI fail.
  //    Result được trả nếu AI throw (429 quota, timeout, network). source='fallback'
  //    để FE hiển thị hint "AI hết quota — đã dùng rule-based".
  const fallback = parseAppointmentRuleBased(input.text, now);

  if (!currentConfig.enabled) {
    // AI tắt → chỉ trả fallback nếu có intent
    return fallback.hasIntent ? { ...fallback, source: 'fallback' } : null;
  }
  const apiKey = await getProviderApiKey(input.orgId, currentConfig.provider);
  if (!apiKey) {
    logger.warn('[ai-parse] No API key — using rule-based fallback');
    return fallback.hasIntent ? { ...fallback, source: 'fallback' } : null;
  }
  const today = now.toISOString().slice(0, 10);
  const weekday = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][now.getDay()];

  const system = [
    'You parse a Vietnamese CRM note into an appointment proposal. Return STRICT JSON ONLY, no prose.',
    'Output schema:',
    '{ "date": "YYYY-MM-DD"|null, "time": "HH:MM"|null, "type": "call"|"message"|"meeting"|"follow_up"|null, "location": string|null, "summary": string, "hasIntent": boolean, "missingFields": string[], "confidence": number_0_to_1 }',
    '',
    'PHÁT HIỆN Ý ĐỊNH RỘNG (hasIntent=true):',
    '- BẤT KỲ từ khoá thời gian: "thứ X", "ngày N", "DD/MM", "mai", "kia", "tuần sau", "tháng sau", "N ngày nữa", "sáng/chiều/tối", "lúc HH giờ", "trước/sau Tết", "đầu/giữa/cuối tháng", "đầu/cuối tuần"',
    '- HOẶC từ khoá hành động hẹn: "gọi lại", "nhắn lại", "gặp", "ghé", "đến", "chốt", "ký", "xem nhà", "qua văn phòng", "tới chỗ"',
    '- HOẶC từ khoá địa điểm: "tại [địa điểm]", "ở [địa điểm]", "[tên building/đường/quận]", "VP", "showroom", "căn hộ", "dự án [name]"',
    '- HOẶC từ khoá quan tâm cần theo dõi: "follow up", "theo dõi", "check lại", "phải gọi"',
    '→ Có 1 trong các nhóm trên → hasIntent=true. Trả các field detect được, field nào không có → null + thêm vào missingFields.',
    '',
    `Hôm nay là ${today} (${weekday}). Tính ngày tuyệt đối cho "thứ X" (sang tuần tới nếu thứ đã qua), "N ngày nữa", "mai"=ngày mai, "kia"=ngày kia.`,
    '"sáng"=09:00, "chiều"=14:00, "tối"=19:00. "trưa"=12:00.',
    'type rules: "gọi"/"call"→call, "nhắn"→message, "gặp"/"ghé"/"đến"/"xem nhà"→meeting, fallback→follow_up.',
    'location: trích nguyên văn cụm địa điểm nếu có. KHÔNG có → null + thêm "location" vào missingFields.',
    'summary: 1 câu ≤120 ký tự mô tả việc cần làm.',
    '',
    'missingFields: liệt kê field thiếu trong ["date","time","location"] để FE prompt user điền tiếp.',
    'confidence: > 0.7 khi date+time+intent rõ, 0.4-0.7 khi 1-2 field có, < 0.4 khi mơ hồ.',
    '',
    'CHỈ trả hasIntent=false khi note hoàn toàn KHÔNG liên quan hẹn (vd "khách thích nhà 3pn", "đã gửi báo giá").',
    'Khi hasIntent=false → tất cả field null/empty array, confidence=0.',
  ].join('\n');

  const userPrompt = `<note>\n${escapeXmlBoundary(input.text)}\n</note>\nReturn JSON only.`;

  let raw: string;
  try {
    raw = await generateText(currentConfig.provider, apiKey, currentConfig.model, system, userPrompt);
  } catch (err: unknown) {
    // AI fail (429 quota, timeout, network) → fallback to rule-based parser
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes('429');
    if (fallback.hasIntent) {
      logger.warn(`[ai-parse] AI failed (${is429 ? 'quota/rate-limit 429' : msg}) — using rule-based fallback`);
      return { ...fallback, source: 'fallback' };
    }
    // Không fallback được nữa → rethrow để FE biết là AI fail
    throw new Error(is429 ? 'AI hết quota (429) — vui lòng đợi reset hoặc đổi provider' : msg);
  }

  // Strip code fences if model wrapped JSON in ```json ... ```
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed: Partial<ParsedAppointment> & { hasIntent?: boolean; missingFields?: string[]; location?: string | null };
  try {
    parsed = JSON.parse(cleaned) as typeof parsed;
  } catch {
    // AI trả response không parse được → fallback
    if (fallback.hasIntent) {
      logger.warn('[ai-parse] AI returned unparseable JSON — using rule-based fallback');
      return { ...fallback, source: 'fallback' };
    }
    return null;
  }

  const hasIntent = !!parsed.hasIntent;
  if (!hasIntent) {
    // AI says no intent — nhưng rule-based có thể detect ra → ưu tiên fallback nếu nó tự tin
    if (fallback.hasIntent && fallback.confidence >= 0.5) {
      logger.info('[ai-parse] AI says no intent but rule-based detected → using fallback');
      return { ...fallback, source: 'fallback' };
    }
    return {
      date: null, time: null, type: null, location: null,
      summary: '', hasIntent: false, missingFields: [], confidence: 0,
    };
  }

  const confidence = Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, parsed.confidence as number)) : 0.4;
  const validType = parsed.type && ['call', 'message', 'meeting', 'follow_up'].includes(parsed.type) ? parsed.type : null;
  const dateOk = parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date);
  const timeOk = parsed.time && /^\d{2}:\d{2}$/.test(parsed.time);
  const location = parsed.location ? String(parsed.location).slice(0, 200) : null;

  const missing: string[] = Array.isArray(parsed.missingFields) ? parsed.missingFields.filter((f: string) => ['date', 'time', 'location'].includes(f)) : [];
  // Sanity: đảm bảo missing đúng với data
  if (!dateOk && !missing.includes('date')) missing.push('date');
  if (!timeOk && !missing.includes('time')) missing.push('time');
  if (!location && !missing.includes('location')) missing.push('location');

  return {
    date: dateOk ? parsed.date! : null,
    time: timeOk ? parsed.time! : null,
    type: validType,
    location,
    summary: (parsed.summary || '').slice(0, 200),
    hasIntent: true,
    missingFields: missing,
    confidence,
    source: 'ai',
  };
}
