"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Search,
  Users,
  Phone,
  MessageSquare,
  CalendarDays,
  Plus,
  Upload,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Star,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getContacts,
  getStatuses,
  getContact,
  assignContact,
  setContactStatus,
  deleteContact,
  getFilterPresets,
  createFilterPreset,
  deleteFilterPreset,
  type Contact,
  type ContactQuery,
  type ContactSort,
} from "@/lib/crm";
import { openConversation } from "@/lib/resources";
import { getUsers } from "@/lib/team";
import { useCan } from "@/lib/permissions";
import { relativeTime } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectItem, SelectGroup } from "@/components/ui/select";
import { PipelineBoard } from "@/components/contacts/pipeline-board";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { ImportDialog } from "@/components/contacts/import-dialog";
import { ContactDetailDrawer } from "@/components/contacts/contact-detail-drawer";
import { DuplicatesView } from "@/components/contacts/duplicates-view";

const PAGE_SIZE = 30;

const SORTS: { k: ContactSort; label: string }[] = [
  { k: "recent", label: "Mới tương tác" },
  { k: "created", label: "Mới thêm" },
  { k: "oldest", label: "Cũ nhất" },
  { k: "name", label: "Tên A→Z" },
  { k: "score", label: "Điểm cao" },
];

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function scoreColor(score: number): string {
  if (score >= 70) return "bg-success/15 text-success";
  if (score >= 40) return "bg-warning/15 text-warning";
  return "bg-muted text-muted-foreground";
}

type AdvFilters = Pick<
  ContactQuery,
  "statusId" | "assignedUserId" | "hasZalo" | "unassigned" | "scoreMin" | "scoreMax" | "source"
>;

