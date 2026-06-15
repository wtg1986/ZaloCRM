"use client";

import * as React from "react";
import useSWR from "swr";
import { MessageSquareDashed } from "lucide-react";
import { getZaloAccounts } from "@/lib/resources";
import { ConversationList } from "@/components/inbox/conversation-list";
import { MessageThread } from "@/components/inbox/message-thread";
import { FilterRail, type RailFilters } from "@/components/inbox/filter-rail";
import { NewMessageDialog } from "@/components/inbox/new-message-dialog";

export default function InboxPage() {
  const { data: accounts } = useSWR("zalo-accounts", getZaloAccounts);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [railFilters, setRailFilters] = React.useState<RailFilters>({});
  const [composeOpen, setComposeOpen] = React.useState(false);

  // Deep-link: đọc ?c=<id> lúc tải để khôi phục hội thoại đang mở (F5 / share link).
  React.useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("c");
    if (id) setSelectedId(id);
  }, []);

  const select = React.useCallback((id: string | null) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("c", id);
    else url.searchParams.delete("c");
    window.history.replaceState(null, "", url);
  }, []);

  return (
    <div className="flex h-full">
      <FilterRail value={railFilters} onChange={setRailFilters} />
      <ConversationList
        accounts={accounts ?? []}
        selectedId={selectedId}
        onSelect={(c) => select(c.id)}
        onCompose={() => setComposeOpen(true)}
        extraFilters={railFilters}
      />
      {selectedId ? (
        <MessageThread key={selectedId} conversationId={selectedId} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-background text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-muted">
            <MessageSquareDashed className="size-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Chọn một hội thoại để bắt đầu</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Tất cả tin nhắn từ các nick Zalo của đội gom về đây — không sót
              một khách nào.
            </p>
          </div>
        </div>
      )}

      {composeOpen ? (
        <NewMessageDialog
          accounts={accounts ?? []}
          onClose={() => setComposeOpen(false)}
          onOpened={(id) => select(id)}
        />
      ) : null}
    </div>
  );
}
