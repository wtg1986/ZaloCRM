// Thao tác Zalo trên 1 hội thoại: kết bạn, thu hồi/huỷ KB, gửi danh thiếp,
// gắn nhãn Zalo gốc. Các op friend/label gọi live SDK → cần nick đang kết nối.
import { apiGet, apiPost, apiDelete } from "@/lib/api";

// ── Friend ───────────────────────────────────────────────────────────────────
export const sendFriendRequest = (
  accountId: string,
  userId: string,
  message = "",
) =>
  apiPost<unknown>(`/zalo-accounts/${accountId}/friends/requests`, {
    userId,
    message,
  });

export const recallFriendRequest = (accountId: string, userId: string) =>
  apiDelete<unknown>(`/zalo-accounts/${accountId}/friends/requests/${userId}`);

export const unfriend = (accountId: string, userId: string) =>
  apiDelete<unknown>(`/zalo-accounts/${accountId}/friends/${userId}`);

// ── Gửi danh thiếp (contact card) ──────────────────────────────────────────────
export const sendCard = (conversationId: string, contactId: string) =>
  apiPost<unknown>(`/conversations/${conversationId}/card`, { contactId });

// ── Nhãn Zalo gốc ─────────────────────────────────────────────────────────────
export interface ZaloLabel {
  id: number;
  text: string;
  color?: string | null;
}
export const getZaloLabels = (accountId: string) =>
  apiGet<{ labels: ZaloLabel[] }>(`/zalo-accounts/${accountId}/labels`);

export const assignZaloLabel = (
  accountId: string,
  threadId: string,
  labelId: number | null,
) =>
  apiPost<unknown>(`/zalo-accounts/${accountId}/labels/assign-thread`, {
    threadId,
    labelId,
  });