export default function ContactsPage() {
  const router = useRouter();
  const can = useCan();
  const canEdit = can("contact", "create");
  const canDelete = can("contact", "delete");

  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [view, setView] = React.useState<"list" | "pipeline" | "duplicates">("list");
  const [sort, setSort] = React.useState<ContactSort>("recent");
  const [filters, setFilters] = React.useState<AdvFilters>({});
  const [showAdv, setShowAdv] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [editing, setEditing] = React.useState<Contact | null | "new">(null);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [bulkAction, setBulkAction] = React.useState("");
  const [exporting, setExporting] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: statusData } = useSWR("statuses", getStatuses);
  const { data: userData } = useSWR("team-users", getUsers);
  const { data: presetData, mutate: mutatePresets } = useSWR(
    "filter-presets",
    getFilterPresets,
  );
  const statuses = statusData?.statuses ?? [];
  const users = (userData?.users ?? []).filter((u) => u.isActive);
  const presets = presetData?.presets ?? [];
  const statusMap = React.useMemo(
    () => new Map(statuses.map((s) => [s.id, s])),
    [statuses],
  );

  const baseQuery: ContactQuery = {
    search: debounced || undefined,
    sort,
    ...filters,
  };
  const { data, isLoading, mutate } = useSWR(
    ["contacts", baseQuery, page],
    () => getContacts({ ...baseQuery, page, limit: PAGE_SIZE }),
  );
  const contacts = data?.contacts ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function setFilter(patch: Partial<AdvFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
    setSelected(new Set());
  }
  function clearFilters() {
    setFilters({});
    setSearch("");
    setSort("recent");
    setPage(1);
  }

  function toggleSel(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  const allOnPageSelected =
    contacts.length > 0 && contacts.every((c) => selected.has(c.id));
  function toggleSelectAll() {
    setSelected((s) => {
      const n = new Set(s);
      if (allOnPageSelected) contacts.forEach((c) => n.delete(c.id));
      else contacts.forEach((c) => n.add(c.id));
      return n;
    });
  }

  async function runBulk() {
    const ids = [...selected];
    if (!bulkAction || ids.length === 0) return;
    const [kind, value] = bulkAction.split(":");
    if (kind === "delete" && !confirm(`Xoá ${ids.length} khách hàng?`)) return;
    toast.message(`Đang xử lý ${ids.length} khách…`);
    let ok = 0;
    for (const id of ids) {
      try {
        if (kind === "assign") await assignContact(id, value);
        else if (kind === "stage") await setContactStatus(id, value || null);
        else if (kind === "delete") await deleteContact(id);
        ok++;
      } catch {
        /* skip */
      }
    }
    toast.success(`Xong ${ok}/${ids.length}`);
    setSelected(new Set());
    setBulkAction("");
    mutate();
  }

  async function exportCsv() {
    if (exporting) return;
    setExporting(true);
    try {
      const all = await getContacts({ ...baseQuery, page: 1, limit: 5000 });
      const rows = all.contacts.map((c) => [
        c.crmName || c.fullName || "",
        c.phone || "",
        c.email || "",
        c.source || "",
        c.statusId ? statusMap.get(c.statusId)?.name || "" : "",
        c.assignedUser?.fullName || "",
        String(c.displayLeadScore ?? c.leadScore ?? 0),
      ]);
      const header = ["Tên", "SĐT", "Email", "Nguồn", "Giai đoạn", "Phụ trách", "Điểm"];
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const csv = "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `khach-hang-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Đã xuất ${all.contacts.length} khách`);
    } catch {
      toast.error("Xuất CSV thất bại");
    } finally {
      setExporting(false);
    }
  }

  // Mở chat nhanh từ 1 khách (tìm nick → mở/tạo hội thoại → sang Inbox).
  async function openChat(contactId: string) {
    try {
      const c = await getContact(contactId);
      const friend = c.friends?.find((f) => f.zaloAccount?.id && f.zaloUidInNick);
      if (!friend?.zaloAccount?.id || !friend.zaloUidInNick) {
        toast.error("Khách chưa liên kết nick Zalo");
        return;
      }
      const res = await openConversation({
        zaloAccountId: friend.zaloAccount.id,
        externalThreadId: friend.zaloUidInNick,
        contactId,
      });
      router.push(`/inbox?c=${res.id}`);
    } catch {
      toast.error("Không mở được chat");
    }
  }

  // Saved segments.
  async function savePreset() {
    const name = prompt("Tên phân khúc (vd: KH chưa phụ trách điểm cao):");
    if (!name?.trim()) return;
    try {
      await createFilterPreset({
        name: name.trim(),
        emoji: "⭐",
        filterJson: { search: debounced || undefined, sort, ...filters },
      });
      toast.success("Đã lưu phân khúc");
      mutatePresets();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không lưu được");
    }
  }
  function applyPreset(fj: ContactQuery) {
    setSearch(fj.search ?? "");
    setSort((fj.sort as ContactSort) ?? "recent");
    setFilters({
      statusId: fj.statusId,
      assignedUserId: fj.assignedUserId,
      hasZalo: fj.hasZalo,
      unassigned: fj.unassigned,
      scoreMin: fj.scoreMin,
      scoreMax: fj.scoreMax,
      source: fj.source,
    });
    setPage(1);
  }

  const advCount =
    (filters.unassigned ? 1 : 0) +
    (filters.scoreMin != null || filters.scoreMax != null ? 1 : 0) +
    (filters.source ? 1 : 0);
  const hasAnyFilter =
    !!filters.statusId || !!filters.assignedUserId || !!filters.hasZalo || advCount > 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Khách hàng"
        description={
          data ? `${total.toLocaleString("vi-VN")} khách hàng` : "Danh bạ khách"
        }
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {([
              { k: "list", label: "Danh sách" },
              { k: "pipeline", label: "Pipeline" },
              { k: "duplicates", label: "Trùng lặp" },
            ] as const).map((t) => (
              <button
                key={t.k}
                onClick={() => setView(t.k)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  view === t.k
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {view !== "duplicates" ? (
            <div className="relative w-52">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9"
                placeholder="Tìm tên, SĐT..."
              />
            </div>
          ) : null}
          {canEdit && view === "list" ? (
            <>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting}>
                <Download className="size-4" /> Xuất
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
                <Upload className="size-4" /> Nhập
              </Button>
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus className="size-4" /> Thêm KH
              </Button>
            </>
          ) : null}
        </div>
      </PageHeader>

      {view === "pipeline" ? (
        <PipelineBoard search={debounced} />
      ) : view === "duplicates" ? (
        <DuplicatesView />
      ) : (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 border-b px-6 py-2">
            <Select className="h-8 px-2 text-xs" value={sort} onValueChange={(v) => { setSort(v as ContactSort); setPage(1); }}>
              {SORTS.map((s) => (
                <SelectItem key={s.k} value={s.k}>Sắp xếp: {s.label}</SelectItem>
              ))}
            </Select>
            <Select className="h-8 px-2 text-xs" value={filters.statusId ?? ""} onValueChange={(v) => setFilter({ statusId: v || undefined })}>
              <SelectItem value="">Mọi giai đoạn</SelectItem>
              {statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </Select>
            <Select className="h-8 px-2 text-xs" value={filters.assignedUserId ?? ""} onValueChange={(v) => setFilter({ assignedUserId: v || undefined })}>
              <SelectItem value="">Mọi phụ trách</SelectItem>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.fullName || u.email}</SelectItem>)}
            </Select>
            <button
              onClick={() => setShowAdv((v) => !v)}
              className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs", advCount > 0 ? "border-primary text-primary" : "text-muted-foreground hover:bg-accent")}
            >
              <SlidersHorizontal className="size-3" /> Lọc nâng cao{advCount ? ` (${advCount})` : ""}
            </button>
            {hasAnyFilter || debounced ? (
              <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
                <X className="size-3" /> Xoá lọc
              </button>
            ) : null}
            <button onClick={savePreset} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
              <Star className="size-3" /> Lưu phân khúc
            </button>

            {/* Bulk bar */}
            {selected.size > 0 && canEdit ? (
              <div className="ml-auto flex items-center gap-2 rounded-lg bg-primary/10 px-2 py-1">
                <span className="text-xs font-medium">Đã chọn {selected.size}</span>
                <Select className="h-8 px-2 text-xs" placeholder="Hành động…" value={bulkAction} onValueChange={setBulkAction}>
                  <SelectGroup label="Gán phụ trách">
                    {users.map((u) => <SelectItem key={u.id} value={`assign:${u.id}`}>→ {u.fullName || u.email}</SelectItem>)}
                  </SelectGroup>
                  <SelectGroup label="Đổi giai đoạn">
                    <SelectItem value="stage:">Chưa phân loại</SelectItem>
                    {statuses.map((s) => <SelectItem key={s.id} value={`stage:${s.id}`}>{s.name}</SelectItem>)}
                  </SelectGroup>
                  {canDelete ? <SelectGroup label="Khác"><SelectItem value="delete:">🗑 Xoá</SelectItem></SelectGroup> : null}
                </Select>
                <Button size="sm" disabled={!bulkAction} onClick={runBulk}>Áp dụng</Button>
                <button onClick={() => setSelected(new Set())} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
              </div>
            ) : null}
          </div>

          {/* Lọc nâng cao (mở rộng) */}
          {showAdv ? (
            <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 px-6 py-2 text-xs">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={filters.unassigned === "true"} onChange={(e) => setFilter({ unassigned: e.target.checked ? "true" : undefined })} className="size-3.5 accent-primary" />
                Chưa phụ trách
              </label>
              <Select className="h-8 px-2 text-xs" value={filters.hasZalo ?? ""} onValueChange={(v) => setFilter({ hasZalo: (v || undefined) as ContactQuery["hasZalo"] })}>
                <SelectItem value="">Zalo: tất cả</SelectItem>
                <SelectItem value="true">Có Zalo</SelectItem>
                <SelectItem value="false">Không Zalo</SelectItem>
              </Select>
              <span className="flex items-center gap-1">
                Điểm
                <input type="number" min={0} max={100} placeholder="từ" value={filters.scoreMin ?? ""} onChange={(e) => setFilter({ scoreMin: e.target.value ? Number(e.target.value) : undefined })} className="h-8 w-16 rounded-lg border bg-background px-2 outline-none" />
                <input type="number" min={0} max={100} placeholder="đến" value={filters.scoreMax ?? ""} onChange={(e) => setFilter({ scoreMax: e.target.value ? Number(e.target.value) : undefined })} className="h-8 w-16 rounded-lg border bg-background px-2 outline-none" />
              </span>
              <input placeholder="Nguồn (vd: Facebook)" value={filters.source ?? ""} onChange={(e) => setFilter({ source: e.target.value || undefined })} className="h-8 w-40 rounded-lg border bg-background px-2 outline-none" />
            </div>
          ) : null}

          {/* Saved segments */}
          {presets.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 border-b px-6 py-1.5">
              {presets.map((p) => (
                <span key={p.id} className="group inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs">
                  <button onClick={() => applyPreset(p.filterJson)}>{p.emoji} {p.name}</button>
                  <button onClick={async () => { await deleteFilterPreset(p.id); mutatePresets(); }} className="text-muted-foreground opacity-0 group-hover:opacity-100">×</button>
                </span>
              ))}
            </div>
          ) : null}

          {/* Column header */}
          <div className="flex items-center gap-3 border-b bg-muted/30 px-6 py-2 text-xs font-medium text-muted-foreground">
            {canEdit ? <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} className="size-4 shrink-0 accent-primary" /> : null}
            <span className="min-w-0 flex-1">Khách hàng</span>
            <span className="hidden w-32 shrink-0 md:block">SĐT</span>
            <span className="hidden w-28 shrink-0 md:block">Giai đoạn</span>
            <span className="hidden w-28 shrink-0 md:block">Phụ trách</span>
            <span className="hidden w-12 shrink-0 text-center md:block">Điểm</span>
            <span className="hidden w-24 shrink-0 text-right md:block">Hoạt động</span>
            <span className="w-16 shrink-0" />
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && !data ? (
              <TableSkeleton />
            ) : contacts.length === 0 ? (
              <Empty search={debounced} canAdd={canEdit} onAdd={() => setEditing("new")} />
            ) : (
              <div className="divide-y">
                {contacts.map((c) => (
                  <ContactRow
                    key={c.id}
                    c={c}
                    stageName={c.statusId ? statusMap.get(c.statusId)?.name : undefined}
                    stageColor={c.statusId ? statusMap.get(c.statusId)?.color : undefined}
                    selected={selected.has(c.id)}
                    selectable={canEdit}
                    canEdit={canEdit}
                    onToggle={() => toggleSel(c.id)}
                    onOpen={() => setDetailId(c.id)}
                    onChat={() => openChat(c.id)}
                    onEdit={() => setEditing(c)}
                  />
                ))}
              </div>
            )}
          </div>

          {total > 0 ? (
            <div className="flex items-center justify-between border-t px-6 py-2.5 text-sm">
              <span className="text-xs text-muted-foreground">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total.toLocaleString("vi-VN")} khách
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="size-4" /> Trước
                </Button>
                <span className="px-2 text-xs tabular-nums text-muted-foreground">Trang {page}/{totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Sau <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {editing !== null ? (
        <ContactFormDialog
          contact={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); mutate(); }}
        />
      ) : null}
      {importing ? <ImportDialog onClose={() => setImporting(false)} onDone={() => mutate()} /> : null}
      {detailId ? (
        <ContactDetailDrawer
          contactId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            const c = contacts.find((x) => x.id === detailId);
            if (c) { setDetailId(null); setEditing(c); }
          }}
        />
      ) : null}
    </div>
  );
}

