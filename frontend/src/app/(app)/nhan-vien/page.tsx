"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Building2,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  addDepartmentMember,
  assignPermissionGroup,
  createStaff,
  deleteStaff,
  getDepartments,
  getPermissionGroups,
  getStaff,
  removeDepartmentMember,
  resetStaffPassword,
  seedDefaultGroups,
  updateStaff,
  DEPT_ROLE_LABELS,
  ROLE_LABELS,
  type DeptRole,
  type StaffUser,
} from "@/lib/staff";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectItem } from "@/components/ui/select";
import { Chip, Modal, inputCls, labelCls, initials } from "@/components/staff/ui";
import { DepartmentsTab } from "@/components/staff/departments-tab";
import { PermissionGroupsTab } from "@/components/staff/permission-groups-tab";

type Tab = "staff" | "dept" | "groups";

export default function StaffPage() {
  const { user } = useAuth();
  const canManage = user?.role === "owner" || user?.role === "admin";
  const [tab, setTab] = React.useState<Tab>("staff");

  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading, mutate } = useSWR(
    canManage ? ["staff", debounced] : null,
    () => getStaff({ q: debounced }),
  );
  const users = data?.users ?? [];
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<StaffUser | null>(null);

  if (!canManage) {
    return (
      <div className="grid h-svh place-items-center text-center text-muted-foreground">
        <div>
          <ShieldCheck className="mx-auto mb-2 size-8" />
          <p className="text-sm">Chỉ chủ tổ chức / quản trị mới quản lý nhân viên.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col">
      {/* Header + tabs */}
      <header className="border-b px-6 pt-4">
        <div className="mb-3">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <UserCog className="size-5" /> Nhân viên &amp; Phân quyền
          </h1>
          <p className="text-xs text-muted-foreground">
            Người dùng · Phòng ban · Nhóm quyền (RBAC)
          </p>
        </div>
        <div className="flex gap-1">
          <TabBtn active={tab === "staff"} onClick={() => setTab("staff")} icon={Users}>
            Nhân viên
          </TabBtn>
          <TabBtn active={tab === "dept"} onClick={() => setTab("dept")} icon={Building2}>
            Phòng ban
          </TabBtn>
          <TabBtn
            active={tab === "groups"}
            onClick={() => setTab("groups")}
            icon={ShieldCheck}
          >
            Nhóm quyền
          </TabBtn>
        </div>
      </header>

      {tab === "dept" ? (
        <div className="flex-1 overflow-auto px-6 py-4">
          <DepartmentsTab />
        </div>
      ) : tab === "groups" ? (
        <div className="flex-1 overflow-auto px-6 py-4">
          <PermissionGroupsTab />
        </div>
      ) : (
        <>
          {/* Search + thêm NV */}
          <div className="flex items-center justify-between gap-3 border-b px-6 py-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm theo tên hoặc email..."
                className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Thêm nhân viên
            </Button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-20 text-center text-sm text-muted-foreground">
            Chưa có nhân viên nào.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Nhân viên</th>
                  <th className="px-3 py-2 text-left font-medium">Phòng ban</th>
                  <th className="px-3 py-2 text-left font-medium">Chức vụ</th>
                  <th className="px-3 py-2 text-left font-medium">Nhóm quyền</th>
                  <th className="px-3 py-2 text-left font-medium">Nick nội bộ</th>
                  <th className="px-3 py-2 text-left font-medium">Trạng thái</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className={cn(
                      "hover:bg-accent/40",
                      !u.isActive && "opacity-60",
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          {u.internalContactNick?.avatarUrl ? (
                            <AvatarImage src={u.internalContactNick.avatarUrl} alt="" />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                            {initials(u.fullName || u.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {u.fullName || "(chưa đặt tên)"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {u.departmentMember ? (
                        <Chip>🏢 {u.departmentMember.department.name}</Chip>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {u.departmentMember &&
                      u.departmentMember.deptRole !== "member" ? (
                        <Chip tone="amber">
                          {DEPT_ROLE_LABELS[u.departmentMember.deptRole]}
                        </Chip>
                      ) : (
                        <span className="text-xs">
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {u.permissionGroup ? (
                        <Chip tone={u.permissionGroup.isSystem ? "indigo" : "slate"}>
                          🛡 {u.permissionGroup.name}
                        </Chip>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {u.internalContactNick ? (
                        <span className="text-xs">
                          {u.internalContactNick.displayName || "(chưa đặt tên)"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {u.isActive ? (
                        <Chip tone="green">🟢 Hoạt động</Chip>
                      ) : (
                        <Chip tone="slate">⚪ Vô hiệu</Chip>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setEditing(u)}
                        className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                        aria-label="Sửa"
                      >
                        <Pencil className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
          </div>
        </>
      )}

      {adding ? (
        <AddDialog
          canCreateAdmin={user?.role === "owner"}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            mutate();
          }}
        />
      ) : null}
      {editing ? (
        <EditDialog
          u={editing}
          currentRole={user?.role || "member"}
          currentUserId={user?.id || ""}
          onClose={() => setEditing(null)}
          onSaved={() => mutate()}
        />
      ) : null}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}

function AddDialog({
  canCreateAdmin,
  onClose,
  onSaved,
}: {
  canCreateAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<"member" | "admin">("member");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (!fullName.trim() || !email.trim() || password.length < 6 || busy) {
      if (password.length < 6) toast.error("Mật khẩu tối thiểu 6 ký tự");
      return;
    }
    setBusy(true);
    try {
      await createStaff({ fullName: fullName.trim(), email: email.trim(), password, role });
      toast.success("Đã thêm nhân viên");
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thêm được");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Thêm nhân viên" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Họ tên</label>
          <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Mật khẩu (≥ 6 ký tự)</label>
          <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Vai trò</label>
          <Select className="w-full" value={role} onValueChange={(v) => setRole(v as "member" | "admin")}>
            <SelectItem value="member">👤 Nhân viên</SelectItem>
            {canCreateAdmin ? <SelectItem value="admin">🛠️ Quản trị</SelectItem> : null}
          </Select>
        </div>
        <Button className="w-full" onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Thêm nhân viên
        </Button>
      </div>
    </Modal>
  );
}

function EditDialog({
  u,
  currentRole,
  currentUserId,
  onClose,
  onSaved,
}: {
  u: StaffUser;
  currentRole: string;
  currentUserId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isOwner = u.role === "owner";
  const isSelf = u.id === currentUserId;
  const [busy, setBusy] = React.useState(false);
  const { data: groups, mutate: mutateGroups } = useSWR("perm-groups", getPermissionGroups);
  const { data: depts } = useSWR("departments", getDepartments);

  const [role, setRole] = React.useState(u.role);
  const [groupId, setGroupId] = React.useState(u.permissionGroupId ?? "");
  const [deptId, setDeptId] = React.useState(u.departmentMember?.departmentId ?? "");
  const [deptRole, setDeptRole] = React.useState<DeptRole>(
    u.departmentMember?.deptRole ?? "member",
  );
  const [newPassword, setNewPassword] = React.useState("");

  async function run(fn: () => Promise<unknown>, ok: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Thao tác thất bại");
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    setBusy(true);
    try {
      // Vai trò / không đụng owner
      if (!isOwner && role !== u.role) {
        await updateStaff(u.id, { role });
      }
      // Nhóm quyền
      if ((groupId || null) !== (u.permissionGroupId || null)) {
        await assignPermissionGroup(u.id, groupId || null);
      }
      // Phòng ban: gỡ membership cũ rồi thêm mới (nếu có)
      const curDept = u.departmentMember;
      const changed =
        (curDept?.departmentId ?? "") !== deptId ||
        (curDept?.deptRole ?? "member") !== deptRole;
      if (changed) {
        if (curDept) await removeDepartmentMember(curDept.departmentId, u.id).catch(() => {});
        if (deptId) await addDepartmentMember(deptId, u.id, deptRole);
      }
      toast.success("Đã lưu");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }

  const groupList = groups ?? [];

  return (
    <Modal title={`Sửa: ${u.fullName || u.email}`} onClose={onClose}>
      <div className="space-y-3">
        {/* Vai trò */}
        <div>
          <label className={labelCls}>Vai trò</label>
          {isOwner ? (
            <p className="text-sm">👑 Chủ tổ chức (không đổi được)</p>
          ) : (
            <Select className="w-full" value={role} onValueChange={setRole}>
              <SelectItem value="member">👤 Nhân viên</SelectItem>
              {currentRole === "owner" ? <SelectItem value="admin">🛠️ Quản trị</SelectItem> : null}
            </Select>
          )}
        </div>

        {/* Nhóm quyền */}
        <div>
          <label className={labelCls}>Nhóm quyền</label>
          {groupList.length === 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Chưa có nhóm quyền.</span>
              <button
                onClick={() =>
                  run(async () => {
                    await seedDefaultGroups();
                    await mutateGroups();
                  }, "Đã tạo nhóm quyền mặc định")
                }
                disabled={busy}
                className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
              >
                Tạo nhóm mặc định
              </button>
            </div>
          ) : (
            <Select className="w-full" value={groupId} onValueChange={setGroupId}>
              <SelectItem value="">— Không gán —</SelectItem>
              {groupList.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.isSystem ? "🛡 " : "⚙️ "}
                  {g.name}
                </SelectItem>
              ))}
            </Select>
          )}
        </div>

        {/* Phòng ban */}
        <div>
          <label className={labelCls}>Phòng ban</label>
          {(depts ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Chưa có phòng ban nào trong tổ chức.
            </p>
          ) : (
            <div className="flex gap-2">
              <Select className="w-full flex-1" value={deptId} onValueChange={setDeptId}>
                <SelectItem value="">— Không thuộc —</SelectItem>
                {(depts ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {" ".repeat(d.depth * 2)}
                    {d.name}
                  </SelectItem>
                ))}
              </Select>
              <Select
                className="w-32"
                value={deptRole}
                onValueChange={(v) => setDeptRole(v as DeptRole)}
                disabled={!deptId}
              >
                <SelectItem value="member">Thành viên</SelectItem>
                <SelectItem value="deputy">Phó phòng</SelectItem>
                <SelectItem value="leader">Trưởng phòng</SelectItem>
              </Select>
            </div>
          )}
        </div>

        {/* Trạng thái hoạt động */}
        {!isOwner && !isSelf ? (
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <span className="text-sm">
              {u.isActive ? "🟢 Đang hoạt động" : "⚪ Đã vô hiệu"}
            </span>
            <button
              onClick={() =>
                run(
                  () => updateStaff(u.id, { isActive: !u.isActive }),
                  u.isActive ? "Đã vô hiệu hoá" : "Đã kích hoạt",
                )
              }
              disabled={busy}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium",
                u.isActive
                  ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                  : "bg-success/15 text-success hover:bg-success/25",
              )}
            >
              {u.isActive ? "Vô hiệu hoá" : "Kích hoạt"}
            </button>
          </div>
        ) : null}

        {/* Đổi mật khẩu */}
        <div>
          <label className={labelCls}>Đặt lại mật khẩu (≥ 6 ký tự)</label>
          <div className="flex gap-2">
            <input
              className={inputCls}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mật khẩu mới"
            />
            <Button
              variant="outline"
              disabled={busy || newPassword.length < 6}
              onClick={() =>
                run(async () => {
                  await resetStaffPassword(u.id, newPassword);
                  setNewPassword("");
                }, "Đã đổi mật khẩu")
              }
            >
              Đổi
            </Button>
          </div>
        </div>

        {/* Lưu + Xoá */}
        <div className="flex items-center gap-2 border-t pt-3">
          <Button className="flex-1" onClick={saveAll} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Lưu thay đổi
          </Button>
          {!isOwner && !isSelf ? (
            <Button
              variant="outline"
              className="text-destructive"
              disabled={busy}
              onClick={() => {
                if (!confirm(`Xoá nhân viên "${u.fullName || u.email}"?`)) return;
                run(async () => {
                  await deleteStaff(u.id);
                  onClose();
                }, "Đã xoá nhân viên");
              }}
            >
              Xoá
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
