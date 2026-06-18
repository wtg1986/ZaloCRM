"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { Loader2, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getContacts,
  getStatuses,
  setContactStatus,
  type Contact,
} from "@/lib/crm";
import { ApiError } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

const UNCLASSIFIED = "__none__";

export function PipelineBoard({ search }: { search: string }) {
  const { data: statusData } = useSWR("statuses", getStatuses);
  const { data, isLoading, mutate } = useSWR(["contacts-kanban", search], () =>
    getContacts({ search: search || undefined, limit: 200 }),
  );
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overCol, setOverCol] = React.useState<string | null>(null);

  const statuses = React.useMemo(
    () => (statusData?.statuses ?? []).slice().sort((a, b) => a.order - b.order),
    [statusData],
  );
  const contacts = React.useMemo(() => data?.contacts ?? [], [data]);

  // Cột: "Chưa phân loại" + các stage động.
  const columns = React.useMemo(
    () => [
      { id: UNCLASSIFIED, name: "Chưa phân loại", color: "#90A4AE" },
      ...statuses.map((s) => ({ id: s.id, name: s.name, color: s.color || "#6366F1" })),
    ],
    [statuses],
  );

  const byColumn = React.useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const col of columns) map.set(col.id, []);
    for (const c of contacts) {
      const key = c.statusId && map.has(c.statusId) ? c.statusId : UNCLASSIFIED;
      map.get(key)!.push(c);
    }
    return map;
  }, [columns, contacts]);

  async function move(contactId: string, colId: string) {
    const target = colId === UNCLASSIFIED ? null : colId;
    const c = contacts.find((x) => x.id === contactId);
    if (!c || (c.statusId ?? null) === target) return;
    // Optimistic: cập nhật cache ngay.
    mutate(
      data
        ? {
            ...data,
            contacts: contacts.map((x) =>
              x.id === contactId ? { ...x, statusId: target } : x,
            ),
          }
        : data,
      false,
    );
    try {
      await setContactStatus(contactId, target);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không đổi được trạng thái");
      mutate(); // rollback bằng refetch
    }
  }

  if (isLoading && !data) {
    return (
      <div className="grid flex-1 place-items-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {statuses.length === 0 ? (
        <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/40 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">
            Chưa có giai đoạn bán hàng nào. Tạo các giai đoạn (vd: Mới → Tư vấn →
            Chốt) để kéo-thả khách qua từng bước.
          </span>
          <Link
            href="/settings"
            className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
          >
            Tạo giai đoạn
          </Link>
        </div>
      ) : null}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex h-full gap-3">
        {columns.map((col) => {
          const items = byColumn.get(col.id) ?? [];
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.id);
              }}
              onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                if (id) move(id, col.id);
                setOverCol(null);
                setDragId(null);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors",
                overCol === col.id && "ring-2 ring-primary/50",
              )}
            >
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <span className="truncate text-sm font-semibold">{col.name}</span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {items.map((c) => (
                  <PipelineCard
                    key={c.id}
                    c={c}
                    onDragStart={() => setDragId(c.id)}
                  />
                ))}
                {items.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Kéo khách vào đây
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

function PipelineCard({
  c,
  onDragStart,
}: {
  c: Contact;
  onDragStart: () => void;
}) {
  const name = c.crmName || c.fullName || "Khách chưa rõ tên";
  const score = c.displayLeadScore ?? c.leadScore ?? 0;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", c.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      className="cursor-grab rounded-lg border bg-card p-2.5 shadow-xs transition-shadow hover:shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-center gap-2">
        <Avatar className="size-7">
          {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt={name} /> : null}
          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
        {score > 0 ? (
          <span className="shrink-0 rounded-full bg-muted px-1.5 text-xs font-semibold tabular-nums">
            {score}
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        {c.phone ? (
          <span className="inline-flex items-center gap-1">
            <Phone className="size-3" />
            {c.phone}
          </span>
        ) : null}
        {c.source ? <span className="truncate">· {c.source}</span> : null}
      </div>
    </div>
  );
}
