"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Loader2, MessageSquare, Pencil } from "lucide-react";
import { getContact } from "@/lib/crm";
import { openConversation } from "@/lib/resources";
import { ContactPanel } from "@/components/inbox/contact-panel";
import { Button } from "@/components/ui/button";

export function ContactDetailDrawer({
  contactId,
  onClose,
  onEdit,
}: {
  contactId: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  const router = useRouter();
  // Chia sẻ cache SWR với ContactPanel (cùng key) → không fetch 2 lần.
  const { data: c } = useSWR(["contact", contactId], () => getContact(contactId));
  const [opening, setOpening] = React.useState(false);

  async function openChat() {
    const friend = c?.friends?.find((f) => f.zaloAccount?.id && f.zaloUidInNick);
    if (!friend?.zaloAccount?.id || !friend.zaloUidInNick) {
      toast.error("Khách chưa liên kết nick Zalo để mở chat");
      return;
    }
    setOpening(true);
    try {
      const res = await openConversation({
        zaloAccountId: friend.zaloAccount.id,
        externalThreadId: friend.zaloUidInNick,
        contactId,
      });
      router.push(`/inbox?c=${res.id}`);
    } catch {
      toast.error("Không mở được chat");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex h-full w-80 flex-col bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-l px-3 py-2">
          <Button size="sm" className="flex-1" onClick={openChat} disabled={opening}>
            {opening ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MessageSquare className="size-4" />
            )}
            Mở chat
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="size-4" /> Sửa
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <ContactPanel contactId={contactId} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
