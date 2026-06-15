"use client";

import * as React from "react";
import useSWR from "swr";
import { ArrowDownWideNarrow, Inbox, PenSquare, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { prettyTagName } from "@/lib/tag-display";
import {
  conversationAvatarText,
  conversationTitle,
  getConversations,
  getConversationCounts,
  markRead,
  lastMessagePreview,
  type ConversationFilters,
} from "@/lib/resources";
import { relativeTime, minutesSince } from "@/lib/format";
import type { Conversation, ZaloAccount } from "@/lib/types";
import { getSocket } from "@/lib/socket";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TabKey = "all" | "unread" | "unreplied" | "stuck" | "ready";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "unread", label: "Chưa đọc" },
  { key: "unreplied", label: "Chưa rep" },
  { key: "stuck", label: "Đình trệ" },
  { key: "ready", label: "Sẵn sàng" },
];

const THREAD_TABS: { key: "" | "user" | "group"; label: string }[] = [
  { key: "", label: "Tất cả" },
  { key: "user", label: "Cá nhân" },
  { key: "group", label: "Nhóm" },
];

const SLA_MINUTES = 30;

export function ConversationList({
  accounts,
  selectedId,
  onSelect,
  onCompose,
  extraFilters,
}: {
  accounts: ZaloAccount[];
  selectedId: string | null;
  onSelect: (c: Conversation) => void;
  onCompose?: () => void;
  extraFilters?: Partial<ConversationFilters>;
}) {
  const [tab, setTab] = React.useState<TabKey>("all");
  const [threadType, setThreadType] = React.useState<"" | "user" | "group">("");
  const [sortMode, setSortMode] = React.useState<"recent" | "unread-first">(
    "recent",
  );
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [accountIds, setAccountIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  function toggleAccount(id: string) {
    setAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const filters: ConversationFilters = {
    accountIds,
    search: debounced || undefined,
    unread: tab === "unread" || undefined,
    unreplied: tab === "unreplied" || undefined,
    stuck: tab === "stuck" || undefined,
    ready: tab === "ready" || undefined,
    threadType: threadType || undefined,
    sortMode,
    limit: 60,
    ...extraFilters, // sale/giai đoạn/điểm từ filter rail trái
  };

  const key = ["conversations", JSON.stringify(filters)];
  const { data, isLoading, mutate } = useSWR(key, () =>
    getConversations(filters),
  );
  const { data: counts, mutate: mutateCounts } = useSWR(
    ["conv-counts", accountIds.join(",")],
    () => getConversationCounts(accountIds),
  );

  // Realtime: tin mới → revalidate list + counts. Đồng thời bù tin bị miss khi
  // máy ngủ / mất kết nối: socket reconnect hoặc tab hiện lại → refetch.
  React.useEffect(() => {
    const socket = getSocket();
    const onMsg = () => {
      mutate();
      mutateCounts();
    };
    socket.on("chat:message", onMsg);
    socket.on("connect", onMsg);
    const onVisible = () => {
      if (document.visibilityState === "visible") onMsg();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onMsg);
    return () => {
      socket.off("chat:message", onMsg);
      socket.off("connect", onMsg);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onMsg);
    };
  }, [mutate, mutateCounts]);

  // Bấm vào hội thoại → zero badge chưa đọc NGAY (optimistic) + markRead server,
  // không chờ khung chat mount. (Refetch sau sẽ giữ 0 vì server đã đánh dấu đọc.)
  const handleSelect = React.useCallback(
    (c: Conversation) => {
      if (c.unreadCount > 0) {
        markRead(c.id).catch(() => {});
        mutate(
          (prev) =>
            prev
              ? {
                  ...prev,
                  conversations: prev.conversations.map((x) =>
                    x.id === c.id ? { ...x, unreadCount: 0 } : x,
                  ),
                }
              : prev,
          false,
        );
        mutateCounts(
          (prev) =>
            prev
              ? { ...prev, unread: Math.max(0, (prev.unread ?? 0) - c.unreadCount) }
              : prev,
          false,
        );
      }
      onSelect(c);
    },
    [mutate, mutateCounts, onSelect],
  );

  const conversations = data?.conversations ?? [];

  function tabCount(k: TabKey): number | undefined {
    if (!counts) return undefined;
    if (k === "all") return counts.all;
    if (k === "unread") return counts.unread;
    if (k === "unreplied") return counts.unreplied;
    return undefined; // stuck/ready: BE counts không trả → ẩn số
  }

  return (
    <div className="flex h-full w-[340px] shrink-0 flex-col border-r bg-card">
      {/* Header */}
      <div className="space-y-2.5 border-b p-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold">Tin nhắn</h1>
          <div className="flex items-center gap-1">
            {data ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {data.total} hội thoại
              </span>
            ) : null}
            <SortMenu sortMode={sortMode} onChange={setSortMode} />
            {onCompose ? (
              <button
                onClick={onCompose}
                title="Tin nhắn mới"
                aria-label="Tin nhắn mới"
                className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <PenSquare className="size-3.5" /> Mới
              </button>
            ) : null}
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
            placeholder="Tìm khách, SĐT, nội dung..."
          />
        </div>

        {/* Lọc nick (đa-nick) */}
        {accounts.length > 1 ? (
          <div className="flex flex-wrap gap-1">
            <NickPill
              active={accountIds.length === 0}
              onClick={() => setAccountIds([])}
            >
              Tất cả nick
            </NickPill>
            {accounts.map((a) => (
              <NickPill
                key={a.id}
                active={accountIds.includes(a.id)}
                onClick={() => toggleAccount(a.id)}
                dot
              >
                {a.displayName || "Nick"}
              </NickPill>
            ))}
          </div>
        ) : null}

        {/* Tabs trạng thái (cuộn ngang) */}
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
          {TABS.map((t) => {
            const n = tabCount(t.key);
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  tab === t.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {n != null && n > 0 ? (
                  <span className="ml-1 tabular-nums opacity-80">{n}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Loại hội thoại */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {THREAD_TABS.map((t) => (
            <button
              key={t.key || "all"}
              onClick={() => setThreadType(t.key)}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                threadType === t.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ListSkeleton />
        ) : conversations.length === 0 ? (
          <EmptyState />
        ) : (
          <ul>
            {conversations.map((c) => (
              <ConversationRow
                key={c.id}
                c={c}
                active={c.id === selectedId}
                onClick={() => handleSelect(c)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NickPill({
  active,
  onClick,
  dot,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-accent",
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-info" /> : null}
      {children}
    </button>
  );
}

function SortMenu({
  sortMode,
  onChange,
}: {
  sortMode: "recent" | "unread-first";
  onChange: (m: "recent" | "unread-first") => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
            aria-label="Sắp xếp"
            title="Sắp xếp"
          >
            <ArrowDownWideNarrow className="size-4" />
          </button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onChange("recent")}>
          {sortMode === "recent" ? "● " : ""}Mới nhất lên trên
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("unread-first")}>
          {sortMode === "unread-first" ? "● " : ""}Chưa đọc lên trên
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ConversationRow({
  c,
  active,
  onClick,
}: {
  c: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  const title = conversationTitle(c);
  const unread = c.unreadCount > 0;
  const lastIsInbound = c.messages?.[0]?.senderType !== "self";
  const waiting = unread && lastIsInbound ? minutesSince(c.lastMessageAt) : 0;
  const overdue = waiting >= SLA_MINUTES;
  const tags = (c.crmTagsPerNick ?? []).slice(0, 2);
  const score = typeof c.leadScore === "number" ? c.leadScore : null;

  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "flex w-full items-start gap-3 border-b border-border/60 px-3 py-2.5 text-left transition-colors",
          active ? "bg-accent" : "hover:bg-accent/50",
        )}
      >
        <div className="relative shrink-0">
          <Avatar className="size-10">
            {c.contact?.avatarUrl ? (
              <AvatarImage src={c.contact.avatarUrl} alt={title} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {conversationAvatarText(c)}
            </AvatarFallback>
          </Avatar>
          {c.zaloAccount?.displayName ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-card ring-2 ring-card"
              title={`Nick: ${c.zaloAccount.displayName}`}
            >
              <span className="size-2.5 rounded-full bg-info" />
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "truncate text-sm",
                unread ? "font-semibold text-foreground" : "font-medium",
              )}
            >
              {title}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
              {relativeTime(c.lastMessageAt)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span
              className={cn(
                "truncate text-xs",
                unread ? "text-foreground/80" : "text-muted-foreground",
              )}
            >
              {lastMessagePreview(c)}
            </span>
            {overdue ? (
              <span className="shrink-0 rounded-full bg-overdue/15 px-1.5 py-0.5 text-[10px] font-semibold text-overdue tabular-nums">
                {waiting}′
              </span>
            ) : unread ? (
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-unread text-[11px] font-semibold text-primary-foreground tabular-nums">
                {c.unreadCount > 99 ? "99+" : c.unreadCount}
              </span>
            ) : null}
          </div>

          {/* Chip: giai đoạn + điểm + tag */}
          {(c.statusName || score != null || tags.length > 0) ? (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {c.statusName ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: `${c.statusColor || "#90A4AE"}22`,
                    color: c.statusColor || "#64748b",
                  }}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: c.statusColor || "#90A4AE" }}
                  />
                  {c.statusName}
                </span>
              ) : null}
              {score != null && score > 0 ? (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {score}đ
                </span>
              ) : null}
              {tags.map((t) => (
                <span
                  key={t}
                  className="truncate rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
                >
                  {prettyTagName(t)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </button>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted">
        <Inbox className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Chưa có hội thoại</p>
      <p className="text-xs text-muted-foreground">
        Kết nối một nick Zalo và khi có tin nhắn, chúng sẽ hiện ở đây.
      </p>
    </div>
  );
}
