"use client";

import * as React from "react";
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
  Building2,
  CreditCard,
  GitBranch,
  MessageSquareText,
  Tag,
  UserCircle,
  Palette,
  Check,
  Sparkles,
  TrendingUp,
  SlidersHorizontal,
  Upload,
  Trash2,
  Globe,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  getZaloAccounts,
  syncHistory,
  reconnectAccount,
  getPlan,
  getOrganization,
  updateOrganization,
  uploadOrgLogo,
  checkOrgSlug,
  type OrgInfo,
} from "@/lib/resources";
import { ApiError } from "@/lib/api";
import { UpgradeDialog } from "@/components/settings/upgrade-dialog";
import { PLAN_CATALOG, WORKSPACE_DOMAIN } from "@/lib/platform";
import type { ZaloAccount } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectItem } from "@/components/ui/select";
import { updateUser, changeMyPassword } from "@/lib/team";
import { relativeTime } from "@/lib/format";
import { TemplateManager } from "@/components/settings/template-manager";
import { TagManager } from "@/components/settings/tag-manager";
import { StatusManager } from "@/components/settings/status-manager";
import { ConnectZaloDialog } from "@/components/settings/connect-zalo-dialog";

const ROLE_LABEL: Record<string, string> = {
  owner: "Chủ tổ chức",
  admin: "Quản trị",
  member: "Nhân viên",
};
const TIMEZONES = ["+07:00", "+08:00", "+09:00", "+00:00", "-05:00", "-08:00"];

function statusTone(s: string): string {
  const v = s?.toLowerCase();
  if (["connected", "active", "online", "running"].includes(v)) return "bg-online";
  if (["error", "disconnected", "banned", "failed"].includes(v)) return "bg-overdue";
  return "bg-muted-foreground";
}

type SectionKey = "org" | "plan" | "zalo" | "crm" | "account" | "theme";

