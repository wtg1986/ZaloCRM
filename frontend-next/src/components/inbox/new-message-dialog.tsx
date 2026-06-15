"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getFriends,
  openConversation,
  type FriendDto,
} from "@/lib/resources";
import type { ZaloAccount } from "@/lib/types";
import { ApiError } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function friendName(f: FriendDto): string {
  return (
    f.contact?.crmName ||
    f.contact?.fullName ||
    f.aliasInNick ||
    f.zaloDisplayName ||
    "Bạn Zalo"
  );
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export function NewMessageDialog({
  accounts,
  onClose,
  onOpened,
}: {
  accounts: ZaloAccount[];
  onClose: () => void;
  onOpened: (conversationId: string) => void;
}) {
  const connected = accounts.filter(
    (a) => a.status === "connected" || a.liveStatus === "connected",
  );
  const pool = connected.length ? connected : accounts;
  const [accountId, setAccountId] = React.useState<string | null>(
    pool.length === 1 ? pool[0].id : null,
  );
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [opening, setOpening] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useSWR(
    accountId ? ["friends", accountId, debounced] : null,
    () => getFriends(accountId as string, debounced || undefined),
  );
  const friends = data?.friends ?? [];

  async function pick(f: FriendDto) {
    if (!accountId || !f.zaloUidInNick || opening) return;
    setOpening(true);
    try {
      const res = await openConversation({
        zaloAccountId: accountId,
        externalThreadId: f.zaloUidInNick,
        contactId: f.contactId,
      });
      onOpened(res.id);
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không mở được hội thoại");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Tin nhắn mới</h2>
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Chọn nick gửi */}
        {pool.length > 1 ? (
          <div className="flex flex-wrap gap-1.5 border-b p-3">
            {pool.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccountId(a.id)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  accountId === a.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {a.displayName || "Nick"}
              </button>
            ))}
          </div>
        ) : null}

        {/* Tìm bạn */}
        <div className="border-b p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!accountId}
              placeholder={
                accountId ? "Tìm bạn theo tên, SĐT..." : "Chọn nick trước"
              }
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="min-h-40 flex-1 overflow-y-auto">
          {!accountId ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Chọn nick Zalo để bắt đầu
            </p>
          ) : isLoading ? (
            <div className="grid place-items-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : friends.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Không tìm thấy bạn
            </p>
          ) : (
            <ul>
              {friends.map((f) => {
                const name = friendName(f);
                const avatar = f.contact?.avatarUrl || f.zaloAvatarUrl;
                return (
                  <li key={f.id}>
                    <button
                      onClick={() => pick(f)}
                      disabled={opening || !f.zaloUidInNick}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent/50 disabled:opacity-50"
                    >
                      <Avatar className="size-8">
                        {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
                        <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                          {initials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {name}
                        </span>
                        {f.contact?.phone ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {f.contact.phone}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
