"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createCrmTag,
  deleteCrmTag,
  getCrmTags,
  updateCrmTag,
  type CrmTag,
} from "@/lib/chat-ops";
import { ApiError } from "@/lib/api";
import { prettyTagName } from "@/lib/tag-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const COLORS = [
  "#6366F1","#3B82F6","#06B6D4","#10B981","#84CC16",
  "#F59E0B","#EF4444","#EC4899","#8B5CF6","#90A4AE",
];

export function TagManager() {
  const { data, isLoading, mutate } = useSWR("crm-tags-all", getCrmTags);
  const tags = data?.tags ?? [];
  const [editing, setEditing] = React.useState<CrmTag | "new" | null>(null);

  async function remove(id: string) {
    try {
      await deleteCrmTag(id);
      await mutate();
      toast.success("Đã xoá nhãn");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không xoá được");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm">
            Nhãn CRM {data ? `(${tags.length})` : ""}
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Nhãn màu phân loại khách — dùng để lọc &amp; chăm sóc.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Thêm
        </Button>
      </CardHeader>
      <CardContent>
        {editing ? (
          <TagForm
            tag={editing === "new" ? null : editing}
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
        ) : tags.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Chưa có nhãn nào.
          </p>
        ) : (
          <ul className="divide-y">
            {tags.map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-2">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: t.color || "#90A4AE" }}
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {prettyTagName(t.name)}
                </span>
                {typeof t.usageCount === "number" ? (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {t.usageCount}
                  </span>
                ) : null}
                <button
                  onClick={() => setEditing(t)}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                  aria-label="Sửa"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => remove(t.id)}
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

function TagForm({
  tag,
  onClose,
  onSaved,
}: {
  tag: CrmTag | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [color, setColor] = React.useState(tag?.color || COLORS[0]);

  async function submit(form: FormData) {
    const name = String(form.get("name") || "").trim();
    const emoji = String(form.get("emoji") || "").trim() || undefined;
    if (!name) return;
    setBusy(true);
    try {
      if (tag) await updateCrmTag(tag.id, { name, color, emoji: emoji ?? null });
      else await createCrmTag({ name, color, emoji });
      toast.success(tag ? "Đã cập nhật" : "Đã thêm nhãn");
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
          {tag ? "Sửa nhãn" : "Nhãn mới"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-accent"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="flex gap-2">
        <input
          name="emoji"
          defaultValue={tag?.emoji ?? ""}
          placeholder="🏷️"
          maxLength={2}
          className="h-9 w-12 rounded-md border bg-background text-center text-sm outline-none"
        />
        <input
          name="name"
          defaultValue={tag?.name}
          placeholder="Tên nhãn (vd: VIP)"
          required
          className="h-9 flex-1 rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>
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
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {tag ? "Cập nhật" : "Thêm"}
      </Button>
    </form>
  );
}
