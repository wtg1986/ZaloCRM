// Hàm gọi API theo từng tài nguyên — dùng trong component qua SWR/React.
import { apiGet, apiPost, apiPut, apiUpload } from "@/lib/api";
import {
  actionMessage,
  callInfo,
  cardInfo,
  displayText,
  isRecallEvent,
  linkInfo,
  pollInfo,
} from "@/lib/media";
import type {
  ChatMessage,
  Conversation,
  ConversationCounts,
  ConversationListResponse,
  MessageListResponse,
  ZaloAccount,
} from "@/lib/types";

export const getZaloAccounts = () =>
  apiGet<ZaloAccount[]>("/zalo-accounts");

// Tạo nick mới (status qr_pending) — trả về account có id để login QR.
export const createZaloAccount = (input: {
  displayName?: string;
  proxyUrl?: string;
}) => apiPost<ZaloAccount>("/zalo-accounts", input);

// Bắt đầu đăng nhập QR — QR + trạng thái về qua socket room account:<id>.
export const loginZaloAccount = (id: string) =>
  apiPost<{ message: string }>(`/zalo-accounts/${id}/login`, {});

// Đồng bộ lịch sử (backfill): bạn bè + nhóm + tin DM gần đây từ Zalo về DB.
export const syncHistory = (id: string) =>
  apiPost<{ success?: boolean } & Record<string, unknown>>(
    `/zalo-accounts/${id}/sync-history`,
    {},
  );

// Kết nối lại từ session đã lưu (không cần QR nếu session còn sống).
export const reconnectAccount = (id: string) =>
  apiPost<{ message?: string }>(`/zalo-accounts/${id}/reconnect`, {});

// Thông tin tổ chức (tên, múi giờ) — cho phần Cài đặt tổ chức.
export interface OrgInfo {
  id: string;
  name: string;
  timezone: string;
  slug?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  plan?: string;
  createdAt?: string;
}
export const getOrganization = () => apiGet<OrgInfo>("/organization");
export const updateOrganization = (input: {
  name?: string;
  timezone?: string;
  slug?: string | null;
  brandColor?: string | null;
  logoUrl?: string | null;
}) => apiPut<OrgInfo>("/organization", input);

/** Kiểm tra subdomain còn trống (debounce ở UI). */
export const checkOrgSlug = (slug: string) =>
  apiGet<{ available: boolean; reason?: string }>("/organization/slug-available", { slug });

/** Upload logo tổ chức (multipart) — trả về URL công khai đã lưu. */
export const uploadOrgLogo = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return apiUpload<{ logoUrl: string }>("/organization/logo", form);
};

// Gói dịch vụ hiện tại + giới hạn + mức dùng.
export interface PlanInfo {
  plan: string;
  label: string;
  limits: { nicks: number; staff: number; contacts: number };
  usage: { nicks: number; staff: number; contacts: number };
}
export const getPlan = () => apiGet<PlanInfo>("/me/plan");

// Danh sách bạn của 1 nick (cho "Tin nhắn mới").
export interface FriendDto {
  id: string;
  zaloUidInNick: string | null;
  contactId: string | null;
  zaloDisplayName: string | null;
  aliasInNick: string | null;
  zaloAvatarUrl: string | null;
  contact: {
    fullName: string | null;
    crmName: string | null;
    avatarUrl: string | null;
    phone: string | null;
  } | null;
}
export const getFriends = (accountId: string, search?: string) =>
  apiGet<{ friends: FriendDto[]; total: number }>(
    `/zalo-accounts/${accountId}/friends-db`,
    { search, limit: 30 },
  );

// Mở/tạo hội thoại với 1 bạn → trả conversationId để select.
export const openConversation = (input: {
  zaloAccountId: string;
  externalThreadId: string;
  contactId?: string | null;
}) => apiPost<{ id: string; created: boolean }>("/conversations/open", input);

export interface ConversationFilters {
  accountIds?: string[];
  search?: string;
  unread?: boolean;
  unreplied?: boolean;
  stuck?: boolean; // đình trệ
  ready?: boolean; // sẵn sàng (score cao)
  tab?: string;
  threadType?: "user" | "group";
  statusId?: string;
  assignedUserId?: string;
  scoreMin?: number;
  scoreMax?: number;
  relationshipKindAny?: string; // CSV
  tags?: string; // CSV — tag CRM
  zaloLabels?: string; // CSV — nhãn Zalo gốc
  autoTagsAny?: string; // CSV — active,stuck,cold,ready,atrisk,rewarmed,frozen
  engagementPattern?: string; // CSV — hot,champion,stable,cooling,cold
  dateFrom?: string;
  sortMode?: "recent" | "unread-first";
  page?: number;
  limit?: number;
}

export const getConversations = (f: ConversationFilters = {}) =>
  apiGet<ConversationListResponse>("/conversations", {
    accountIds: f.accountIds?.length ? f.accountIds.join(",") : undefined,
    search: f.search,
    unread: f.unread ? "true" : undefined,
    unreplied: f.unreplied ? "true" : undefined,
    stuck: f.stuck ? "true" : undefined,
    ready: f.ready ? "true" : undefined,
    tab: f.tab,
    threadType: f.threadType,
    statusId: f.statusId,
    assignedUserId: f.assignedUserId,
    scoreMin: f.scoreMin,
    scoreMax: f.scoreMax,
    relationshipKindAny: f.relationshipKindAny,
    tags: f.tags,
    zaloLabels: f.zaloLabels,
    autoTagsAny: f.autoTagsAny,
    engagementPattern: f.engagementPattern,
    dateFrom: f.dateFrom,
    sortMode: f.sortMode,
    page: f.page,
    limit: f.limit ?? 50,
  });

