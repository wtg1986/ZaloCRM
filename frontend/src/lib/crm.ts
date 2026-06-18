// Fetchers + types cho các domain CRM ngoài chat: contacts, appointments,
// dashboard (KPI/pipeline/sources), broadcasts. Khớp /api/v1/* backend.
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/lib/api";

// ── Contacts ────────────────────────────────────────────────────────────────
export interface Contact {
  id: string;
  fullName: string | null;
  crmName: string | null;
  phone: string | null;
  email?: string | null;
  avatarUrl: string | null;
  leadScore: number | null;
  displayLeadScore?: number | null;
  status: string | null;
  statusId: string | null;
  source: string | null;
  lastActivity: string | null;
  createdAt: string;
  assignedUser?: { id: string; fullName: string | null } | null;
  _count?: { conversations: number; appointments?: number };
}

// Pipeline stage động (Status table) — cột Kanban.
export interface PipelineStatus {
  id: string;
  name: string;
  order: number;
  color: string | null;
  isTerminal: boolean;
  isDefault: boolean;
}
export const getStatuses = () =>
  apiGet<{ statuses: PipelineStatus[] }>("/settings/statuses");

export const createStatus = (input: {
  name: string;
  color?: string;
  order?: number;
  isDefault?: boolean;
  isTerminal?: boolean;
}) => apiPost<PipelineStatus>("/settings/statuses", input);

export const updateStatus = (
  id: string,
  input: { name?: string; color?: string; order?: number; isDefault?: boolean; isTerminal?: boolean },
) => apiPut<PipelineStatus>(`/settings/statuses/${id}`, input);

export const deleteStatus = (id: string) =>
  apiDelete<unknown>(`/settings/statuses/${id}`);

export const setContactStatus = (contactId: string, statusId: string | null) =>
  apiPut<Contact>(`/contacts/${contactId}`, { statusId });

export interface ContactListResponse {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
}

export type ContactSort = "recent" | "name" | "score" | "created" | "oldest";
export interface ContactQuery {
  search?: string;
  page?: number;
  limit?: number;
  hasZalo?: "true" | "false" | "unknown";
  statusId?: string;
  assignedUserId?: string;
  unassigned?: "true";
  source?: string;
  scoreMin?: number;
  scoreMax?: number;
  dateFrom?: string;
  dateTo?: string;
  sort?: ContactSort;
}
export const getContacts = (params: ContactQuery) =>
  apiGet<ContactListResponse>("/contacts", {
    search: params.search || undefined,
    page: params.page,
    limit: params.limit ?? 30,
    hasZalo: params.hasZalo || undefined,
    statusId: params.statusId || undefined,
    assignedUserId: params.assignedUserId || undefined,
    unassigned: params.unassigned || undefined,
    source: params.source || undefined,
    scoreMin: params.scoreMin,
    scoreMax: params.scoreMax,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    sort: params.sort || undefined,
  });

// ── Phân khúc lưu sẵn (saved filter presets) ─────────────────────────────────
export interface FilterPreset {
  id: string;
  name: string;
  emoji: string;
  filterJson: ContactQuery;
}
export const getFilterPresets = () =>
  apiGet<{ presets: FilterPreset[] }>("/filter-presets");
export const createFilterPreset = (input: {
  name: string;
  emoji?: string;
  filterJson: ContactQuery;
}) => apiPost<FilterPreset>("/filter-presets", input);
export const deleteFilterPreset = (id: string) =>
  apiDelete<unknown>(`/filter-presets/${id}`);

// ── Trùng lặp + gộp khách ────────────────────────────────────────────────────
export interface DuplicateContact {
  id: string;
  fullName: string | null;
  crmName: string | null;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  source: string | null;
  createdAt: string;
  assignedUser?: { id: string; fullName: string | null } | null;
  statusRef?: { id: string; name: string; color: string | null } | null;
  _count?: { conversations: number; appointments: number; friends: number };
}
export interface DuplicateGroup {
  id: string;
  contacts: DuplicateContact[];
}
export const getDuplicates = (page = 1) =>
  apiGet<{ groups: DuplicateGroup[]; total: number }>("/contacts/duplicates", {
    page,
    limit: 20,
  });
export const mergeContactInto = (sourceId: string, parentContactId: string) =>
  apiPost<unknown>(`/contacts/${sourceId}/merge-into`, { parentContactId });
export const dismissDuplicate = (groupId: string) =>
  apiPost<unknown>(`/contacts/duplicates/${groupId}/dismiss`, {});

