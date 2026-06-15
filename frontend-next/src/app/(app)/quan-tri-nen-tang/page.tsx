"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Building2, Loader2, ShieldAlert } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  getPlatformMe,
  getPlatformOrgs,
  setOrgPlan,
  type PlatformOrg,
} from "@/lib/platform";
import { relativeTime } from "@/lib/format";
import { Select, SelectItem } from "@/components/ui/select";

export default function PlatformAdminPage() {
  const { data: me, isLoading: meLoading } = useSWR("platform-me", getPlatformMe);
  const { data, isLoading, mutate } = useSWR(
    me?.isSuperAdmin ? "platform-orgs" : null,
    getPlatformOrgs,
  );

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
          Mọi tổ chức đăng ký · Đổi gói thủ công sau khi nhận chuyển khoản
        </p>
      </header>

      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
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
                {orgs.map((o) => (
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
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
