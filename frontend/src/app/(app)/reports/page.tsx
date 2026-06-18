"use client";

import useSWR from "swr";
import {
  MessageSquare,
  MailWarning,
  Inbox,
  CalendarClock,
  UserPlus,
  Users,
} from "lucide-react";
import {
  getKpi,
  getPipeline,
  getSources,
  getTeamPerformance,
  getConversionFunnel,
  type GroupCount,
  type TeamMember,
} from "@/lib/crm";
import { compactNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function fmtRt(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${Math.round(sec)} giây`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} phút`;
  return `${(m / 60).toFixed(1)} giờ`;
}

export default function ReportsPage() {
  const { data: kpi, isLoading } = useSWR("kpi", getKpi);
  const { data: pipeline } = useSWR("pipeline", getPipeline);
  const { data: sources } = useSWR("sources", getSources);
  const { data: team } = useSWR("team-performance", getTeamPerformance);
  const { data: funnel } = useSWR("conversion-funnel", getConversionFunnel);

  const cards = [
    {
      label: "Tin nhắn hôm nay",
      value: kpi?.messagesToday,
      icon: MessageSquare,
      tone: "text-info",
    },
    {
      label: "Chưa trả lời",
      value: kpi?.messagesUnreplied,
      icon: MailWarning,
      tone: "text-overdue",
    },
    {
      label: "Hộp thư chưa đọc",
      value: kpi?.messagesUnread,
      icon: Inbox,
      tone: "text-warning",
    },
    {
      label: "Lịch hẹn hôm nay",
      value: kpi?.appointmentsToday,
      icon: CalendarClock,
      tone: "text-primary",
    },
    {
      label: "Khách mới (7 ngày)",
      value: kpi?.newContactsThisWeek,
      icon: UserPlus,
      tone: "text-success",
    },
    {
      label: "Tổng khách hàng",
      value: kpi?.totalContacts,
      icon: Users,
      tone: "text-foreground",
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Báo cáo"
        description="Tổng quan hoạt động chăm khách hôm nay."
      />
      <div className="flex-1 overflow-y-auto p-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardContent className="flex flex-col gap-2 p-4">
                <c.icon className={`size-5 ${c.tone}`} />
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <span className="text-2xl font-bold tabular-nums">
                    {compactNumber(c.value ?? 0)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Hiệu suất nhân viên (30 ngày) */}
        <div className="mt-6">
          <TeamPerformance users={team?.users} loaded={!!team} />
        </div>

        {/* Breakdown + Phễu */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <BreakdownCard
            title="Theo trạng thái"
            rows={pipeline?.data}
            labelKey="status"
            emptyText="Chưa có dữ liệu trạng thái"
          />
          <BreakdownCard
            title="Theo nguồn khách"
            rows={sources?.data}
            labelKey="source"
            emptyText="Chưa có dữ liệu nguồn"
          />
        </div>

        {/* Phễu chuyển đổi */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Phễu chuyển đổi
                {funnel?.avgConversionDays != null
                  ? ` · TB ${funnel.avgConversionDays} ngày để chốt`
                  : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!funnel ? (
                <Skeleton className="h-24 w-full" />
              ) : funnel.stages.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Chưa có dữ liệu phễu
                </p>
              ) : (
                <ul className="space-y-2">
                  {funnel.stages.map((s, i) => (
                    <li key={`${s.status}-${i}`} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize">{s.status || "Khác"}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {s.count.toLocaleString("vi-VN")} · {s.rate}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(100, s.rate)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TeamPerformance({
  users,
  loaded,
}: {
  users?: TeamMember[];
  loaded: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Hiệu suất nhân viên (30 ngày)</CardTitle>
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <Skeleton className="h-32 w-full" />
        ) : !users || users.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Chưa có dữ liệu nhân viên
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 text-left font-medium">Nhân viên</th>
                  <th className="py-2 text-right font-medium">Tin đã gửi</th>
                  <th className="py-2 text-right font-medium">KH chuyển đổi</th>
                  <th className="py-2 text-right font-medium">Lịch hoàn thành</th>
                  <th className="py-2 text-right font-medium">Phản hồi TB</th>
                </tr>
              </thead>
              <tbody>
                {users
                  .slice()
                  .sort((a, b) => b.messagesSent - a.messagesSent)
                  .map((u) => (
                    <tr key={u.userId} className="border-b last:border-0">
                      <td className="py-2 font-medium">{u.fullName}</td>
                      <td className="py-2 text-right tabular-nums">
                        {u.messagesSent.toLocaleString("vi-VN")}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {u.contactsConverted}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {u.appointmentsCompleted}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {fmtRt(u.avgResponseTime)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownCard({
  title,
  rows,
  labelKey,
  emptyText,
}: {
  title: string;
  rows?: GroupCount[];
  labelKey: "status" | "source";
  emptyText: string;
}) {
  const data = rows ?? [];
  const total = data.reduce((s, r) => s + r.count, 0) || 1;
  const max = Math.max(...data.map((r) => r.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!rows ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <ul className="space-y-3">
            {data
              .slice()
              .sort((a, b) => b.count - a.count)
              .map((r, i) => {
                const label = (r[labelKey] as string) || "Khác";
                const pct = Math.round((r.count / total) * 100);
                return (
                  <li key={`${label}-${i}`} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate capitalize">{label}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {r.count.toLocaleString("vi-VN")} · {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(r.count / max) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
