// Kiểu dữ liệu khớp hợp đồng API backend ZaloCRM (/api/v1/*).
// Chỉ khai báo field frontend dùng — backend trả nhiều hơn (bỏ qua an toàn).

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  role: "owner" | "admin" | "member" | string;
  orgId: string;
  // RBAC: quyền hiệu lực (từ /profile). fullAccess=true (owner/admin) → mọi quyền.
  fullAccess?: boolean;
  grants?: Record<string, Record<string, boolean>>;
  permissionGroupName?: string | null;
}

export interface ZaloAccount {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  zaloUid?: string | null;
  status: string;
  liveStatus?: string;
}

export type ContentType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "sticker"
  | "link"
  | "card"
  | string;

export type SenderType = "self" | "contact" | "system" | string;

export interface ChatMessage {
  id: string;
  zaloMsgId?: string | null;
  zaloMsgIdNum?: string | null;
  senderUid?: string | null;
  senderName?: string | null;
  content: string;
  contentType: ContentType;
  senderType: SenderType;
  sentAt: string;
  isDeleted?: boolean;
  editedAt?: string | null;
  deliveredAt?: string | null;
  seenAt?: string | null;
  originalContent?: string | null;
  attachments?: unknown;
  quote?: unknown;
  albumKey?: string | null;
  reactions?: { emoji: string; reactorId: string | null }[];
  // AI Agent 2026-06-16 — tin do AI gửi (id agent) → FE gắn nhãn "AI".
  sentByAgentId?: string | null;
}

export interface ContactLite {
  id: string;
  fullName: string | null;
  crmName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  zaloUid?: string | null;
  leadScore?: number | null;
  assignedUserId?: string | null;
}

export interface Conversation {
  id: string;
  externalThreadId: string | null;
  zaloAccountId: string;
  contactId: string | null;
  threadType: "user" | "group" | string;
  tab?: string | null;
  threadName?: string | null;
  threadAvatar?: string | null;
  unreadCount: number;
  lastMessageAt: string | null;
  isPinned?: boolean;
  isReplied?: boolean;
  // Enrich từ Friend (per-pair) — hiển thị chip ở list/header.
  statusName?: string | null;
  statusColor?: string | null;
  leadScore?: number | null;
  autoTags?: string[] | null;
  crmTagsPerNick?: string[] | null;
  zaloLabels?: unknown;
  stuckSince?: string | null;
  // Detail endpoint trả friendship lồng (per-pair) — header chat dùng.
  friendship?: {
    id?: string;
    relationshipKind?: string;
    friendshipStatus?: string;
    leadScore?: number;
    totalInbound?: number;
    totalOutbound?: number;
    crmTagsPerNick?: string[];
    autoTags?: string[];
    statusRef?: { id: string; name: string; color: string | null } | null;
  } | null;
  contact: ContactLite | null;
  zaloAccount: Pick<ZaloAccount, "id" | "displayName" | "avatarUrl"> | null;
  // AI Agent 2026-06-16 — trạng thái autopilot cho hội thoại này.
  aiState?: "off" | "armed" | "active" | "paused" | string | null;
  aiAgentId?: string | null;
  aiPausedReason?: string | null;
  aiAgent?: { id: string; name: string; avatarUrl?: string | null } | null;
  // List trả kèm tin cuối (preview); endpoint chi tiết /:id KHÔNG kèm → optional.
  messages?: Pick<
    ChatMessage,
    "id" | "content" | "contentType" | "senderType" | "sentAt"
  >[];
}

export interface Paginated {
  total: number;
  page: number;
  limit: number;
}

export interface ConversationListResponse extends Paginated {
  conversations: Conversation[];
}

export interface MessageListResponse extends Paginated {
  messages: ChatMessage[];
}

export interface ConversationCounts {
  all?: number;
  unread?: number;
  unreplied?: number;
  [k: string]: number | undefined;
}

// Payload socket `chat:message`
export interface ChatMessageEvent {
  accountId: string;
  conversationId: string;
  message: ChatMessage;
}
