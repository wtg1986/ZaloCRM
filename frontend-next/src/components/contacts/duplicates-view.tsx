"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Merge, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getDuplicates,
  mergeContactInto,
  dismissDuplicate,
  type DuplicateGroup,
  type DuplicateContact,
} from "@/lib/crm";
import { ApiError } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

function name(c: DuplicateContact) {
  return c.crmName || c.fullName || "Khách chưa rõ tên";
}
function initials(n: string) {
  const p = n.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export function DuplicatesView() {
  const { data, isLoading, mutate } = useSWR("duplicates", () => getDuplicates(1));
  const groups = data?.groups ?? [];

  if (isLoading) {
    return (
      <div className="grid flex-1 place-items-center py-20">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-muted-foreground">
        <CheckCircle2 className="size-8 text-success" />
        <p className="text-sm font-medium">Không phát hiện khách trùng lặp</p>
        <p className="max-w-xs text-xs">
          Hệ thống tự dò khách trùng (SĐT / Zalo UID). Khi có, bạn gộp tại đây.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="mb-3 text-sm text-muted-foreground">
        {data?.total} nhóm nghi trùng — chọn 1 khách <b>giữ lại</b> rồi gộp các bản
        còn lại vào (giữ toàn bộ hội thoại/nick/lịch sử).
      </p>
      <div className="space-y-3">
        {groups.map((g) => (
          <DuplicateGroupCard key={g.id} group={g} onDone={() => mutate()} />
        ))}
      </div>
    </div>
  );
}

function DuplicateGroupCard({
  group,
  onDone,
}: {
  group: DuplicateGroup;
  onDone: () => void;
}) {
  const [parentId, setParentId] = React.useState(group.contacts[0]?.id ?? "");
  const [busy, setBusy] = React.useState(false);

  async function merge() {
    const others = group.contacts.filter((c) => c.id !== parentId);
    if (others.length === 0 || busy) return;
    if (!confirm(`Gộp ${others.length} khách vào "${name(group.contacts.find((c) => c.id === parentId)!)}"?`))
      return;
    setBusy(true);
    let ok = 0;
    for (const o of others) {
      try {
        await mergeContactInto(o.id, parentId);
        ok++;
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Gộp lỗi");
      }
    }
    toast.success(`Đã gộp ${ok}/${others.length}`);
    setBusy(false);
    onDone();
  }

  async function dismiss() {
    setBusy(true);
    try {
      await dismissDuplicate(group.id);
      toast.success("Đã bỏ qua nhóm");
      onDone();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {group.contacts.map((c) => {
          const isParent = c.id === parentId;
          return (
            <button
              key={c.id}
              onClick={() => setParentId(c.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border p-2 text-left transition-colors",
                isParent ? "border-primary bg-primary/5" : "hover:bg-accent/40",
              )}
            >
              <Avatar className="size-8">
                {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt="" /> : null}
                <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                  {initials(name(c))}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name(c)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.phone || "—"} · 💬 {c._count?.conversations ?? 0} · 👥{" "}
                  {c._count?.friends ?? 0}
                </p>
              </div>
              {isParent ? (
                <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Giữ lại
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" onClick={merge} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Merge className="size-4" />}
          Gộp vào khách đã chọn
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss} disabled={busy}>
          <X className="size-4" /> Bỏ qua
        </Button>
      </div>
    </div>
  );
}
