"use client";

import * as React from "react";
import useSWR from "swr";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyChatArt } from "@/components/ui/illustrations";
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
        <div className="flex flex-1 items-center justify-center bg-background">
          <EmptyState
            art={<EmptyChatArt />}
            title="Chọn một hội thoại để bắt đầu"
            description="Tất cả tin nhắn từ các nick Zalo của đội gom về đây — không sót một khách nào."
          />
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