export default function SettingsPage() {
  const { user } = useAuth();
  const isOrgAdmin = user?.role === "owner" || user?.role === "admin";
  const [section, setSection] = React.useState<SectionKey>(
    isOrgAdmin ? "org" : "account",
  );

  const orgSections: { k: SectionKey; label: string; icon: typeof Building2 }[] = [
    { k: "org", label: "Tổng quan tổ chức", icon: Building2 },
    { k: "plan", label: "Gói dịch vụ", icon: CreditCard },
    { k: "zalo", label: "Kênh Zalo", icon: Smartphone },
    { k: "crm", label: "Cấu hình CRM", icon: SlidersHorizontal },
  ];
  const personalSections: { k: SectionKey; label: string; icon: typeof Building2 }[] = [
    { k: "account", label: "Tài khoản", icon: UserCircle },
    { k: "theme", label: "Giao diện", icon: Palette },
  ];

  return (
    <div className="flex h-svh">
      {/* Sub-nav trái */}
      <nav className="w-60 shrink-0 overflow-y-auto border-r bg-muted/20 p-3">
        <h1 className="px-2 py-2 text-base font-semibold">Cài đặt</h1>
        {isOrgAdmin ? (
          <NavGroup label="Tổ chức">
            {orgSections.map((s) => (
              <NavBtn key={s.k} {...s} active={section === s.k} onClick={() => setSection(s.k)} />
            ))}
          </NavGroup>
        ) : null}
        <NavGroup label="Cá nhân">
          {personalSections.map((s) => (
            <NavBtn key={s.k} {...s} active={section === s.k} onClick={() => setSection(s.k)} />
          ))}
        </NavGroup>
      </nav>

      {/* Nội dung */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 p-6">
          {section === "org" && isOrgAdmin ? <OrgInfoSection /> : null}
          {section === "plan" && isOrgAdmin ? <PlanCard /> : null}
          {section === "zalo" && isOrgAdmin ? <ZaloChannels /> : null}
          {section === "crm" && isOrgAdmin ? <CrmConfigSection /> : null}
          {section === "account" ? <AccountSection /> : null}
          {section === "theme" ? <ThemeSection /> : null}
        </div>
      </main>
    </div>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
function NavBtn({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Building2;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
        active
          ? "bg-card font-medium text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </button>
  );
}

// ── Tổng quan tổ chức ────────────────────────────────────────────────────────
function OrgInfoSection() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const { data, mutate } = useSWR("organization", getOrganization);
  const { data: plan } = useSWR("my-plan", getPlan);
  const [name, setName] = React.useState("");
  const [tz, setTz] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (data) {
      setName(data.name);
      setTz(data.timezone);
    }
  }, [data]);

  const dirty = data && (name.trim() !== data.name || tz !== data.timezone);

  async function save() {
    if (!dirty || busy) return;
    setBusy(true);
    try {
      await updateOrganization({ name: name.trim(), timezone: tz });
      toast.success("Đã lưu thông tin tổ chức");
      mutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-6">
      <BasicOrgCard
        data={data}
        plan={plan}
        isOwner={isOwner}
        name={name}
        setName={setName}
        tz={tz}
        setTz={setTz}
        dirty={!!dirty}
        busy={busy}
        save={save}
      />
      <OrgBrandingCard org={data} isOwner={isOwner} onSaved={() => mutate()} />
    </div>
  );
}

function BasicOrgCard({
  data,
  plan,
  isOwner,
  name,
  setName,
  tz,
  setTz,
  dirty,
  busy,
  save,
}: {
  data: OrgInfo;
  plan: { label: string; usage: { staff: number; nicks: number; contacts: number } } | undefined;
  isOwner: boolean;
  name: string;
  setName: (v: string) => void;
  tz: string;
  setTz: (v: string) => void;
  dirty: boolean;
  busy: boolean;
  save: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Tổng quan tổ chức</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Tên, múi giờ và số liệu sử dụng chung của tổ chức.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Tên tổ chức
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isOwner}
            className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Múi giờ
          </label>
          <Select className="w-full" value={tz} onValueChange={setTz} disabled={!isOwner}>
            {TIMEZONES.map((t) => (
              <SelectItem key={t} value={t}>
                GMT {t}
              </SelectItem>
            ))}
          </Select>
        </div>
        {/* Số liệu nhanh */}
        {plan ? (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Nhân viên", v: plan.usage.staff },
              { label: "Nick Zalo", v: plan.usage.nicks },
              { label: "Khách hàng", v: plan.usage.contacts },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border bg-muted/30 p-2.5 text-center">
                <p className="text-lg font-bold tabular-nums">
                  {s.v.toLocaleString("vi-VN")}
                </p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Gói hiện tại</span>
          <span className="font-semibold text-primary">{plan?.label ?? "—"}</span>
        </div>
        {data.createdAt ? (
          <p className="text-xs text-muted-foreground">
            Tạo tổ chức {relativeTime(data.createdAt)} · Mã: {data.id.slice(0, 8)}
          </p>
        ) : null}
        {isOwner ? (
          <Button onClick={save} disabled={!dirty || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Lưu thay đổi
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Chỉ chủ tổ chức mới sửa được thông tin này.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Thương hiệu & địa chỉ workspace ──────────────────────────────────────────
const BRAND_PRESETS = ["#4F46E5", "#0EA5E9", "#16A34A", "#EA580C", "#DC2626", "#9333EA", "#0F172A"];

function OrgBrandingCard({
  org,
  isOwner,
  onSaved,
}: {
  org: OrgInfo;
  isOwner: boolean;
  onSaved: () => void;
}) {
  const [logoUrl, setLogoUrl] = React.useState(org.logoUrl ?? null);
  const [color, setColor] = React.useState(org.brandColor ?? "#4F46E5");
  const [slug, setSlug] = React.useState(org.slug ?? "");
  const [uploading, setUploading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [slugState, setSlugState] = React.useState<
    { status: "idle" | "checking" | "ok" | "taken"; reason?: string }
  >({ status: "idle" });
  const fileRef = React.useRef<HTMLInputElement>(null);

  const initialSlug = org.slug ?? "";
  const dirty =
    color !== (org.brandColor ?? "#4F46E5") || slug.trim() !== initialSlug;

  // Live check subdomain (debounce 400ms) khi slug đổi và khác giá trị gốc.
  React.useEffect(() => {
    const s = slug.trim().toLowerCase();
    if (!s || s === initialSlug) {
      setSlugState({ status: "idle" });
      return;
    }
    setSlugState({ status: "checking" });
    const t = setTimeout(async () => {
      try {
        const r = await checkOrgSlug(s);
        setSlugState(r.available ? { status: "ok" } : { status: "taken", reason: r.reason });
      } catch {
        setSlugState({ status: "idle" });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [slug, initialSlug]);

  async function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo tối đa 2MB");
    setUploading(true);
    try {
      const r = await uploadOrgLogo(file);
      setLogoUrl(r.logoUrl);
      toast.success("Đã cập nhật logo");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Tải logo thất bại");
    } finally {
      setUploading(false);
    }
  }

  async function removeLogo() {
    setUploading(true);
    try {
      await updateOrganization({ logoUrl: null });
      setLogoUrl(null);
      toast.success("Đã gỡ logo");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không gỡ được logo");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (busy || !dirty) return;
    if (slug.trim() && slugState.status === "taken") {
      return toast.error(slugState.reason ?? "Địa chỉ subdomain không dùng được");
    }
    setBusy(true);
    try {
      await updateOrganization({
        brandColor: color,
        slug: slug.trim() ? slug.trim().toLowerCase() : null,
      });
      toast.success("Đã lưu thương hiệu");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Thương hiệu & địa chỉ</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Logo, màu thương hiệu và địa chỉ workspace riêng cho tổ chức.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Logo */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Logo</label>
          <div className="flex items-center gap-3">
            <div
              className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border"
              style={{ backgroundColor: logoUrl ? undefined : color }}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo" className="size-full object-contain" />
              ) : (
                <span className="text-2xl font-bold text-white">
                  {(org.name?.[0] ?? "?").toUpperCase()}
                </span>
              )}
            </div>
            {isOwner ? (
              <div className="flex flex-col gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={pickLogo}
                />
                <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  {logoUrl ? "Đổi logo" : "Tải logo"}
                </Button>
                {logoUrl ? (
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={uploading} onClick={removeLogo}>
                    <Trash2 className="size-4" /> Gỡ logo
                  </Button>
                ) : (
                  <span className="text-[11px] text-muted-foreground">PNG, JPG, WEBP, SVG · ≤ 2MB</span>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Màu thương hiệu */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Màu thương hiệu</label>
          <div className="flex flex-wrap items-center gap-2">
            {BRAND_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={!isOwner}
                onClick={() => setColor(c)}
                className={cn(
                  "size-7 rounded-full ring-offset-2 ring-offset-background transition",
                  color.toLowerCase() === c.toLowerCase() ? "ring-2 ring-foreground" : "hover:scale-110",
                )}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
            <label className="ml-1 inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-xs">
              <input
                type="color"
                value={color}
                disabled={!isOwner}
                onChange={(e) => setColor(e.target.value)}
                className="size-5 cursor-pointer rounded border-0 bg-transparent p-0"
              />
              <span className="font-mono uppercase tabular-nums">{color}</span>
            </label>
          </div>
        </div>

        {/* Subdomain / địa chỉ workspace */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Địa chỉ workspace (subdomain)
          </label>
          <div className="flex items-stretch overflow-hidden rounded-lg border focus-within:ring-2 focus-within:ring-ring/40">
            <span className="grid place-items-center border-r bg-muted/50 px-2.5 text-muted-foreground">
              <Globe className="size-4" />
            </span>
            <input
              value={slug}
              disabled={!isOwner}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              placeholder="ten-cong-ty"
              className="min-w-0 flex-1 bg-background px-2.5 text-sm outline-none disabled:opacity-60"
            />
            <span className="grid place-items-center whitespace-nowrap bg-muted/50 px-3 text-sm text-muted-foreground">
              .{WORKSPACE_DOMAIN}
            </span>
          </div>
          {/* Trạng thái kiểm tra */}
          <div className="mt-1 h-4 text-xs">
            {slugState.status === "checking" ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Đang kiểm tra…
              </span>
            ) : slugState.status === "ok" ? (
              <span className="inline-flex items-center gap-1 text-success">
                <Check className="size-3" /> {slug.trim()}.{WORKSPACE_DOMAIN} còn trống
              </span>
            ) : slugState.status === "taken" ? (
              <span className="inline-flex items-center gap-1 text-destructive">
                <X className="size-3" /> {slugState.reason}
              </span>
            ) : org.slug ? (
              <span className="text-muted-foreground">
                Hiện tại: {org.slug}.{WORKSPACE_DOMAIN}
              </span>
            ) : (
              <span className="text-muted-foreground">3–30 ký tự: chữ thường, số, gạch ngang</span>
            )}
          </div>
          <p className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            Sau khi lưu, địa chỉ này cần được kích hoạt DNS (wildcard *.{WORKSPACE_DOMAIN}) ở
            phía hệ thống mới truy cập được. Liên hệ quản trị nền tảng để bật.
          </p>
        </div>

        {isOwner ? (
          <Button onClick={save} disabled={!dirty || busy || slugState.status === "checking"}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Lưu thương hiệu
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Chỉ chủ tổ chức mới chỉnh được thương hiệu.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Kênh Zalo ────────────────────────────────────────────────────────────────
function ZaloChannels() {
  const { data: accounts, isLoading, mutate } = useSWR("zalo-accounts", getZaloAccounts);
  const [connectOpen, setConnectOpen] = React.useState(false);
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm">
            Kênh Zalo {accounts ? `(${accounts.length})` : ""}
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Kết nối &amp; quản lý nick Zalo để nhận và gửi tin nhắn.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setConnectOpen(true)}>
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
              Kết nối nick để bắt đầu nhận &amp; gửi tin.
            </p>
            <Button size="sm" className="mt-2" onClick={() => setConnectOpen(true)}>
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
      {connectOpen ? (
        <ConnectZaloDialog
          onClose={() => setConnectOpen(false)}
          onConnected={() => mutate()}
        />
      ) : null}
    </Card>
  );
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
        {a.avatarUrl ? <AvatarImage src={a.avatarUrl} alt={a.displayName ?? ""} /> : null}
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
          {(a.displayName ?? "N")[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {a.displayName || "Nick chưa đặt tên"}
        </p>
        <p className="truncate text-xs text-muted-foreground">{a.zaloUid || a.id}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn("size-2 rounded-full", statusTone(a.liveStatus || a.status))} />
        {a.liveStatus || a.status}
      </span>
      {connected ? (
        <Button size="sm" variant="outline" disabled={busy} onClick={sync} title="Kéo lịch sử bạn bè / nhóm / tin nhắn từ Zalo về">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Đồng bộ
        </Button>
      ) : (
        <Button size="sm" disabled={busy} onClick={reconnect} title="Kết nối lại từ phiên đã lưu (không cần QR nếu phiên còn hiệu lực)">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Kết nối lại
        </Button>
      )}
    </li>
  );
}

// ── Cấu hình CRM (gộp: Giai đoạn · Mẫu tin · Nhãn) ───────────────────────────
type CrmTab = "stages" | "templates" | "tags";

function CrmConfigSection() {
  const [tab, setTab] = React.useState<CrmTab>("stages");
  const tabs: { k: CrmTab; label: string; icon: typeof Building2 }[] = [
    { k: "stages", label: "Giai đoạn", icon: GitBranch },
    { k: "templates", label: "Mẫu tin", icon: MessageSquareText },
    { k: "tags", label: "Nhãn CRM", icon: Tag },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Cấu hình CRM</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Thiết lập quy trình bán hàng, mẫu tin trả lời nhanh và nhãn phân loại
          khách dùng chung cho cả tổ chức.
        </p>
      </div>
      <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.k
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>
      {tab === "stages" ? <StatusManager /> : null}
      {tab === "templates" ? <TemplateManager /> : null}
      {tab === "tags" ? <TagManager /> : null}
    </div>
  );
}

// ── Gói dịch vụ (bảng giá — điểm chốt nâng cấp) ──────────────────────────────
function PlanCard() {
  const { data } = useSWR("my-plan", getPlan);
  const [upgradePlan, setUpgradePlan] = React.useState<string | null>(null);
  if (!data) return <Skeleton className="h-96 w-full" />;

  const rows = [
    { label: "Nick Zalo", used: data.usage.nicks, limit: data.limits.nicks },
    { label: "Nhân viên", used: data.usage.staff, limit: data.limits.staff },
    { label: "Khách hàng", used: data.usage.contacts, limit: data.limits.contacts },
  ];
  const atLimit = rows.some((r) => r.used >= r.limit);
  const order = ["free", "pro", "business"];
  const curIdx = order.indexOf(data.plan);

  return (
    <div className="space-y-5">
      {/* Gói hiện tại + mức dùng */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b bg-linear-to-r from-primary/10 to-transparent px-5 py-4">
          <div>
            <p className="text-xs text-muted-foreground">Gói hiện tại</p>
            <p className="text-lg font-bold">{data.label}</p>
          </div>
          <CreditCard className="size-7 text-primary/60" />
        </div>
        <CardContent className="space-y-3 pt-4">
          {rows.map((r) => {
            const pct = Math.min(100, Math.round((r.used / Math.max(1, r.limit)) * 100));
            const full = r.used >= r.limit;
            const near = !full && pct >= 80;
            return (
              <div key={r.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      full ? "text-destructive" : near ? "text-warning" : "",
                    )}
                  >
                    {r.used.toLocaleString("vi-VN")}/{r.limit.toLocaleString("vi-VN")}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      full ? "bg-destructive" : near ? "bg-warning" : "bg-primary",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {atLimit ? (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <TrendingUp className="size-4 shrink-0" />
              Bạn đã chạm giới hạn gói — nâng cấp để thêm nick / nhân viên / khách.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Bảng giá */}
      <div>
        <h3 className="mb-1 text-sm font-semibold">Chọn gói phù hợp</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Nâng cấp để mở rộng số nick Zalo, nhân viên và khách hàng. Thanh toán
          chuyển khoản, kích hoạt trong vài giờ.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {PLAN_CATALOG.map((p) => {
            const isCurrent = p.key === data.plan;
            const isUpgrade = order.indexOf(p.key) > curIdx;
            return (
              <div
                key={p.key}
                className={cn(
                  "hover-lift relative flex flex-col rounded-xl border p-4 hover:shadow-md",
                  p.highlight && "border-primary/60 shadow-sm",
                  isCurrent && "ring-2 ring-primary",
                )}
              >
                {p.highlight ? (
                  <span className="absolute -top-2 left-4 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    <Sparkles className="size-3" /> Phổ biến
                  </span>
                ) : null}
                <p className="text-sm font-semibold">{p.name}</p>
                <div className="mt-1 mb-3 flex items-baseline gap-1">
                  <span className="text-2xl font-bold tabular-nums">
                    {p.priceMonthly === 0
                      ? "0đ"
                      : `${(p.priceMonthly / 1000).toLocaleString("vi-VN")}k`}
                  </span>
                  {p.priceMonthly > 0 ? (
                    <span className="text-xs text-muted-foreground">/tháng</span>
                  ) : null}
                </div>
                <ul className="mb-4 flex-1 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="rounded-lg bg-muted py-2 text-center text-xs font-medium text-muted-foreground">
                    Đang dùng
                  </div>
                ) : isUpgrade ? (
                  <Button
                    size="sm"
                    className="w-full"
                    variant={p.highlight ? "default" : "outline"}
                    onClick={() => setUpgradePlan(p.key)}
                  >
                    Nâng cấp
                  </Button>
                ) : (
                  <div className="rounded-lg border py-2 text-center text-xs text-muted-foreground">
                    Liên hệ để đổi
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {upgradePlan ? (
        <UpgradeDialog
          currentPlan={data.plan}
          initialPlan={upgradePlan}
          onClose={() => setUpgradePlan(null)}
        />
      ) : null}
    </div>
  );
}

// ── Tài khoản (cá nhân) ──────────────────────────────────────────────────────
const fieldCls =
  "h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-60";
const fieldLabel = "mb-1 block text-xs font-medium text-muted-foreground";

function AccountSection() {
  const { user, logout, refresh } = useAuth();
  const [name, setName] = React.useState(user?.fullName ?? "");
  const [savingName, setSavingName] = React.useState(false);
  const [cur, setCur] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [savingPw, setSavingPw] = React.useState(false);

  React.useEffect(() => {
    setName(user?.fullName ?? "");
  }, [user?.fullName]);

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

  async function saveName() {
    if (!user || !name.trim() || name.trim() === user.fullName || savingName) return;
    setSavingName(true);
    try {
      await updateUser(user.id, { fullName: name.trim() });
      await refresh();
      toast.success("Đã cập nhật hồ sơ");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không lưu được");
    } finally {
      setSavingName(false);
    }
  }

  async function savePw() {
    if (savingPw) return;
    if (pw.length < 6) return toast.error("Mật khẩu mới tối thiểu 6 ký tự");
    if (pw !== confirm) return toast.error("Xác nhận mật khẩu không khớp");
    setSavingPw(true);
    try {
      await changeMyPassword(cur, pw);
      setCur("");
      setPw("");
      setConfirm("");
      toast.success("Đã đổi mật khẩu");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không đổi được mật khẩu");
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <>
      {/* Hồ sơ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Hồ sơ cá nhân</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ảnh đại diện, tên hiển thị và vai trò của bạn.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              <span className="mt-1 inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                {user ? ROLE_LABEL[user.role] ?? user.role : ""}
              </span>
            </div>
          </div>
          <div>
            <label className={fieldLabel}>Họ tên hiển thị</label>
            <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button
            onClick={saveName}
            disabled={savingName || !name.trim() || name.trim() === user?.fullName}
          >
            {savingName ? <Loader2 className="size-4 animate-spin" /> : null}
            Lưu hồ sơ
          </Button>
        </CardContent>
      </Card>

      {/* Bảo mật */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Đổi mật khẩu</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Nên đổi mật khẩu định kỳ để giữ tài khoản an toàn.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className={fieldLabel}>Mật khẩu hiện tại</label>
            <input type="password" className={fieldCls} value={cur} onChange={(e) => setCur(e.target.value)} />
          </div>
          <div>
            <label className={fieldLabel}>Mật khẩu mới (≥ 6 ký tự)</label>
            <input type="password" className={fieldCls} value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div>
            <label className={fieldLabel}>Xác nhận mật khẩu mới</label>
            <input type="password" className={fieldCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button
            variant="outline"
            onClick={savePw}
            disabled={savingPw || !cur || !pw || !confirm}
          >
            {savingPw ? <Loader2 className="size-4 animate-spin" /> : null}
            Đổi mật khẩu
          </Button>
        </CardContent>
      </Card>

      <Button
        variant="outline"
        className="w-full text-destructive hover:text-destructive"
        onClick={logout}
      >
        <LogOut className="size-4" /> Đăng xuất
      </Button>
    </>
  );
}

// ── Giao diện ────────────────────────────────────────────────────────────────
function ThemeSection() {
  const { theme, setTheme } = useTheme();
  const themes: {
    key: string;
    label: string;
    desc: string;
    icon: typeof Sun;
    preview: React.ReactNode;
  }[] = [
    {
      key: "light",
      label: "Sáng",
      desc: "Nền trắng, hợp ban ngày",
      icon: Sun,
      preview: <ThemeMock bg="#ffffff" side="#f1f5f9" line="#cbd5e1" />,
    },
    {
      key: "dark",
      label: "Tối",
      desc: "Nền tối, dịu mắt buổi đêm",
      icon: Moon,
      preview: <ThemeMock bg="#0f172a" side="#1e293b" line="#475569" />,
    },
    {
      key: "system",
      label: "Hệ thống",
      desc: "Theo cài đặt máy của bạn",
      icon: Monitor,
      preview: (
        <div className="flex size-full overflow-hidden">
          <div className="w-1/2">
            <ThemeMock bg="#ffffff" side="#f1f5f9" line="#cbd5e1" half />
          </div>
          <div className="w-1/2">
            <ThemeMock bg="#0f172a" side="#1e293b" line="#475569" half />
          </div>
        </div>
      ),
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Giao diện</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Chọn chế độ hiển thị cho riêng tài khoản của bạn — không ảnh hưởng người khác.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {themes.map((t) => {
            const active = theme === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTheme(t.key)}
                className={cn(
                  "group flex flex-col gap-2 rounded-xl border p-2 text-left transition-colors",
                  active ? "border-primary ring-2 ring-primary/30" : "border-border hover:bg-accent/50",
                )}
              >
                <div className="relative h-16 w-full overflow-hidden rounded-lg border">
                  {t.preview}
                  {active ? (
                    <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" />
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 px-0.5">
                  <t.icon className={cn("size-3.5", active ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("text-xs font-medium", active ? "text-primary" : "")}>
                    {t.label}
                  </span>
                </div>
                <p className="px-0.5 text-[11px] leading-tight text-muted-foreground">{t.desc}</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Mini-mockup khung UI cho từng theme (chỉ trang trí).
function ThemeMock({ bg, side, line, half }: { bg: string; side: string; line: string; half?: boolean }) {
  return (
    <div className="flex size-full" style={{ backgroundColor: bg }}>
      <div className={cn("h-full", half ? "w-2" : "w-3")} style={{ backgroundColor: side }} />
      <div className="flex flex-1 flex-col justify-center gap-1 p-1.5">
        <div className="h-1 w-3/4 rounded-full" style={{ backgroundColor: line }} />
        <div className="h-1 w-full rounded-full" style={{ backgroundColor: line }} />
        <div className="h-1 w-1/2 rounded-full" style={{ backgroundColor: line }} />
      </div>
    </div>
  );
}
