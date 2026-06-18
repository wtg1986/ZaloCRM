import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";

export type AgentAutonomy = "auto" | "draft";
export type AiState = "off" | "armed" | "active" | "paused";

export interface AiAgent {
  id: string;
  name: string;
  role?: string | null;
  industry?: string | null;
  avatarUrl?: string | null;
  systemPrompt: string;
  knowledge?: string | null;
  greeting?: string | null;
  provider?: string | null;
  model?: string | null;
  temperature: number;
  autonomy: AgentAutonomy;
  takeoverDelaySec: number;
  maxAutoReplies: number;
  handoffKeywords: string[];
  handleGroups: boolean;
  activeHours?: { start?: string; end?: string; days?: number[] } | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { conversations: number };
}

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
  autonomy?: AgentAutonomy;
  takeoverDelaySec?: number;
  maxAutoReplies?: number;
  handoffKeywords?: string[];
  handleGroups?: boolean;
  activeHours?: AiAgent["activeHours"];
  enabled?: boolean;
}

export interface AgentPreset {
  key: string;
  label: string;
  icon: string;
  role: string;
  systemPrompt: string;
  handoffKeywords: string[];
}

export interface ProviderDef {
  id: string;
  name: string;
  baseUrl?: string;
  models: { title: string; value: string }[];
}

export const getAgents = () => apiGet<{ agents: AiAgent[] }>("/ai-agents");
export const getAgentPresets = () =>
  apiGet<{ presets: AgentPreset[] }>("/ai-agents/presets");
export const getAgentProviders = () =>
  apiGet<{ providers: ProviderDef[] }>("/ai-agents/providers");
export const createAgent = (input: AgentInput) =>
  apiPost<AiAgent>("/ai-agents", input);
export const updateAgent = (id: string, input: Partial<AgentInput>) =>
  apiPut<AiAgent>(`/ai-agents/${id}`, input);
export const deleteAgent = (id: string) =>
  apiDelete<{ ok: boolean }>(`/ai-agents/${id}`);

// ── Đính / điều khiển trên hội thoại ─────────────────────────────────────
export interface ConvAiResult {
  id: string;
  aiState: AiState;
  aiAgentId: string | null;
  aiPausedReason?: string | null;
  aiAgent?: { id: string; name: string } | null;
}
export const attachAgent = (conversationId: string, agentId: string | null) =>
  apiPost<ConvAiResult>(`/conversations/${conversationId}/ai-agent`, { agentId });
export const pauseAgent = (conversationId: string) =>
  apiPost<ConvAiResult>(`/conversations/${conversationId}/ai-agent/pause`, {});
export const resumeAgent = (conversationId: string) =>
  apiPost<ConvAiResult>(`/conversations/${conversationId}/ai-agent/resume`, {});
export const setNickDefaultAgent = (accountId: string, agentId: string | null) =>
  apiPost<{ ok: boolean; defaultAiAgentId: string | null }>(
    `/zalo-accounts/${accountId}/default-ai-agent`,
    { agentId },
  );

// Nhãn lý do tạm dừng (FE hiển thị).
export const PAUSE_REASON_LABEL: Record<string, string> = {
  human: "Bạn vừa nhắn — AI tạm dừng",
  manual: "Đã tạm dừng thủ công",
  max_replies: "Đã đạt giới hạn tự trả lời — chờ người thật",
  handoff_keyword: "Khách cần gặp người thật",
  privacy_locked: "Nick riêng tư — AI không gửi được",
  quota: "Hết hạn mức AI hôm nay",
};
