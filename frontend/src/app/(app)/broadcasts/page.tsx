"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Megaphone,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Play,
  Pause,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getBroadcasts,
  startBroadcast,
  pauseBroadcast,
  resumeBroadcast,
  cancelBroadcast,
  type Broadcast,
} from "@/lib/crm";
import { ApiError } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { useCan } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CreateBroadcastDialog } from "@/components/broadcasts/create-broadcast-dialog";

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Nháp", cls: "bg-muted text-muted-foreground" },
  scheduled: { label: "Đã lên lịch", cls: "bg-info/15 text-info" },
  running: { label: "Đang chạy", cls: "bg-warning/15 text-warning" },
  paused: { label: "Tạm dừng", cls: "bg-muted text-muted-foreground" },
  completed: { label: "Hoàn thành", cls: "bg-success/15 text-success" },
  cancelled: { label: "Đã huỷ", cls: "bg-overdue/15 text-overdue" },
};

export default function BroadcastsPage() {
  const { data, isLoading, mutate } = useSWR("broadcasts", getBroadcasts);
  const [createOpen, setCreateOpen] = React.useState(false);
  const broadcasts = data?.broadcasts ?? [];
  const can = useCan();
  const canCreate = can("broadcast", "create");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Gửi hàng loạt"
        description="Chiến dịch gửi tin tới nhiều khách — rải đều an toàn, chống khoá nick."
      >
        {canCreate ? (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Tạo chiến dịch
          </Button>
        ) : null}
      </PageHeader>
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : broadcasts.length === 0 ? (
          <Empty onCreate={canCreate ? () => setCreateOpen(true) : undefined} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {broadcasts.map((b) => (
              <BroadcastCard key={b.id} b={b} onChanged={() => mutate()} />
            ))}
          </div>
        )}
      </div>

      {createOpen ? (
        <CreateBroadcastDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => mutate()}
        />
      ) : null}
    </div>
  );
}

function BroadcastCard({
  b,
  onChanged,
}: {
  b: Broadcast;
  onChanged: () => void;
}) {
  const st = b.status
    ? STATUS[b.status] ?? { label: b.status, cls: "bg-muted text-muted-foreground" }
    : null;
  const total = b.totalRecipients || 0;
  const sent = b.sentCount || 0;
  const pct = total ? Math.min(100, Math.round((sent / total) * 100)) : 0;
  const [busy, setBusy] = React.useState(false);

  async function run(fn: (id: string) => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn(b.id);
      toast.success(ok);
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Thao tác thất bại");
    } finally {
      setBusy(false);
    }
  }

  const status = b.status ?? "draft";
  const canStart = status === "draft" || status === "scheduled";
  const canPause = status === "running";
  const canResume = status === "paused";
  const canCancel = ["draft", "scheduled", "running", "paused"].includes(status);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{b.name}</p>
            {b.description ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {b.description}
              </p>
            ) : null}
          </div>
          {st ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                st.cls,
              )}
            >
              {st.label}
            </span>
          ) : null}
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" /> {sent}/{total} người
            </span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1 text-success">
            <CheckCircle2 className="size-3.5" /> {b.deliveredCount}
          </span>
          <span className="inline-flex items-center gap-1 text-overdue">
            <XCircle className="size-3.5" /> {b.failedCount}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3.5" />
            {b.scheduledAt
              ? dateLabel(b.scheduledAt)
              : dateLabel(b.createdAt)}
          </span>
        </div>

        {/* Hành động vòng đời */}
        {canStart || canPause || canResume || canCancel ? (
          <div className="flex gap-2 border-t pt-2.5">
            {canStart ? (
              <Button
                size="sm"
                className="flex-1"
                disabled={busy}
                onClick={() => run(startBroadcast, "Đã bắt đầu gửi")}
              >
                <Play className="size-3.5" /> Bắt đầu gửi
              </Button>
            ) : null}
            {canPause ? (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => run(pauseBroadcast, "Đã tạm dừng")}
              >
                <Pause className="size-3.5" /> Tạm dừng
              </Button>
            ) : null}
            {canResume ? (
              <Button
                size="sm"
                className="flex-1"
                disabled={busy}
                onClick={() => run(resumeBroadcast, "Đã tiếp tục")}
              >
                <Play className="size-3.5" /> Tiếp tục
              </Button>
            ) : null}
            {canCancel ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => run(cancelBroadcast, "Đã huỷ chiến dịch")}
                aria-label="Huỷ"
              >
                <Ban className="size-3.5" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Empty({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted">
        <Megaphone className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Chưa có chiến dịch nào</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Tạo chiến dịch gửi hàng loạt: chọn tệp khách, soạn tin cá nhân hoá, đặt
        lịch và hệ thống gửi rải đều để bảo vệ nick.
      </p>
      {onCreate ? (
        <Button size="sm" className="mt-2" onClick={onCreate}>
          <Plus className="size-4" /> Tạo chiến dịch
        </Button>
      ) : null}
    </div>
  );
}
