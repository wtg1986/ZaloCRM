// Thao tác trên tin nhắn: reaction, sửa, thu hồi, xoá, chuyển tiếp, sticker.
// Khớp chat-operations-routes.ts. BE phát socket chat:message(-edited) → thread
// revalidate sau mỗi thao tác cho chắc.
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/lib/api";

// Cập nhật tag CRM per-nick của 1 friendship (gắn/gỡ tag cho hội thoại).
export const updateFriendTags = (friendId: string, crmTagsPerNick: string[]) =>
  apiPatch<unknown>(`/friends/${friendId}`, { crmTagsPerNick });

// ── Templates (mẫu tin) ──────────────────────────────────────────────────────
export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: string | null;
  isPersonal?: boolean;
}
export const getTemplates = (search?: string) =>
  apiGet<{ templates: MessageTemplate[] }>("/automation/templates", {
    search,
  });

// ── AI gợi ý trả lời ─────────────────────────────────────────────────────────
export const aiSuggest = (conversationId: string) =>
  apiPost<{ content: string; confidence?: number }>("/ai/suggest", {
    conversationId,
  });

// ── Sticker ──────────────────────────────────────────────────────────────────
export interface StickerItem {
  id: number;
  catId: number;
  type: number;
  staticUrl: string;
  spriteUrl?: string | null;
  totalFrames?: number;
  duration?: number;
}
export const getStickers = (keyword?: string) =>
  apiGet<{ stickers: StickerItem[] }>("/zalo-sticker-list", { keyword });

export interface StickerMeta {
  type: number;
  staticUrl: string;
  spriteUrl: string | null;
  totalFrames: number;
  duration: number; // ms / frame
  size: number; // frame px
}
export const getStickerMeta = (catId: number, id: number) =>
  apiGet<StickerMeta>(`/zalo-sticker/${catId}/${id}`);

// ── Templates CRUD ───────────────────────────────────────────────────────────
export const createTemplate = (input: {
  name: string;
  content: string;
  category?: string;
  isPersonal?: boolean;
}) => apiPost<MessageTemplate>("/automation/templates", input);

export const updateTemplate = (
  id: string,
  input: { name?: string; content?: string; category?: string },
) => apiPut<MessageTemplate>(`/automation/templates/${id}`, input);

export const deleteTemplate = (id: string) =>
  apiDelete<unknown>(`/automation/templates/${id}`);

// ── CRM Tags CRUD ────────────────────────────────────────────────────────────
export interface CrmTag {
  id: string;
  name: string;
  color: string | null;
  emoji: string | null;
  description: string | null;
  category: string | null;
  usageCount?: number;
}
export const getCrmTags = () => apiGet<{ tags: CrmTag[] }>("/crm-tags");
export const createCrmTag = (input: {
  name: string;
  color?: string;
  emoji?: string;
  description?: string;
}) => apiPost<CrmTag>("/crm-tags", input);
export const updateCrmTag = (
  id: string,
  input: { name?: string; color?: string; emoji?: string | null; description?: string | null },
) => apiPut<CrmTag>(`/crm-tags/${id}`, input);
export const deleteCrmTag = (id: string) =>
  apiDelete<unknown>(`/crm-tags/${id}`);

export const reactToMessage = (
  conversationId: string,
  msgId: string,
  reaction: string,
) =>
  apiPost<unknown>(`/conversations/${conversationId}/reactions`, {
    msgId,
    reaction,
  });

export const editMessage = (
  conversationId: string,
  msgId: string,
  content: string,
) =>
  apiPost<unknown>(
    `/conversations/${conversationId}/messages/${msgId}/edit`,
    { content },
  );

export const recallMessage = (conversationId: string, msgId: string) =>
  apiPost<unknown>(
    `/conversations/${conversationId}/messages/${msgId}/undo`,
    {},
  );

export const deleteMessage = (conversationId: string, msgId: string) =>
  apiDelete<unknown>(`/conversations/${conversationId}/messages/${msgId}`);

export const forwardMessage = (
  conversationId: string,
  msgId: string,
  targetConversationIds: string[],
) =>
  apiPost<unknown>(`/conversations/${conversationId}/forward`, {
    msgId,
    targetConversationIds,
  });

export const sendSticker = (
  conversationId: string,
  stickerId: number,
  cateId?: number,
  type?: number,
) =>
  apiPost<unknown>(`/conversations/${conversationId}/sticker`, {
    stickerId,
    cateId,
    type,
  });

// Bộ reaction nhanh (Zalo style).
export const QUICK_REACTIONS = ["❤️", "👍", "😆", "😮", "😢", "😡"];

/** Preview ngắn cho tin được trả lời (parse quote JSON defensively). */
export function quotePreview(quote: unknown): { sender: string; text: string } | null {
  if (!quote) return null;
  let q: Record<string, unknown> | null = null;
  if (typeof quote === "string") {
    try {
      q = JSON.parse(quote);
    } catch {
      return { sender: "", text: quote };
    }
  } else if (typeof quote === "object") {
    q = quote as Record<string, unknown>;
  }
  if (!q) return null;

  const sender =
    (q.senderName as string) ||
    (q.fromName as string) ||
    (q.ownerName as string) ||
    "";
  const rawText =
    (q.text as string) ||
    (q.content as string) ||
    (q.msg as string) ||
    (q.title as string) ||
    "";
  let text = typeof rawText === "string" ? rawText.trim() : "";
  if (text.length > 90) text = text.slice(0, 90) + "…";

  if (!text) {
    const t = String(q.msgType || q.attach || "").toLowerCase();
    if (t.includes("image") || t.includes("photo")) text = "📷 Hình ảnh";
    else if (t.includes("voice") || t.includes("audio")) text = "🎤 Tin thoại";
    else if (t.includes("video")) text = "🎥 Video";
    else if (t.includes("sticker")) text = "🎴 Sticker";
    else if (t.includes("file")) text = "📎 Tệp";
    else text = "(tin nhắn)";
  }
  return { sender, text };
}