// Chi tiết 1 hội thoại (header chat) — luôn tươi, không phụ thuộc snapshot list.
export const getConversation = (id: string) =>
  apiGet<Conversation>(`/conversations/${id}`);

export const getConversationCounts = (accountIds?: string[]) =>
  apiGet<ConversationCounts>("/conversations/counts", {
    accountIds: accountIds?.length ? accountIds.join(",") : undefined,
  });

export const getMessages = (conversationId: string, limit = 50) =>
  apiGet<MessageListResponse>(`/conversations/${conversationId}/messages`, {
    limit,
  });

export interface SendStyle {
  st: "b" | "i" | "u" | "s";
  start: number;
  len: number;
}

export interface SendMention {
  pos: number;
  uid: string;
  len: number;
}

export const sendMessage = (
  conversationId: string,
  content: string,
  opts: {
    replyMessageId?: string;
    styles?: SendStyle[];
    mentions?: SendMention[];
  } = {},
) =>
  apiPost<ChatMessage>(`/conversations/${conversationId}/messages`, {
    content,
    replyMessageId: opts.replyMessageId,
    styles: opts.styles?.length ? opts.styles : undefined,
    mentions: opts.mentions?.length ? opts.mentions : undefined,
  });

// Thành viên nhóm — cho @mention autocomplete.
export interface GroupMember {
  id?: string;
  uid?: string;
  userId?: string;
  zaloUid?: string;
  displayName?: string;
  name?: string;
  zaloName?: string;
  avatar?: string;
  avatarUrl?: string;
}
export const getGroupMembers = (accountId: string, groupId: string) =>
  apiGet<{ members: GroupMember[] }>(
    `/zalo-accounts/${accountId}/groups/${groupId}/members`,
  );

// Avatar/tên người dùng Zalo theo uid (cache DB + SDK) — dùng cho avatar người
// gửi trong group. Ổn định hơn API members (vốn hay rỗng).
export interface GroupMemberProfile {
  displayName?: string;
  zaloName?: string;
  avatar?: string;
}
export const getUserInfoBatch = (uids: string[]) =>
  apiPost<{ users: Record<string, GroupMemberProfile | null> }>(
    "/zalo-user-info/batch",
    { uids },
  );

export const markRead = (conversationId: string) =>
  apiPost<unknown>(`/conversations/${conversationId}/mark-read`, {});

// Gửi ảnh — multipart, gửi thẳng qua Zalo. BE phát chat:message để thread cập nhật.
export const uploadImages = (conversationId: string, files: File[]) => {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  return apiUpload<{ success: boolean; count: number }>(
    `/conversations/${conversationId}/upload-image`,
    form,
  );
};

// Gửi tệp (ảnh/video/file) qua route attachments — có caption.
export const uploadAttachments = (
  conversationId: string,
  files: File[],
  caption = "",
) => {
  const form = new FormData();
  if (caption) form.append("caption", caption);
  for (const f of files) form.append("files", f);
  return apiUpload<unknown>(
    `/conversations/${conversationId}/attachments`,
    form,
  );
};

// Helper hiển thị tên ưu tiên CRM name → contact name → thread name.
export function conversationTitle(c: Conversation): string {
  return (
    c.contact?.crmName ||
    c.contact?.fullName ||
    c.threadName ||
    "Khách chưa rõ tên"
  );
}

export function conversationAvatarText(c: Conversation): string {
  const name = conversationTitle(c).trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function lastMessagePreview(c: Conversation): string {
  const m = c.messages?.[0];
  if (!m) return "Chưa có tin nhắn";
  if (isRecallEvent(m as unknown as ChatMessage)) return "Tin nhắn đã được thu hồi";
  const prefix = m.senderType === "self" ? "Bạn: " : "";
  switch (m.contentType) {
    case "image":
      return prefix + "[Hình ảnh]";
    case "video":
      return prefix + "[Video]";
    case "voice":
    case "audio":
      return prefix + "[Tin nhắn thoại]";
    case "gif":
      return prefix + "[GIF]";
    case "file":
      return prefix + "[Tệp]";
    case "sticker":
      return prefix + "[Sticker]";
    case "call": {
      const c = callInfo(m as unknown as ChatMessage);
      return prefix + (c ? `📞 ${c.label}` : "[Cuộc gọi]");
    }
    case "poll": {
      const p = pollInfo(m as unknown as ChatMessage);
      return prefix + (p ? `📊 ${p.header}${p.question ? `: ${p.question}` : ""}` : "[Bình chọn]");
    }
    case "link": {
      const l = linkInfo(m as unknown as ChatMessage);
      return prefix + (l ? `🔗 ${l.title}` : "[Liên kết]");
    }
    case "contact_card": {
      const c = cardInfo(m as unknown as ChatMessage);
      return prefix + (c?.title || "[Thẻ]");
    }
    default: {
      const act = actionMessage(m as unknown as ChatMessage);
      if (act) return prefix + `${act.icon} ${act.text}`;
      return prefix + displayText(m.content);
    }
  }
}
