"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, UserPlus, X } from "lucide-react";
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
  type TeamUser,
} from "@/lib/team";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const ROLE_LABEL: Record<string, string> = {
  owner: "Chủ tổ chức",
  admin: "Quản trị",
  member: "Nhân viên",
};

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export function TeamManager() {
  const { user } = useAuth();
  const canManage = user?.role === "owner" || user?.role === "admin";
  const { data, isLoading, mutate } = useSWR(
    canManage ? "team-users" : null,
    getUsers,
  );
  const [adding, setAdding] = React.useState(false);
  const users = data?.users ?? [];

  if (!canManage) return null;

  async function remove(u: TeamUser) {
    if (!confirm(`Xoá nhân viên ${u.fullName || u.email}?`)) return;
    try {
      await deleteUser(u.id);
      await mutate();
      toast.success("Đã xoá nhân viên");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không xoá được");
    }
  }

  async function toggleActive(u: TeamUser) {
    try {
      await updateUser(u.id, { isActive: !u.isActive });
      await mutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Lỗi cập nhật");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">
          Nhân viên {data ? `(${users.length})` : ""}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Thêm nhân viên
        </Button>
      </CardHeader>
      <CardContent>
        {adding ? (
          <InviteForm
            onClose={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              mutate();
            }}
            canCreateAdmin={user?.role === "owner"}
          />
        ) : null}

        {isLoading ? (
          <div className="grid place-items-center py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ul className="divide-y">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2.5">
                <Avatar className="size-9">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials(u.fullName || u.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {u.fullName || u.email}
                    {u.id === user?.id ? (
                      <span className="text-muted-foreground"> (bạn)</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.email}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                  {ROLE_LABEL[u.role] ?? u.role}
                </span>
                {u.role !== "owner" && u.id !== user?.id ? (
                  <>
                    <button
                      onClick={() => toggleActive(u)}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        u.isActive
                          ? "bg-online/15 text-online"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {u.isActive ? "Đang hoạt động" : "Đã khoá"}
                    </button>
                    <button
                      onClick={() => remove(u)}
                      className="grid size-7 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                      aria-label="Xoá"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function InviteForm({
  onClose,
  onSaved,
  canCreateAdmin,
}: {
  onClose: () => void;
  onSaved: () => void;
  canCreateAdmin: boolean;
}) {
  const [busy, setBusy] = React.useState(false);

  async function submit(form: FormData) {
    const email = String(form.get("email") || "").trim();
    const fullName = String(form.get("fullName") || "").trim();
    const password = String(form.get("password") || "");
    const role = (String(form.get("role") || "member") as "admin" | "member");
    if (!email || !fullName || !password) return;
    setBusy(true);
    try {
      await createUser({ email, fullName, password, role });
      toast.success("Đã thêm nhân viên");
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không tạo được nhân viên");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(new FormData(e.currentTarget));
      }}
      className="mb-3 space-y-2 rounded-lg border bg-muted/30 p-3"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <UserPlus className="size-3.5" /> Thêm nhân viên
        </span>
        <button
          type="button"
          onClick={onClose}
          className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-accent"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <input
        name="fullName"
        placeholder="Họ tên"
        required
        className="h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
      <input
        name="email"
        type="email"
        placeholder="Email đăng nhập"
        required
        className="h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
      <div className="flex gap-2">
        <input
          name="password"
          type="text"
          placeholder="Mật khẩu tạm"
          required
          minLength={6}
          className="h-9 flex-1 rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
        />
        <select
          name="role"
          defaultValue="member"
          className="h-9 rounded-md border bg-background px-2 text-sm outline-none"
        >
          <option value="member">Nhân viên</option>
          {canCreateAdmin ? <option value="admin">Quản trị</option> : null}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        Tạo tài khoản
      </Button>
    </form>
  );
}
