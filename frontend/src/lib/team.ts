// Quản lý nhân viên (users) — mời, đổi vai trò, vô hiệu hoá. owner/admin mới có quyền.
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";

export interface TeamUser {
  id: string;
  email: string;
  fullName: string | null;
  role: "owner" | "admin" | "member" | string;
  isActive: boolean;
  team?: { id: string; name: string } | null;
}

export const getUsers = () => apiGet<{ users: TeamUser[] }>("/users");

export const createUser = (input: {
  email: string;
  fullName: string;
  password: string;
  role?: "admin" | "member";
}) => apiPost<TeamUser>("/users", input);

export const updateUser = (
  id: string,
  input: { fullName?: string; role?: string; isActive?: boolean },
) => apiPut<TeamUser>(`/users/${id}`, input);

export const deleteUser = (id: string) =>
  apiDelete<unknown>(`/users/${id}`);

// Đổi mật khẩu của CHÍNH MÌNH (xác thực mật khẩu hiện tại) — mọi role.
export const changeMyPassword = (currentPassword: string, newPassword: string) =>
  apiPut<{ ok: boolean }>("/me/password", { currentPassword, newPassword });
