// Fetchers + types cho tính năng Nhân viên (RBAC). Khớp /api/v1/* backend.
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/lib/api";

export type Role = "owner" | "admin" | "member";
export type DeptRole = "leader" | "deputy" | "member";

export interface StaffPermissionGroup {
  id: string;
  name: string;
  isSystem: boolean;
}
export interface StaffDepartmentMember {
  departmentId: string;
  deptRole: DeptRole;
  department: { id: string; name: string; path: string | null };
}
export interface StaffNick {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  zaloUid: string | null;
  status: string | null;
}
export interface StaffUser {
  id: string;
  email: string;
  fullName: string | null;
  role: Role | string;
  permissionGroupId: string | null;
  permissionGroup: StaffPermissionGroup | null;
  departmentMember: StaffDepartmentMember | null;
  maxPrivacyNicks: number;
  internalContactZaloAccountId: string | null;
  internalContactNick: StaffNick | null;
  isActive: boolean;
}

export interface StaffFilters {
  q?: string;
  departmentId?: string;
  permissionGroupId?: string;
}

export const getStaff = (f: StaffFilters = {}) =>
  apiGet<{ users: StaffUser[] }>("/rbac/users", {
    q: f.q || undefined,
    departmentId: f.departmentId || undefined,
    permissionGroupId: f.permissionGroupId || undefined,
  });

export const createStaff = (input: {
  email: string;
  fullName: string;
  password: string;
  role?: "admin" | "member";
}) => apiPost<StaffUser>("/users", input);

export const updateStaff = (
  id: string,
  input: { fullName?: string; role?: string; isActive?: boolean },
) => apiPut<StaffUser>(`/users/${id}`, input);

export const deleteStaff = (id: string) =>
  apiDelete<unknown>(`/users/${id}`);

export const resetStaffPassword = (id: string, password: string) =>
  apiPut<unknown>(`/users/${id}/password`, { password });

export const assignPermissionGroup = (
  id: string,
  permissionGroupId: string | null,
) =>
  apiPatch<unknown>(`/rbac/users/${id}/permission-group`, { permissionGroupId });

// ── Phòng ban + Nhóm quyền (chỉ đọc để gán) ──────────────────────────────────
interface TreeNode {
  id: string;
  name: string;
  isSystem?: boolean;
  path?: string | null;
  children?: TreeNode[];
}

function flatten(
  nodes: TreeNode[] | undefined,
  depth = 0,
  out: (TreeNode & { depth: number })[] = [],
): (TreeNode & { depth: number })[] {
  for (const n of nodes ?? []) {
    out.push({ ...n, depth });
    if (n.children?.length) flatten(n.children, depth + 1, out);
  }
  return out;
}

export interface FlatGroup {
  id: string;
  name: string;
  isSystem: boolean;
}
export const getPermissionGroups = async (): Promise<FlatGroup[]> => {
  const { tree } = await apiGet<{ tree: TreeNode[] }>("/permission-groups");
  return flatten(tree).map((g) => ({
    id: g.id,
    name: g.name,
    isSystem: !!g.isSystem,
  }));
};

export interface FlatDepartment {
  id: string;
  name: string;
  depth: number;
}
export const getDepartments = async (): Promise<FlatDepartment[]> => {
  const { tree } = await apiGet<{ tree: TreeNode[] }>("/departments");
  return flatten(tree).map((d) => ({ id: d.id, name: d.name, depth: d.depth }));
};

export const addDepartmentMember = (
  departmentId: string,
  userId: string,
  deptRole: DeptRole = "member",
) =>
  apiPost<unknown>(`/departments/${departmentId}/members`, { userId, deptRole });

export const removeDepartmentMember = (departmentId: string, userId: string) =>
  apiDelete<unknown>(`/departments/${departmentId}/members/${userId}`);

// Tạo các nhóm quyền mặc định (khi org chưa seed) — admin endpoint.
export const seedDefaultGroups = () =>
  apiPost<unknown>("/admin/rbac/seed-default-groups", {});

// ── Phòng ban (CRUD cây) ─────────────────────────────────────────────────────
export interface DepartmentNode {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  memberCount: number;
  children: DepartmentNode[];
}
export const getDepartmentTree = () =>
  apiGet<{ tree: DepartmentNode[] }>("/departments");
export const createDepartment = (input: { name: string; parentId?: string | null }) =>
  apiPost<DepartmentNode>("/departments", input);
export const updateDepartment = (
  id: string,
  input: { name?: string; parentId?: string | null },
) => apiPatch<DepartmentNode>(`/departments/${id}`, input);
export const deleteDepartment = (id: string) =>
  apiDelete<unknown>(`/departments/${id}`);

// ── Nhóm quyền (CRUD + ma trận grants) ───────────────────────────────────────
export type Grants = Record<string, Record<string, boolean>>;
export interface PermGroupNode {
  id: string;
  name: string;
  parentId: string | null;
  isSystem: boolean;
  displayOrder: number;
  grants: Grants;
  memberCount: number;
  children: PermGroupNode[];
}
export const getPermissionGroupTree = () =>
  apiGet<{ tree: PermGroupNode[] }>("/permission-groups");
export const getPermissionGroupDetail = (id: string) =>
  apiGet<{ group: PermGroupNode }>(`/permission-groups/${id}`);
export interface PermMeta {
  resources: string[];
  actions: string[];
  resourceActions: Record<string, string[]>;
}
export const getPermissionMeta = () =>
  apiGet<PermMeta>("/permission-groups/meta");
export const createPermissionGroup = (input: {
  name: string;
  parentId?: string | null;
  grants?: Grants;
}) => apiPost<{ id: string; name: string }>("/permission-groups", input);
export const updatePermissionGroup = (
  id: string,
  input: { name?: string; grants?: Grants; parentId?: string | null },
) => apiPatch<unknown>(`/permission-groups/${id}`, input);
export const deletePermissionGroup = (id: string) =>
  apiDelete<unknown>(`/permission-groups/${id}`);

// Nhãn tiếng Việt cho ma trận quyền.
export const RESOURCE_LABELS: Record<string, string> = {
  department: "Phòng ban",
  user: "Người dùng",
  permission_group: "Nhóm quyền",
  conversation: "Hội thoại",
  contact: "Khách hàng",
  friend: "Bạn Zalo",
  customer_list: "Danh sách KH",
  broadcast: "Gửi hàng loạt",
  sequence: "Chuỗi tự động",
  trigger: "Kích hoạt (trigger)",
  block: "Khối nội dung",
  zalo_account: "Nick Zalo",
  webhook: "Webhook",
  engagement_score: "Điểm tương tác",
  audit_log: "Nhật ký",
  settings: "Cài đặt",
};
export const ACTION_LABELS: Record<string, string> = {
  access: "Truy cập",
  create: "Tạo",
  edit: "Sửa",
  delete: "Xoá",
  approve: "Duyệt",
  pay: "Thanh toán",
  view_all: "Xem tất cả",
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "👑 Chủ tổ chức",
  admin: "🛠️ Quản trị",
  member: "👤 Nhân viên",
};
export const DEPT_ROLE_LABELS: Record<string, string> = {
  leader: "Trưởng phòng",
  deputy: "Phó phòng",
  member: "Thành viên",
};
