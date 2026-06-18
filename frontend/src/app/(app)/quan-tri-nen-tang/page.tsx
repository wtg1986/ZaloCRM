"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Building2,
  Loader2,
  Search,
  ShieldAlert,
  Users,
  Smartphone,
  Wallet,
  Sparkles,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  getPlatformMe,
  getPlatformOrgs,
  setOrgPlan,
  PLAN_CATALOG,
  type PlatformOrg,
} from "@/lib/platform";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectItem } from "@/components/ui/select";

const PRICE = Object.fromEntries(PLAN_CATALOG.map((p) => [p.key, p.priceMonthly]));

export default function PlatformAdminPage() {
  const { data: me, isLoading: meLoading } = useSWR("platform-me", getPlatformMe);
  const { data, isLoading, mutate } = useSWR(
    me?.isSuperAdmin ? "platform-orgs" : null,
    getPlatformOrgs,
  );
  const [q, setQ] = React.useState("");
  const [planFilter, setPlanFilter] = React.useState("");

  if (meLoading) {
    return (
      <div className="grid h-svh place-items-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!me?.isSuperAdmin) {
    return (
      <div className="grid h-svh place-items-center text-center text-muted-foreground">
        <div>
          <ShieldAlert className="mx-auto mb-2 size-8" />
          <p className="text-sm">Chỉ chủ nền tảng mới truy cập được trang này.</p>
        </div>
      </div>
    );
  }

  const orgs = data?.orgs ?? [];
  const plans = data?.plans ?? [];

  // Thống kê tổng quan (tính client-side từ danh sách org).
  const now = Date.now();
  const stats = {
    orgs: orgs.length,
    users: orgs.reduce((s, o) => s + o.usage.staff, 0),
    nicks: orgs.reduce((s, o) => s + o.usage.nicks, 0),
    revenue: orgs.reduce((s, o) => s + (PRICE[o.plan] ?? 0), 0),
    newWeek: orgs.filter(
      (o) => now - new Date(o.createdAt).getTime() < 7 * 864e5,
    ).length,
  };
  const planDist = plans.map((p) => ({
    ...p,
    count: orgs.filter((o) => o.plan === p.key).length,
  }));

  const filtered = orgs.filter((o) => {
    if (planFilter && o.plan !== planFilter) return false;
    if (q.trim()) {
      const s = q.toLowerCase();
      return (
        o.name.toLowerCase().includes(s) ||
        (o.owner?.email ?? "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  async function changePlan(org: PlatformOrg, plan: string) {
    if (plan === org.plan) return;
    try {
      await setOrgPlan(org.id, plan);
      toast.success(`Đã đổi "${org.name}" sang gói ${plan}`);
      mutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không đổi được gói");
    }
  }

  return (
    <div className="flex h-svh flex-col">
      <header className="border-b px-6 py-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Building2 className="size-5" /> Quản trị nền tảng
        </h1>
        <p className="text-xs text-muted-foreground">
          Tổng quan kinh doanh · Mọi tổ chức đăng ký · Đổi gói sau khi nhận chuyển khoản
        </p>
      </header>

      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Thống kê */}
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat icon={Building2} label="Tổ chức" value={stats.orgs} />
              <Stat icon={Users} label="Người dùng" value={stats.users} />
              <Stat icon={Smartphone} label="Nick Zalo" value={stats.nicks} />
              <Stat
                icon={Wallet}
                label="Doanh thu ước tính/tháng"
                value={`${stats.revenue.toLocaleString("vi-VN")}đ`}
                accent
              />
              <Stat icon={Sparkles} label="Mới (7 ngày)" value={stats.newWeek} />
            </div>

            {/* Phân bố gói */}
            <div className="mb-4 flex flex-wrap gap-2">
              {planDist.map((p) => (
                <span
                  key={p.key}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs"
                >
                  <span className="font-medium">{p.label}</span>
                  <span className="tabular-nums text-muted-foreground">{p.count}</span>
                </span>
              ))}
            </div>

            {/* Tìm + lọc */}
            <div className="mb-3 flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-9 pl-9"
                  placeholder="Tìm tổ chức / email chủ..."
                />
              </div>
              <Select
                className="h-9 px-2 text-xs"
                value={planFilter}
                onValueChange={setPlanFilter}
              >
                <SelectItem value="">Mọi gói</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </Select>
              <span className="text-xs text-muted-foreground">
                {filtered.length}/{orgs.length} tổ chức
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Tổ chức</th>
                    <th className="px-3 py-2 text-left font-medium">Chủ</th>
                    <th className="px-3 py-2 text-center font-medium">Nick</th>
                    <th className="px-3 py-2 text-center font-medium">NV</th>
                    <th className="px-3 py-2 text-center font-medium">Khách</th>
                    <th className="px-3 py-2 text-left font-medium">Đăng ký</th>
                    <th className="px-3 py-2 text-left font-medium">Gói</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((o) => (
                    <tr key={o.id} className="hover:bg-accent/40">
                      <td className="px-3 py-2 font-medium">{o.name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {o.owner?.email ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">{o.usage.nicks}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{o.usage.staff}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{o.usage.contacts}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {relativeTime(o.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          className="h-8 px-2 text-xs"
                          value={o.plan}
                          onValueChange={(v) => changePlan(o, v)}
                        >
                          {plans.map((p) => (
                            <SelectItem key={p.key} value={p.key}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">
                        Không có tổ chức khớp.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <p className={cn("text-xl font-bold tabular-nums", accent && "text-primary")}>
        {value}
      </p>
    </div>
  );
}
