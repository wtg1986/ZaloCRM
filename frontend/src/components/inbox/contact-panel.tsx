"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  CalendarDays,
  Loader2,
  MessageSquare,
  Send,
  StickyNote,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { prettyTagName } from "@/lib/tag-display";
import {
  addContactNote,
  getContact,
  getContactNotes,
  getEngagementTimeline,
  isFriend,
  promoteFriendToParent,
  type ContactNick,
  type ContactNote,
  type EngagementDay,
} from "@/lib/crm";
import { getCrmTags, updateFriendTags } from "@/lib/chat-ops";
import { dateLabel, relativeTime } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function scoreColor(s: number): string {
  if (s >= 70) return "text-success";
  if (s >= 40) return "text-warning";
  return "text-muted-foreground";
}
function scoreLevel(s: number): string {
  if (s >= 70) return "Cao";
  if (s >= 40) return "TB";
  if (s > 0) return "Thấp";
  return "—";
}
function trendLabel(t: number | null): string {
  if (t == null) return "—";
  if (t >= 20) return "↑ Tăng";
  if (t <= -20) return "↓ Giảm";
  return "→ Ổn định";
}

type Tab = "profile" | "relations" | "appointments";

export function ContactPanel({
  contactId,
  onClose,
}: {
  contactId: string;
  onClose: () => void;
}) {
  const { data: c, isLoading, mutate } = useSWR(["contact", contactId], () =>
    getContact(contactId),
  );
  const [tab, setTab] = React.useState<Tab>("profile");

  const name = c?.crmName || c?.fullName || "Khách chưa rõ tên";
  const score = c?.displayLeadScore ?? c?.leadScore ?? 0;
  const apts = c?.appointments ?? [];

  const nicks = c?.friends ?? [];
  const primaryNick = nicks[0];
  const TABS: { k: Tab; label: string }[] = [
    { k: "profile", label: "Hồ sơ" },
    { k: "relations", label: `Quan hệ${nicks.length ? ` (${nicks.length})` : ""}` },
    { k: "appointments", label: `Lịch hẹn${apts.length ? ` (${apts.length})` : ""}` },
  ];

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">Hồ sơ khách</h2>
        <button
          onClick={onClose}
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
          aria-label="Đóng"
        >
          <X className="size-4" />
        </button>
      </div>

      {isLoading && !c ? (
        <div className="grid flex-1 place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Score cards trên cùng (vạch màu) — Lead / Ưu tiên / Tương tác */}
          <div className="grid grid-cols-3 gap-2 p-3">
            <Stat
              icon="💰"
              label="LEAD"
              value={String(score)}
              tone={scoreColor(score)}
              sub={scoreLevel(score)}
              accent="bg-warning"
            />
            <Stat
              icon="🎯"
              label="ƯU TIÊN"
              value={String(c?.priorityScore ?? 0)}
              sub={scoreLevel(c?.priorityScore ?? 0)}
              accent="bg-destructive"
            />
            <Stat
              icon="💬"
              label="TƯƠNG TÁC"
              value={String(c?.engagementScore ?? 0)}
              sub={trendLabel(c?.engagementTrend ?? null)}
              accent="bg-info"
            />
          </div>

          {/* Danh tính */}
          <div className="flex items-center gap-3 px-4 pb-3">
            <Avatar className="size-12">
              {c?.avatarUrl ? <AvatarImage src={c.avatarUrl} alt={name} /> : null}
              <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold">{name}</p>
              {c?.zaloUid ? (
                <p className="truncate text-[11px] text-muted-foreground">
                  UID: {c.zaloUid}
                </p>
              ) : null}
              {c?.status ? (
                <span className="mt-0.5 inline-block rounded-full bg-info/15 px-2 py-0.5 text-[11px] font-medium capitalize text-info">
                  {c.status}
                </span>
              ) : null}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-y bg-muted/30 px-3 py-1.5">
            {TABS.map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  tab === t.k
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === "profile" ? (
              <div>
                <Section title="Thông tin">
                  <KvRow k="Tên Zalo" v={c?.fullName || name} />
                  <KvRow k="SĐT" v={c?.phone || "—"} />
                  {c?.email ? <KvRow k="Email" v={c.email} /> : null}
                  {c?.source ? <KvRow k="Nguồn" v={c.source} /> : null}
                  {c?.assignedUser?.fullName ? (
                    <KvRow k="Phụ trách" v={c.assignedUser.fullName} />
                  ) : null}
                </Section>
                {c?.tags && c.tags.length > 0 ? (
                  <Section title="Nhãn">
                    <div className="flex flex-wrap gap-1.5">
                      {c.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                        >
                          {prettyTagName(t)}
                        </span>
                      ))}
                    </div>
                  </Section>
                ) : null}
                {/* TIMELINE KH — ghi chú nội bộ */}
                <NotesSection contactId={contactId} />
                <EngagementHeatmap contactId={contactId} />
              </div>
            ) : tab === "relations" ? (
              <div>
                <Section
                  title={`💬 Nick CRM đang chăm (${nicks.length})`}
                  badge="per-nick"
                >
                  {nicks.length === 0 ? (
                    <Empty icon={MessageSquare} text="Chưa có nick nào" />
                  ) : (
                    <div className="space-y-2">
                      {nicks.map((f) => (
                        <NickCard
                          key={f.id}
                          f={f}
                          contactName={name}
                          contactUid={c?.zaloUid ?? null}
                          onChanged={() => mutate()}
                        />
                      ))}
                    </div>
                  )}
                </Section>
                {primaryNick ? (
                  <>
                    <Section title="🏷 Label Zalo (native)" badge="per-nick">
                      {(primaryNick.zaloLabels?.length ?? 0) === 0 ? (
                        <p className="text-xs italic text-muted-foreground">
                          Chưa có label nào — sync từ Zalo SDK
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {primaryNick.zaloLabels!.map((l) => (
                            <span
                              key={l}
                              className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                            >
                              {l}
                            </span>
                          ))}
                        </div>
                      )}
                    </Section>
                    <NickTagSection
                      friendId={primaryNick.id}
                      tags={primaryNick.crmTagsPerNick ?? []}
                      onChanged={() => mutate()}
                    />
                  </>
                ) : null}
              </div>
            ) : (
              <Section title="Lịch hẹn">
                {apts.length === 0 ? (
                  <Empty icon={CalendarDays} text="Chưa có lịch hẹn" />
                ) : (
                  <ul className="space-y-2">
                    {apts.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">
                          {a.title || "Lịch hẹn"}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {dateLabel(a.appointmentDate)}
                          {a.appointmentTime ? ` ${a.appointmentTime}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
  sub,
  accent,
}: {
  icon?: string;
  label: string;
  value: string;
  tone?: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border bg-muted/30 p-2 pt-2.5 text-center">
      {accent ? (
        <span className={cn("absolute inset-x-0 top-0 h-1", accent)} />
      ) : null}
      <div className="flex items-center justify-center gap-1 text-[9px] font-semibold tracking-wide text-muted-foreground">
        {icon ? <span>{icon}</span> : null}
        {label}
      </div>
      <div className={cn("text-xl font-bold tabular-nums", tone)}>{value}</div>
      {sub ? (
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b px-4 py-3 last:border-0">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        {badge ? (
          <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-medium normal-case text-warning">
            {badge}
          </span>
        ) : null}
      </h3>
      {children}
    </div>
  );
}

function NickCard({
  f,
  contactName,
  contactUid,
  onChanged,
}: {
  f: ContactNick;
  contactName: string;
  contactUid: string | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  async function promote() {
    if (busy || !confirm("Tách nick này thành KH Cha riêng?")) return;
    setBusy(true);
    try {
      await promoteFriendToParent(f.id);
      toast.success("Đã tách thành KH Cha riêng");
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không tách được");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-xl border p-2.5">
      {/* Nick (sale) header */}
      <div className="flex items-center gap-2">
        <Avatar className="size-7">
          {f.zaloAccount?.avatarUrl ? (
            <AvatarImage src={f.zaloAccount.avatarUrl} alt="" />
          ) : null}
          <AvatarFallback className="bg-info/15 text-[9px] text-info">
            {(f.zaloAccount?.displayName || "N").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {f.zaloAccount?.displayName || "Nick"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            Sale: {f.zaloAccount?.owner?.fullName || "—"}
          </p>
        </div>
        {isFriend(f.friendshipStatus) ? (
          <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
            ✓ Đã KB
          </span>
        ) : null}
      </div>

      {/* KH lồng */}
      <div className="mt-2 flex items-center gap-2 rounded-lg border-l-2 border-primary bg-muted/30 p-2">
        <Avatar className="size-7">
          {f.zaloAvatarUrl ? <AvatarImage src={f.zaloAvatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-primary/10 text-[9px] text-primary">
            {(contactName || "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {f.aliasInNick || f.zaloDisplayName || contactName}
          </p>
          {contactUid ? (
            <p className="truncate font-mono text-[10px] text-muted-foreground">
              UID: {contactUid}
            </p>
          ) : null}
        </div>
      </div>

      {/* Trạng thái + score */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Trạng thái KH:{" "}
          <span className="font-medium text-foreground">
            {f.statusRef?.name || "— đặt —"}
          </span>
        </span>
        <span className="text-muted-foreground">
          Score: <span className="font-semibold text-foreground">{f.leadScore ?? 0}</span>
        </span>
      </div>

      {/* Counter in/out */}
      <div className="mt-1.5 flex items-center gap-3 border-t pt-1.5 text-xs">
        <span className="inline-flex items-center gap-1">
          📥 <span className="font-medium tabular-nums">{f.totalInbound ?? 0}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          📤 <span className="font-medium tabular-nums">{f.totalOutbound ?? 0}</span>
        </span>
        <button
          onClick={promote}
          disabled={busy}
          className="ml-auto rounded-md border border-destructive/40 px-2 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          {busy ? "..." : "✂ Tách thành KH Cha riêng"}
        </button>
      </div>
    </div>
  );
}

function NickTagSection({
  friendId,
  tags,
  onChanged,
}: {
  friendId: string;
  tags: string[];
  onChanged: () => void;
}) {
  const { data } = useSWR("crm-tags-all", getCrmTags);
  const all = data?.tags ?? [];
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function save(next: string[]) {
    setBusy(true);
    try {
      await updateFriendTags(friendId, next);
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không cập nhật được tag");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <Section title="🏷 Tag riêng nick × KH" badge="per-nick">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
          >
            {prettyTagName(t)}
            <button
              onClick={() => save(tags.filter((x) => x !== t))}
              disabled={busy}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </span>
        ))}
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            disabled={busy}
            className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
          >
            + Thêm
          </button>
          {open ? (
            <div className="absolute z-10 mt-1 max-h-48 w-40 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
              {all.filter((t) => !tags.includes(t.name)).length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">Hết tag</p>
              ) : (
                all
                  .filter((t) => !tags.includes(t.name))
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => save([...tags, t.name])}
                      className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
                    >
                      {prettyTagName(t.name)}
                    </button>
                  ))
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function KvRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span className="min-w-0 truncate text-right font-medium">{v}</span>
    </div>
  );
}

function Empty({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 py-6 text-center text-muted-foreground">
      <Icon className="size-5" />
      <p className="text-xs">{text}</p>
    </div>
  );
}

function NotesSection({ contactId }: { contactId: string }) {
  const { data, mutate } = useSWR(["notes", contactId], () =>
    getContactNotes(contactId),
  );
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const notes = data?.notes ?? [];

  async function add() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await addContactNote(contactId, text);
      setBody("");
      await mutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không lưu được ghi chú");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="📋 Timeline khách hàng">
      <div className="mb-2 flex items-end gap-1.5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              add();
            }
          }}
          rows={1}
          placeholder="Thêm ghi chú..."
          className="max-h-24 min-h-9 flex-1 resize-none rounded-lg border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
        />
        <button
          onClick={add}
          disabled={!body.trim() || busy}
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          aria-label="Lưu ghi chú"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </button>
      </div>
      {notes.length === 0 ? (
        <Empty icon={StickyNote} text="Chưa có ghi chú" />
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <NoteItem key={n.id} n={n} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function NoteItem({ n }: { n: ContactNote }) {
  return (
    <li className="rounded-lg bg-muted/50 p-2">
      <p className="whitespace-pre-wrap wrap-break-word text-sm">{n.body}</p>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span>{n.author?.fullName || "Bạn"}</span>
        <span>·</span>
        <span>{relativeTime(n.createdAt)}</span>
      </div>
    </li>
  );
}

const PATTERN_LABELS: Record<string, string> = {
  hot: "🔥 Đang nóng lên",
  champion: "💎 Champion",
  stable: "📈 Ổn định",
  cooling: "⚠️ Đang nguội",
  cold: "😴 Lạnh",
  noise: "🌫️ Chưa đủ dữ liệu",
};

// Màu ô theo dailyIntensity (0..100) — 5 mức xanh như Zalo/Vue.
function cellLevel(v: number): string {
  if (v <= 0) return "bg-muted";
  if (v < 20) return "bg-success/30";
  if (v < 40) return "bg-success/50";
  if (v < 65) return "bg-success/70";
  return "bg-success";
}

function cellTooltip(d: EngagementDay): string {
  const [, mo, da] = d.date.split("T")[0].split("-");
  const dateStr = `${da}/${mo}`;
  if (d.dailyIntensity === 0) return `${dateStr} · Không có tương tác`;
  const parts = [`${dateStr} · Điểm ${d.dailyIntensity}/100`];
  if (d.reactionCount > 0) parts.push(`❤️ ${d.reactionCount}`);
  if (d.inboundMsgCount > 0) parts.push(`💬 KH ${d.inboundMsgCount}`);
  if (d.outboundMsgCount > 0) parts.push(`📤 Sale ${d.outboundMsgCount}`);
  if (d.callCount > 0) parts.push(`📞 ${d.callCount}`);
  if (d.missedCallCount > 0) parts.push(`📵 nhỡ ${d.missedCallCount}`);
  if (d.quoteReplyCount > 0) parts.push(`↩️ ${d.quoteReplyCount}`);
  if (d.voiceMsgCount > 0) parts.push(`🎤 ${d.voiceMsgCount}`);
  if (d.mediaShareCount > 0) parts.push(`📎 ${d.mediaShareCount}`);
  if (d.customerInitiated) parts.push("⚡ KH nhắn trước");
  return parts.join(" · ");
}

// Panel Engagement 4 tuần — heatmap + xu hướng + điểm + 6 chỉ số (như bản Vue).
function EngagementHeatmap({ contactId }: { contactId: string }) {
  const { data } = useSWR(["engagement", contactId], () =>
    getEngagementTimeline(contactId, 28),
  );

  if (!data) {
    return (
      <div className="m-4 h-56 animate-pulse rounded-xl bg-muted/50" />
    );
  }

  const days = data.timeline ?? [];
  const pattern = data.pattern;
  const trend = data.trend;
  const score = data.score;
  const bd = data.breakdown;

  // 28 ngày → 4 hàng tuần (cũ→mới) × 7 cột.
  const last28 = days.slice(-28);
  const weeks: EngagementDay[][] = [[], [], [], []];
  for (let i = 0; i < last28.length; i++) weeks[Math.floor(i / 7)].push(last28[i]);
  const rowLabels = ["T-3", "T-2", "T-1", "Tuần này"];
  const colLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  const trendIcon = trend === null ? "→" : trend >= 20 ? "↑" : trend <= -20 ? "↓" : "→";
  const trendCls =
    trend === null ? "text-muted-foreground" : trend >= 20 ? "text-success" : trend <= -20 ? "text-destructive" : "text-muted-foreground";
  const trendTxt =
    trend === null
      ? "Không đủ dữ liệu"
      : trend === 0
        ? "Không đổi"
        : `${trend > 0 ? "+" : ""}${trend}% so tuần trước`;

  return (
    <div className="m-4 rounded-xl border p-3">
      {/* Header: tiêu đề + badge pattern */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">📊 Engagement 4 tuần</h3>
        {pattern ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {PATTERN_LABELS[pattern] || pattern}
          </span>
        ) : null}
      </div>

      {days.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Chưa đủ dữ liệu tương tác
        </p>
      ) : (
        <>
          {/* Cột ngày */}
          <div className="grid grid-cols-[2rem_repeat(7,1fr)] gap-1">
            <span />
            {colLabels.map((l) => (
              <span key={l} className="text-center text-[9px] text-muted-foreground">
                {l}
              </span>
            ))}
          </div>
          {/* 4 hàng tuần */}
          {weeks.map((week, wi) => (
            <div
              key={wi}
              className="mt-1 grid grid-cols-[2rem_repeat(7,1fr)] items-center gap-1"
            >
              <span className="text-[9px] text-muted-foreground">
                {rowLabels[wi]}
              </span>
              {Array.from({ length: 7 }).map((_, di) => {
                const d = week[di];
                return (
                  <div
                    key={di}
                    title={d ? cellTooltip(d) : ""}
                    className={cn(
                      "aspect-square rounded-sm",
                      d ? cellLevel(d.dailyIntensity || 0) : "bg-transparent",
                    )}
                  />
                );
              })}
            </div>
          ))}

          {/* Xu hướng + điểm tuần */}
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Xu hướng:</span>
              <span className={cn("font-semibold", trendCls)}>
                {trendIcon} {trendTxt}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Điểm tuần này:</span>
              <span className="font-semibold text-primary tabular-nums">
                {score ?? "—"}/100
              </span>
            </div>
          </div>

          {/* 6 chỉ số */}
          {bd ? (
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t pt-3 text-xs">
              <BdItem label="❤️ Thả tim" value={`${bd.totalReactions} lần`} />
              <BdItem label="💬 Trả lời" value={`${bd.replyRate}%`} />
              <BdItem
                label="📞 Cuộc gọi"
                value={`${bd.totalCalls ?? 0} lần${
                  (bd.totalMissedCalls ?? 0) > 0 ? ` (${bd.totalMissedCalls} nhỡ)` : ""
                }`}
              />
              <BdItem label="📎 Ảnh/file/..." value={`${bd.totalMedia} lần`} />
              <BdItem label="⚡ KH chủ động" value={`${bd.daysInitiated} ngày`} />
              <BdItem label="↩️ Reply" value={`${bd.totalQuoteReplies ?? 0} lần`} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function BdItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 font-semibold">{value}</span>
    </div>
  );
}
