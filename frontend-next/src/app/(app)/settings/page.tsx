"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import {
  LogOut,
  Plus,
  RefreshCw,
  Loader2,
  Smartphone,
  Moon,
  Sun,
  Monitor,
  Users,
  Building2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  getZaloAccounts,
  syncHistory,
  reconnectAccount,
  getPlan,
} from "@/lib/resources";
import { ApiError } from "@/lib/api";
import { UpgradeDialog } from "@/components/settings/upgrade-dialog";
import { getPlatformMe } from "@/lib/platform";
import type { ZaloAccount } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TemplateManager } from "@/components/settings/template-manager";
import { TagManager } from "@/components/settings/tag-manager";
import { StatusManager } from "@/components/settings/status-manager";
import { ConnectZaloDialog } from "@/components/settings/connect-zalo-dialog";

const ROLE_LABEL: Record<string, string> = {
  owner: "Chủ tổ chức",
  admin: "Quản trị",
  member: "Nhân viên",
};

function statusTone(s: string): string {
  const v = s?.toLowerCase();
  if (["connected", "active", "online", "running"].includes(v))
    return "bg-online";
  if (["error", "disconnected", "banned", "failed"].includes(v))
    return "bg-overdue";
  return "bg-muted-foreground";
}

function AccountRow({ a, onChanged }: { a: ZaloAccount; onChanged: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const connected =
    (a.liveStatus || a.status) === "connected" ||
    (a.liveStatus || a.status) === "active";

  async function sync() {
    if (busy) return;
    setBusy(true);
    toast.message("Đang đồng bộ lịch sử từ Zalo… (có thể vài phút)");
    try {
      await syncHistory(a.id);
      toast.success("Đồng bộ xong — hội thoại/tin mới sẽ xuất hiện");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Đồng bộ thất bại");
    } finally {
      setBusy(false);
    }
  }

  async function reconnect() {
    if (busy) return;
    setBusy(true);
    toast.message("Đang kết nối lại nick…");
    try {
      await reconnectAccount(a.id);
      // Status cập nhật bất đồng bộ → đợi chút rồi refetch.
      setTimeout(() => {
        onChanged();
        toast.success("Đã gửi yêu cầu kết nối lại — kiểm tra lại sau vài giây");
      }, 4000);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Kết nối lại thất bại — thử quét QR");
      setBusy(false);
    } finally {
      setTimeout(() => setBusy(false), 4000);
    }
  }

  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar className="size-9">
        {a.avatarUrl ? (
          <AvatarImage src={a.avatarUrl} alt={a.displayName ?? ""} />
        ) : null}
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
          {(a.displayName ?? "N")[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {a.displayName || "Nick chưa đặt tên"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {a.zaloUid || a.id}
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className={cn(
            "size-2 rounded-full",
            statusTone(a.liveStatus || a.status),
          )}
        />
        {a.liveStatus || a.status}
      </span>
      {connected ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={sync}
          title="Kéo lịch sử bạn bè / nhóm / tin nhắn từ Zalo về"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Đồng bộ
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={busy}
          onClick={reconnect}
          title="Kết nối lại từ phiên đã lưu (không cần QR nếu phiên còn hiệu lực)"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Kết nối lại
        </Button>
      )}
    </li>
  );
}

function PlanCard() {
  const { data } = useSWR("my-plan", getPlan);
  const [upgrading, setUpgrading] = React.useState(false);
  if (!data) return null;
  const rows = [
    { label: "Nick Zalo", used: data.usage.nicks, limit: data.limits.nicks },
    { label: "Nhân viên", used: data.usage.staff, limit: data.limits.staff },
    { label: "Khách hàng", used: data.usage.contacts, limit: data.limits.contacts },
  ];
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Gói dịch vụ</CardTitle>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
          {data.label}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => {
          const pct = Math.min(100, Math.round((r.used / Math.max(1, r.limit)) * 100));
          const full = r.used >= r.limit;
          return (
            <div key={r.label}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">{r.label}</span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    full && "text-destructive",
                  )}
                >
                  {r.used}/{r.limit}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    full ? "bg-destructive" : "bg-primary",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        <Button
          size="sm"
          className="w-full"
          variant={data.plan === "business" ? "outline" : "default"}
          onClick={() => setUpgrading(true)}
        >
          {data.plan === "business" ? "Xem các gói" : "Nâng gói"}
        </Button>
      </CardContent>
      {upgrading ? (
        <UpgradeDialog currentPlan={data.plan} onClose={() => setUpgrading(false)} />
      ) : null}
    </Card>
  );
}

function PlatformCard() {
  const { data } = useSWR("platform-me", getPlatformMe);
  if (!data?.isSuperAdmin) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Quản trị nền tảng</CardTitle>
      </CardHeader>
      <CardContent>
        <Link
          href="/quan-tri-nen-tang"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Building2 className="size-4" /> Mở trang quản trị nền tảng
        </Link>
        <p className="mt-2 text-xs text-muted-foreground">
          Xem mọi tổ chức đã đăng ký + đổi gói sau khi nhận chuyển khoản.
        </p>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: accounts, isLoading, mutate } = useSWR(
    "zalo-accounts",
    getZaloAccounts,
  );
  const [connectOpen, setConnectOpen] = React.useState(false);

  const initials =
    user?.fullName
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "?";

  const themes = [
    { key: "light", label: "Sáng", icon: Sun },
    { key: "dark", label: "Tối", icon: Moon },
    { key: "system", label: "Hệ thống", icon: Monitor },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Cài đặt" description="Tài khoản, kênh Zalo & giao diện." />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Tài khoản */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tài khoản</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <Avatar className="size-12">
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {user?.fullName || "—"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </p>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {user ? ROLE_LABEL[user.role] ?? user.role : ""}
              </span>
            </CardContent>
          </Card>

          {/* Kênh Zalo */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">
                Kênh Zalo {accounts ? `(${accounts.length})` : ""}
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConnectOpen(true)}
              >
                <Plus className="size-4" /> Thêm nick
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !accounts || accounts.length === 0 ? (
                <div className="flex flex-col items-center gap-1 py-6 text-center">
                  <Smartphone className="size-6 text-muted-foreground" />
                  <p className="text-sm font-medium">Chưa kết nối nick Zalo</p>
                  <p className="text-xs text-muted-foreground">
                    Kết nối nick để bắt đầu nhận & gửi tin.
                  </p>
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => setConnectOpen(true)}
                  >
                    <Plus className="size-4" /> Kết nối nick Zalo
                  </Button>
                </div>
              ) : (
                <ul className="divide-y">
                  {accounts.map((a: ZaloAccount) => (
                    <AccountRow key={a.id} a={a} onChanged={mutate} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Gói dịch vụ */}
          <PlanCard />

          {/* Quản trị nền tảng — chỉ super-admin */}
          <PlatformCard />

          {/* Nhân viên — đã tách thành trang riêng */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nhân viên</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href="/nhan-vien"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Users className="size-4" /> Mở trang quản lý Nhân viên
              </Link>
              <p className="mt-2 text-xs text-muted-foreground">
                Quản lý người dùng, phòng ban, nhóm quyền ở trang riêng.
              </p>
            </CardContent>
          </Card>

          {/* Giai đoạn bán hàng (Pipeline) */}
          <StatusManager />

          {/* Mẫu tin nhanh */}
          <TemplateManager />

          {/* Nhãn CRM */}
          <TagManager />

          {/* Giao diện */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Giao diện</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {themes.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTheme(t.key)}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors",
                      theme === t.key
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <t.icon className="size-4" />
                    {t.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Đăng xuất */}
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            onClick={logout}
          >
            <LogOut className="size-4" />
            Đăng xuất
          </Button>
        </div>
      </div>

      {connectOpen ? (
        <ConnectZaloDialog
          onClose={() => setConnectOpen(false)}
          onConnected={() => mutate()}
        />
      ) : null}
    </div>
  );
}
