"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createBroadcast,
  createSendMessageBlock,
  getStatuses,
  type SegmentSpec,
} from "@/lib/crm";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function CreateBroadcastDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data: statusData } = useSWR("statuses", getStatuses);
  const statuses = statusData?.statuses ?? [];

  const [name, setName] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [audience, setAudience] = React.useState<"all" | "status">("all");
  const [statusIds, setStatusIds] = React.useState<Set<string>>(new Set());
  const [schedule, setSchedule] = React.useState<"now" | "scheduled">("now");
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  function toggleStatus(id: string) {
    setStatusIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const canSubmit =
    name.trim() &&
    message.trim() &&
    (audience === "all" || statusIds.size > 0) &&
    (schedule === "now" || scheduledAt);

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const block = await createSendMessageBlock(name.trim(), [message.trim()]);
      const segmentSpec: SegmentSpec =
        audience === "all"
          ? { kind: "filter", criteria: {} }
          : { kind: "filter", criteria: { statusId: { in: [...statusIds] } } };
      await createBroadcast({
        name: name.trim(),
        blockId: block.id,
        segmentSpec,
        scheduleKind: schedule,
        scheduledAt:
          schedule === "scheduled" && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : null,
      });
      toast.success("Đã tạo chiến dịch (nháp). Bấm “Bắt đầu gửi” để chạy.");
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không tạo được chiến dịch");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Tạo chiến dịch gửi hàng loạt</h2>
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Tên */}
          <Field label="Tên chiến dịch">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Khuyến mãi tháng 6"
              className="h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Field>

          {/* Nội dung */}
          <Field label="Nội dung tin nhắn">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Chào anh/chị, shop có ưu đãi..."
              className="w-full resize-none rounded-md border bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Field>

          {/* Người nhận */}
          <Field label="Gửi tới">
            <div className="flex gap-2">
              {(
                [
                  { k: "all", label: "Tất cả khách hàng" },
                  { k: "status", label: "Theo trạng thái" },
                ] as const
              ).map((o) => (
                <button
                  key={o.k}
                  onClick={() => setAudience(o.k)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    audience === o.k
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {audience === "status" ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {statuses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Chưa có trạng thái nào — tạo ở Cài đặt.
                  </p>
                ) : (
                  statuses.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => toggleStatus(s.id)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        statusIds.has(s.id)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {s.name}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </Field>

          {/* Lịch gửi */}
          <Field label="Thời gian gửi">
            <div className="flex gap-2">
              {(
                [
                  { k: "now", label: "Gửi ngay" },
                  { k: "scheduled", label: "Đặt lịch" },
                ] as const
              ).map((o) => (
                <button
                  key={o.k}
                  onClick={() => setSchedule(o.k)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    schedule === o.k
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {schedule === "scheduled" ? (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-2 h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
            ) : null}
          </Field>

          <div className="flex items-start gap-2 rounded-lg bg-success/10 p-2.5 text-xs text-success">
            <ShieldCheck className="size-4 shrink-0" />
            <span>
              Hệ thống <b>gửi rải đều theo giờ, giới hạn mỗi nick</b> để chống
              khóa tài khoản Zalo.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t p-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Huỷ
          </Button>
          <Button size="sm" disabled={!canSubmit || busy} onClick={submit}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Tạo chiến dịch
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}
