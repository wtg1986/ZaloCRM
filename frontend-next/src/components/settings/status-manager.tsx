"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { GripVertical, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createStatus,
  deleteStatus,
  getStatuses,
  updateStatus,
  type PipelineStatus,
} from "@/lib/crm";
import { ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const COLORS = [
  "#6366F1","#3B82F6","#06B6D4","#10B981","#84CC16",
  "#F59E0B","#EF4444","#EC4899","#8B5CF6","#90A4AE",
];

export function StatusManager() {
  const { data, isLoading, mutate } = useSWR("statuses", getStatuses);
  const statuses = (data?.statuses ?? []).slice().sort((a, b) => a.order - b.order);
  const [editing, setEditing] = React.useState<PipelineStatus | "new" | null>(
    null,
  );

  async function remove(s: PipelineStatus) {
    if (!confirm(`Xoá giai đoạn "${s.name}"?`)) return;
    try {
      await deleteStatus(s.id);
      await mutate();
      toast.success("Đã xoá giai đoạn");
    } catch (e) {
      // BE chặn nếu đang có khách dùng → hiện message rõ.
      toast.error(e instanceof ApiError ? e.message : "Không xoá được");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm">
            Giai đoạn bán hàng (Pipeline) {data ? `(${statuses.length})` : ""}
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Các cột trong bảng Kanban ở trang Khách hàng.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Thêm
        </Button>
      </CardHeader>
      <CardContent>
        {editing ? (
          <StatusForm
            status={editing === "new" ? null : editing}
            nextOrder={statuses.length}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              mutate();
            }}
          />
        ) : null}

        {isLoading ? (
          <div className="grid place-items-center py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : statuses.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Chưa có giai đoạn nào. Thêm vài giai đoạn (vd: Mới → Đang tư vấn →
            Chốt) để dùng Kanban.
          </p>
        ) : (
          <ul className="divide-y">
            {statuses.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2">
                <GripVertical className="size-3.5 text-muted-foreground/50" />
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color || "#90A4AE" }}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                {s.isDefault ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    Mặc định
                  </span>
                ) : null}
                {s.isTerminal ? (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                    Kết thúc
                  </span>
                ) : null}
                <button
                  onClick={() => setEditing(s)}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                  aria-label="Sửa"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => remove(s)}
                  className="grid size-7 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                  aria-label="Xoá"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function StatusForm({
  status,
  nextOrder,
  onClose,
  onSaved,
}: {
  status: PipelineStatus | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [color, setColor] = React.useState(status?.color || COLORS[0]);

  async function submit(form: FormData) {
    const name = String(form.get("name") || "").trim();
    if (!name) return;
    const isDefault = form.get("isDefault") === "on";
    const isTerminal = form.get("isTerminal") === "on";
    setBusy(true);
    try {
      if (status)
        await updateStatus(status.id, { name, color, isDefault, isTerminal });
      else
        await createStatus({ name, color, order: nextOrder, isDefault, isTerminal });
      toast.success(status ? "Đã cập nhật" : "Đã thêm giai đoạn");
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Lưu thất bại");
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
        <span className="text-xs font-medium">
          {status ? "Sửa giai đoạn" : "Giai đoạn mới"}
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
        name="name"
        defaultValue={status?.name}
        placeholder="Tên giai đoạn (vd: Đang tư vấn)"
        required
        autoFocus
        className="h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
      <div className="flex flex-wrap gap-1.5">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={c}
            style={{ backgroundColor: c }}
            className={`size-6 rounded-full ${color === c ? "ring-2 ring-foreground ring-offset-1 ring-offset-background" : ""}`}
          />
        ))}
      </div>
      <div className="flex gap-4 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={status?.isDefault}
          />
          Mặc định (khách mới)
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="isTerminal"
            defaultChecked={status?.isTerminal}
          />
          Giai đoạn kết thúc (chốt/huỷ)
        </label>
      </div>
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {status ? "Cập nhật" : "Thêm"}
      </Button>
    </form>
  );
}
