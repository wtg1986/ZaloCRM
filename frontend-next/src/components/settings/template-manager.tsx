"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  updateTemplate,
  type MessageTemplate,
} from "@/lib/chat-ops";
import { ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function TemplateManager() {
  const { data, isLoading, mutate } = useSWR("templates-all", () =>
    getTemplates(),
  );
  const templates = data?.templates ?? [];
  const [editing, setEditing] = React.useState<MessageTemplate | "new" | null>(
    null,
  );

  async function remove(id: string) {
    try {
      await deleteTemplate(id);
      await mutate();
      toast.success("Đã xoá mẫu tin");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không xoá được");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm">
            Mẫu tin nhanh {data ? `(${templates.length})` : ""}
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Câu trả lời soạn sẵn — chèn nhanh khi chat bằng phím &quot;/&quot;.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Thêm
        </Button>
      </CardHeader>
      <CardContent>
        {editing ? (
          <TemplateForm
            template={editing === "new" ? null : editing}
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
        ) : templates.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Chưa có mẫu tin nào.
          </p>
        ) : (
          <ul className="divide-y">
            {templates.map((t) => (
              <li key={t.id} className="flex items-start gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.content}
                  </p>
                </div>
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

function TemplateForm({
  template,
  onClose,
  onSaved,
}: {
  template: MessageTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  async function submit(form: FormData) {
    const name = String(form.get("name") || "").trim();
    const content = String(form.get("content") || "").trim();
    if (!name || !content) return;
    setBusy(true);
    try {
      if (template) await updateTemplate(template.id, { name, content });
      else await createTemplate({ name, content });
      toast.success(template ? "Đã cập nhật" : "Đã thêm mẫu tin");
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
          {template ? "Sửa mẫu tin" : "Mẫu tin mới"}
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
        defaultValue={template?.name}
        placeholder="Tên mẫu (vd: Chào khách)"
        required
        className="h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
      <textarea
        name="content"
        defaultValue={template?.content}
        placeholder="Nội dung tin nhắn..."
        required
        rows={3}
        className="w-full resize-none rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {template ? "Cập nhật" : "Thêm"}
      </Button>
    </form>
  );
}