function ContactRow({
  c,
  stageName,
  stageColor,
  selected,
  selectable,
  canEdit,
  onToggle,
  onOpen,
  onChat,
  onEdit,
}: {
  c: Contact;
  stageName?: string;
  stageColor?: string | null;
  selected: boolean;
  selectable: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onChat: () => void;
  onEdit: () => void;
}) {
  const name = c.crmName || c.fullName || "Khách chưa rõ tên";
  const score = c.displayLeadScore ?? c.leadScore ?? 0;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div
      onClick={onOpen}
      className={cn(
        "group flex cursor-pointer items-center gap-3 px-6 py-2.5 transition-colors hover:bg-accent/40",
        selected && "bg-primary/5",
      )}
    >
      {selectable ? (
        <input type="checkbox" checked={selected} onChange={onToggle} onClick={stop} className="size-4 shrink-0 accent-primary" />
      ) : null}
      {/* Khách hàng (flex-1) */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar className="size-9">
          {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt={name} /> : null}
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {c._count ? (
              <>
                <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" />{c._count.conversations}</span>
                <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{c._count.appointments ?? 0}</span>
              </>
            ) : null}
            {c.source ? <span className="truncate">· {c.source}</span> : null}
          </div>
        </div>
      </div>
      {/* SĐT */}
      <div className="hidden w-32 shrink-0 text-sm text-muted-foreground md:block">
        {c.phone ? <span className="inline-flex items-center gap-1"><Phone className="size-3" />{c.phone}</span> : "—"}
      </div>
      {/* Giai đoạn */}
      <div className="hidden w-28 shrink-0 md:block">
        {stageName ? (
          <span className="inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${stageColor || "#6366F1"}22`, color: stageColor || "#6366f1" }}>{stageName}</span>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </div>
      {/* Phụ trách */}
      <div className="hidden w-28 shrink-0 truncate text-xs text-muted-foreground md:block">{c.assignedUser?.fullName || "—"}</div>
      {/* Điểm */}
      <div className="hidden w-12 shrink-0 text-center md:block">
        <span className={cn("inline-flex min-w-7 justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums", scoreColor(score))}>{score}</span>
      </div>
      {/* Hoạt động */}
      <div className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground md:block">{c.lastActivity ? relativeTime(c.lastActivity) : "—"}</div>
      {/* Hành động (cố định w-16) */}
      <div className="flex w-16 shrink-0 items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={(e) => { stop(e); onChat(); }} title="Mở chat" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent">
          <MessageSquare className="size-4" />
        </button>
        {canEdit ? (
          <button onClick={(e) => { stop(e); onEdit(); }} title="Sửa" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent">
            <Pencil className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-6 py-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

function Empty({ search, canAdd, onAdd }: { search: string; canAdd: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-24 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted">
        <Users className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{search ? "Không tìm thấy khách phù hợp" : "Chưa có khách hàng"}</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        {search ? "Thử từ khoá khác hoặc số điện thoại." : "Thêm thủ công, nhập CSV, hoặc khách tự xuất hiện khi nhắn qua Zalo."}
      </p>
      {!search && canAdd ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={onAdd}><Plus className="size-4" /> Thêm khách hàng</Button>
      ) : null}
    </div>
  );
}