// CRUD khách hàng (thủ công, ngoài luồng auto từ Zalo).
export interface ContactInput {
  fullName?: string;
  crmName?: string;
  phone?: string;
  email?: string;
  source?: string;
  address?: string;
  company?: string;
  gender?: string;
  notes?: string;
  statusId?: string | null;
  assignedUserId?: string | null;
}
export const createContact = (input: ContactInput) =>
  apiPost<Contact>("/contacts", input);
export const updateContact = (id: string, input: ContactInput) =>
  apiPut<Contact>(`/contacts/${id}`, input);
export const deleteContact = (id: string) =>
  apiDelete<unknown>(`/contacts/${id}`);

export interface ContactStats {
  total?: number;
  withZalo?: number;
  [k: string]: number | undefined;
}
export const getContactStats = () => apiGet<ContactStats>("/contacts/stats");

export interface ContactDetail extends Contact {
  email: string | null;
  gender: string | null;
  address: string | null;
  company: string | null;
  zaloUid: string | null;
  priorityScore: number | null;
  engagementScore: number | null;
  engagementTrend: number | null;
  engagementPattern: string | null;
  tags: string[];
  assignedUser?: { id: string; fullName: string | null; email: string } | null;
  appointments?: {
    id: string;
    appointmentDate: string;
    appointmentTime: string | null;
    title: string | null;
    status: string;
  }[];
  friends?: ContactNick[];
}

// 1 nick (friendship) gắn với khách — cho tab "Quan hệ".
export interface ContactNick {
  id: string;
  zaloUidInNick: string | null;
  zaloDisplayName: string | null;
  aliasInNick: string | null;
  relationshipKind: string | null;
  friendshipStatus: string | null;
  leadScore: number | null;
  zaloAvatarUrl: string | null;
  crmTagsPerNick: string[];
  zaloLabels?: string[];
  totalInbound?: number;
  totalOutbound?: number;
  statusRef?: { name: string; color: string | null } | null;
  zaloAccount?: {
    id: string;
    displayName: string | null;
    avatarUrl?: string | null;
    owner?: { fullName: string | null } | null;
  } | null;
}

// đã kết bạn? Zalo lưu 'accepted' (không phải 'friend').
export function isFriend(status: string | null | undefined): boolean {
  return status === "accepted" || status === "friend";
}
export const getContact = (id: string) =>
  apiGet<ContactDetail>(`/contacts/${id}`);

export interface ContactNote {
  id: string;
  body: string;
  createdAt: string;
  author?: { id: string; fullName: string | null } | null;
}
export const getContactNotes = (contactId: string) =>
  apiGet<{ notes: ContactNote[]; total: number }>(
    `/contacts/${contactId}/notes`,
  );
export const addContactNote = (contactId: string, body: string) =>
  apiPost<ContactNote>(`/contacts/${contactId}/notes`, { body });

// Engagement timeline (heatmap 4 tuần). dailyIntensity 0..100 → mức đậm ô.
export interface EngagementDay {
  date: string;
  inboundMsgCount: number;
  outboundMsgCount: number;
  reactionCount: number;
  mediaShareCount: number;
  voiceMsgCount: number;
  callCount: number;
  missedCallCount: number;
  quoteReplyCount: number;
  customerInitiated: boolean;
  dailyIntensity: number;
}
export interface EngagementBreakdown {
  totalInbound: number;
  totalOutbound: number;
  totalReactions: number;
  totalMedia: number;
  totalVoice: number;
  totalCalls: number;
  totalMissedCalls: number;
  totalQuoteReplies: number;
  daysInitiated: number;
  replyRate: number;
  reactionRate: number;
}
export interface EngagementTimeline {
  timeline: EngagementDay[];
  pattern: string | null;
  trend: number | null;
  score: number | null;
  breakdown: EngagementBreakdown | null;
}
export const getEngagementTimeline = (contactId: string, days = 28) =>
  apiGet<EngagementTimeline>(
    `/contacts/${contactId}/engagement-timeline`,
    { days },
  );

// Gán khách (và hội thoại của khách) cho 1 nhân viên — assignedUserId trên Contact.
export const assignContact = (contactId: string, assignedUserId: string | null) =>
  apiPut<Contact>(`/contacts/${contactId}`, { assignedUserId });

// Tách 1 nick (friend) thành KH Cha riêng.
export const promoteFriendToParent = (friendId: string) =>
  apiPost<unknown>(`/friends/${friendId}/promote-to-parent`, {});

// ── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardKpi {
  messagesToday: number;
  messagesUnreplied: number;
  messagesUnread: number;
  appointmentsToday: number;
  newContactsThisWeek: number;
  totalContacts: number;
}
export const getKpi = () => apiGet<DashboardKpi>("/dashboard/kpi");

export interface GroupCount {
  status?: string | null;
  source?: string | null;
  count: number;
}
export const getPipeline = () =>
  apiGet<{ data: GroupCount[] }>("/dashboard/pipeline");
export const getSources = () =>
  apiGet<{ data: GroupCount[] }>("/dashboard/sources");

// Hiệu suất nhân viên (mặc định 30 ngày).
export interface TeamMember {
  userId: string;
  fullName: string;
  messagesSent: number;
  contactsConverted: number;
  appointmentsCompleted: number;
  avgResponseTime: number | null; // giây
}
export const getTeamPerformance = () =>
  apiGet<{ users: TeamMember[] }>("/analytics/team-performance");

// Phễu chuyển đổi.
export interface FunnelStage {
  status: string;
  count: number;
  rate: number; // % tổng đạt tới stage
}
export const getConversionFunnel = () =>
  apiGet<{
    stages: FunnelStage[];
    totalContacts: number;
    avgConversionDays: number | null;
  }>("/analytics/conversion-funnel");

// ── Appointments ─────────────────────────────────────────────────────────────
export interface Appointment {
  id: string;
  appointmentDate: string;
  appointmentTime: string | null;
  title: string | null;
  durationMin: number;
  location: string | null;
  type: string | null;
  notes: string | null;
  status: string;
  source: string | null;
  conversationId: string | null;
  contact: {
    id: string;
    fullName: string | null;
    phone: string | null;
    avatarUrl: string | null;
    friends?: { zaloAvatarUrl: string | null; zaloDisplayName: string | null }[];
  } | null;
  assignedUser?: { id: string; fullName: string | null } | null;
}

export interface AppointmentListResponse {
  appointments: Appointment[];
  total: number;
  page: number;
  limit: number;
  counts: Record<string, number>;
}

export const getAppointments = (params: {
  status?: string;
  page?: number;
  limit?: number;
}) =>
  apiGet<AppointmentListResponse>("/appointments", {
    status: params.status,
    page: params.page,
    limit: params.limit ?? 50,
  });

export interface CreateAppointmentInput {
  contactId: string;
  appointmentDate: string; // ISO date (yyyy-mm-dd)
  appointmentTime?: string; // HH:mm
  title?: string;
  location?: string;
  notes?: string;
  durationMin?: number;
}
export const createAppointment = (input: CreateAppointmentInput) =>
  apiPost<Appointment>("/appointments", input);

export const updateAppointmentStatus = (id: string, status: string) =>
  apiPatch<Appointment>(`/appointments/${id}/status`, { status });

// ── Broadcasts ───────────────────────────────────────────────────────────────
export interface Broadcast {
  id: string;
  name: string;
  description: string | null;
  status?: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  createdBy?: { id: string; fullName: string | null } | null;
}
export const getBroadcasts = () =>
  apiGet<{ broadcasts: Broadcast[] }>("/automation/broadcasts");

// Tạo block nội dung (send_message) — bước 1 trước khi tạo chiến dịch.
export const createSendMessageBlock = (name: string, textVariants: string[]) =>
  apiPost<{ id: string }>("/automation/blocks", {
    name,
    actionType: "send_message",
    content: { textVariants },
  });

export interface SegmentSpec {
  kind: "manual" | "filter" | "customer-list";
  contactIds?: string[];
  criteria?: Record<string, unknown>;
  listId?: string;
}

export const createBroadcast = (input: {
  name: string;
  blockId: string;
  segmentSpec: SegmentSpec;
  scheduleKind?: "now" | "scheduled";
  scheduledAt?: string | null;
  description?: string;
}) => apiPost<Broadcast>("/automation/broadcasts", input);

const bcAction = (id: string, action: string) =>
  apiPost<unknown>(`/automation/broadcasts/${id}/${action}`, {});
export const startBroadcast = (id: string) => bcAction(id, "start");
export const pauseBroadcast = (id: string) => bcAction(id, "pause");
export const resumeBroadcast = (id: string) => bcAction(id, "resume");
export const cancelBroadcast = (id: string) => bcAction(id, "cancel");
