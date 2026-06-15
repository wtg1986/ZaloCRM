"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  BarChart3,
  Check,
  CheckCheck,
  Clock3,
  Copy,
  File as FileIcon,
  Forward,
  Loader2,
  MessagesSquare,
  MoreVertical,
  Pencil,
  Phone,
  Reply,
  Search,
  IdCard,
  Plus,
  Smile,
  Tag as TagIcon,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  conversationAvatarText,
  conversationTitle,
  getConversation,
  getConversations,
  getUserInfoBatch,
  getMessages,
  markRead,
  sendMessage,
  uploadAttachments,
  uploadImages,
  type GroupMemberProfile,
} from "@/lib/resources";
import {
  QUICK_REACTIONS,
  editMessage,
  forwardMessage,
  getCrmTags,
  quotePreview,
  reactToMessage,
  recallMessage,
  sendSticker,
  updateFriendTags,
  type StickerItem,
} from "@/lib/chat-ops";
import type { SendStyle, SendMention } from "@/lib/resources";
import { Composer } from "@/components/inbox/composer";
import { ContactPanel } from "@/components/inbox/contact-panel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clockTime, dayLabel } from "@/lib/format";
import {
  actionMessage,
  callInfo,
  cardInfo,
  displayText,
  extractMediaUrl,
  fileInfo,
  imageUrl,
  isRecallEvent,
  linkInfo,
  mediaCaption,
  pollInfo,
  stickerParams,
  stickerUrl,
  videoThumb,
  videoUrl,
} from "@/lib/media";
import { AnimatedSticker } from "@/components/inbox/animated-sticker";
import { ApiError } from "@/lib/api";
import type { ChatMessage, ChatMessageEvent, Conversation } from "@/lib/types";
import { assignContact, isFriend } from "@/lib/crm";
import { prettyTagName } from "@/lib/tag-display";
import { getAutoTagDef } from "@/lib/auto-tags";
import {
  assignZaloLabel,
  getZaloLabels,
  recallFriendRequest,
  sendCard,
  sendFriendRequest,
  unfriend,
} from "@/lib/zalo-actions";
import { getUsers } from "@/lib/team";
import { useAuth } from "@/lib/auth";
import { getSocket } from "@/lib/socket";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Khoảng cách gộp nhóm: cùng người gửi + cách nhau < 5 phút.
const GROUP_GAP_MS = 5 * 60 * 1000;

function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// Gom ảnh liên tiếp cùng albumKey thành 1 hàng (album lưới).
function buildRows(msgs: ChatMessage[]): ChatMessage[][] {
  const rows: ChatMessage[][] = [];
  for (let i = 0; i < msgs.length; ) {
    const m = msgs[i];
    if (m.contentType === "image" && m.albumKey) {
      const key = m.albumKey;
      const g = [m];
      let j = i + 1;
      while (
        j < msgs.length &&
        msgs[j].contentType === "image" &&
        msgs[j].albumKey === key
      ) {
        g.push(msgs[j]);
        j++;
      }
      rows.push(g);
      i = j;
    } else {
      rows.push([m]);
      i++;
    }
  }
  return rows;
}

export function MessageThread({ conversationId }: { conversationId: string }) {
  const convId = conversationId;
  // Header lấy từ endpoint chi tiết (luôn tươi) — không dùng snapshot từ list.
  const { data: conversation, mutate: mutateConv } = useSWR(
    ["conversation", convId],
    () => getConversation(convId),
  );
  // Phân trang theo limit tăng dần — cuộn lên đầu sẽ kéo thêm tin cũ.
  const [limit, setLimit] = React.useState(50);
  const { data, isLoading, mutate } = useSWR(
    ["messages", convId, limit],
    () => getMessages(convId, limit),
    { revalidateOnFocus: false, keepPreviousData: true },
  );
  const loadingOlderRef = React.useRef(false);
  const prevHeightRef = React.useRef(0);

  const [sending, setSending] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [lightbox, setLightbox] = React.useState<string | null>(null);
  const [replyTo, setReplyTo] = React.useState<ChatMessage | null>(null);
  const [editing, setEditing] = React.useState<ChatMessage | null>(null);
  const [forwarding, setForwarding] = React.useState<ChatMessage | null>(null);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [typing, setTyping] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const messages = React.useMemo(() => data?.messages ?? [], [data]);
  // Tìm trong hội thoại — lọc client-side theo nội dung.
  const shown = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => (m.content || "").toLowerCase().includes(q));
  }, [messages, search]);
  const rows = React.useMemo(() => buildRows(shown), [shown]);
  const lastSelfId = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderType === "self") return messages[i].id;
    }
    return null;
  }, [messages]);

  const total = data?.total ?? 0;
  const canLoadMore = messages.length < total;

  // Reset phân trang khi đổi hội thoại.
  React.useEffect(() => {
    setLimit(50);
  }, [convId]);

  // Quản lý cuộn: vừa load tin cũ → giữ nguyên vị trí; còn lại → xuống đáy.
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (loadingOlderRef.current) {
      el.scrollTop = el.scrollHeight - prevHeightRef.current;
      loadingOlderRef.current = false;
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Cuộn gần đỉnh → kéo thêm tin cũ (tăng limit, giữ vị trí cuộn).
  const onScrollMessages = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingOlderRef.current) return;
    if (el.scrollTop < 80 && canLoadMore) {
      loadingOlderRef.current = true;
      prevHeightRef.current = el.scrollHeight;
      setLimit((l) => l + 50);
    }
  }, [canLoadMore]);

  React.useEffect(() => {
    markRead(convId).catch(() => {});
  }, [convId]);

  // Realtime: tin thuộc hội thoại đang mở → chèn vào cuối.
  React.useEffect(() => {
    const socket = getSocket();
    const onMsg = (evt: ChatMessageEvent) => {
      if (evt.conversationId !== convId) return;
      mutate((prev) => {
        if (!prev) return prev;
        if (prev.messages.some((m) => m.id === evt.message.id)) return prev;
        return { ...prev, messages: [...prev.messages, evt.message] };
      }, false);
    };
    socket.on("chat:message", onMsg);
    return () => {
      socket.off("chat:message", onMsg);
    };
  }, [convId, mutate]);

  // Bù tin bị miss khi máy ngủ / mất kết nối: socket reconnect HOẶC tab hiện
  // lại → refetch tin nhắn + header (server đã lưu DB, chỉ cần kéo về).
  React.useEffect(() => {
    const socket = getSocket();
    const resync = () => {
      mutate();
      mutateConv();
    };
    socket.on("connect", resync);
    const onVisible = () => {
      if (document.visibilityState === "visible") resync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", resync);
    return () => {
      socket.off("connect", resync);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", resync);
    };
  }, [mutate, mutateConv]);

  // Realtime: sửa / thu hồi / reaction → revalidate cho mọi người xem.
  React.useEffect(() => {
    const socket = getSocket();
    const refresh = (evt?: { conversationId?: string }) => {
      if (evt?.conversationId && evt.conversationId !== convId) return;
      mutate();
    };
    socket.on("chat:message-edited", refresh);
    socket.on("chat:deleted", refresh);
    socket.on("chat:reactions", refresh);
    return () => {
      socket.off("chat:message-edited", refresh);
      socket.off("chat:deleted", refresh);
      socket.off("chat:reactions", refresh);
    };
  }, [convId, mutate]);

  // Typing của khách (zalo:typing) — khớp theo threadId + accountId.
  const threadId = conversation?.externalThreadId;
  const accountId = conversation?.zaloAccountId;

  // Avatar người gửi trong group: message không chứa avatar → resolve uid qua
  // batch user-info (cache DB + SDK). Gom uid của tin trong group rồi fetch 1 lần.
  const isGroupThread = conversation?.threadType === "group";
  const groupUids = React.useMemo(() => {
    if (!isGroupThread) return [] as string[];
    const set = new Set<string>();
    for (const m of data?.messages ?? []) {
      if (m.senderType !== "self" && m.senderUid) set.add(m.senderUid);
    }
    return [...set];
  }, [isGroupThread, data]);
  const { data: memberData } = useSWR(
    groupUids.length ? ["user-info-batch", groupUids.slice().sort().join(",")] : null,
    () => getUserInfoBatch(groupUids),
  );
  const memberProfiles = memberData?.users;

  React.useEffect(() => {
    if (!threadId) return;
    const socket = getSocket();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onTyping = (evt: { accountId: string; threadId: string }) => {
      if (evt.threadId !== threadId) return;
      if (accountId && evt.accountId !== accountId) return;
      setTyping(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setTyping(false), 3000);
    };
    socket.on("zalo:typing", onTyping);
    return () => {
      socket.off("zalo:typing", onTyping);
      if (timer) clearTimeout(timer);
    };
  }, [threadId, accountId]);

  // Đóng lightbox bằng Esc.
  React.useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLightbox(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  async function handleSubmit(
    text: string,
    styles: SendStyle[],
    mentions: SendMention[],
  ) {
    if (!text.trim() || sending) return;
    setSending(true);
    const replyId = replyTo?.id;
    const editTarget = editing;
    setReplyTo(null);
    setEditing(null);
    try {
      if (editTarget) {
        await editMessage(convId, editTarget.id, text);
        await mutate();
        toast.success("Đã sửa tin nhắn");
        return;
      }
      const sent = await sendMessage(convId, text, {
        replyMessageId: replyId,
        styles,
        mentions,
      });
      mutate((prev) => {
        if (!prev) return prev;
        if (prev.messages.some((m) => m.id === sent.id)) return prev;
        return { ...prev, messages: [...prev.messages, sent] };
      }, false);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Không gửi được tin nhắn";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  async function handleSticker(s: StickerItem) {
    try {
      await sendSticker(convId, s.id, s.catId, s.type);
      await mutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không gửi được sticker");
    }
  }

  function onReply(m: ChatMessage) {
    setEditing(null);
    setReplyTo(m);
  }

  function onEdit(m: ChatMessage) {
    setReplyTo(null);
    setEditing(m);
  }

  function cancelCompose() {
    setReplyTo(null);
    setEditing(null);
  }

  async function onRecall(m: ChatMessage) {
    try {
      await recallMessage(convId, m.id);
      await mutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thu hồi được");
    }
  }

  async function onReact(m: ChatMessage, emoji: string) {
    try {
      await reactToMessage(convId, m.id, emoji);
      await mutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thả được cảm xúc");
    }
  }

  async function onCopy(m: ChatMessage) {
    try {
      await navigator.clipboard.writeText(m.content || "");
      toast.success("Đã sao chép");
    } catch {
      toast.error("Không sao chép được");
    }
  }

  async function handleFiles(files: FileList | null, asImage: boolean) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    setUploading(true);
    try {
      if (asImage) await uploadImages(convId, arr);
      else await uploadAttachments(convId, arr);
      await mutate(); // refetch — BE cũng phát socket, revalidate cho chắc.
      toast.success(arr.length > 1 ? `Đã gửi ${arr.length} tệp` : "Đã gửi");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Gửi tệp thất bại");
    } finally {
      setUploading(false);
    }
  }

  const title = conversation ? conversationTitle(conversation) : "Đang tải…";
  const isGroup = conversation?.threadType === "group";

  return (
    <div className="flex h-full flex-1">
    <div className="flex h-full min-w-0 flex-1 flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-9">
            {conversation?.contact?.avatarUrl ? (
              <AvatarImage src={conversation.contact.avatarUrl} alt={title} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {conversation ? conversationAvatarText(conversation) : "…"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold">{title}</p>
              {conversation?.friendship?.statusRef ? (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: `${conversation.friendship.statusRef.color || "#6366F1"}22`,
                    color: conversation.friendship.statusRef.color || "#6366f1",
                  }}
                >
                  {conversation.friendship.statusRef.name}
                </span>
              ) : null}
              {isFriend(conversation?.friendship?.friendshipStatus) ? (
                <span className="shrink-0 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
                  ✓ Đã KB
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {conversation?.contact?.phone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3" /> {conversation.contact.phone}
                </span>
              ) : null}
              {conversation?.zaloAccount?.displayName ? (
                <Badge
                  variant="secondary"
                  className="h-5 rounded-full text-[10px]"
                >
                  qua {conversation.zaloAccount.displayName}
                </Badge>
              ) : null}
              {conversation?.friendship ? (
                <span
                  className="inline-flex items-center gap-1.5"
                  title="Tin nhắn riêng cặp nick × khách này"
                >
                  <span>📥 {conversation.friendship.totalInbound ?? 0}</span>
                  <span>📤 {conversation.friendship.totalOutbound ?? 0}</span>
                  <span className="text-[10px] uppercase opacity-70">
                    per nick
                  </span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={searchOpen ? "secondary" : "ghost"}
            size="icon"
            aria-label="Tìm trong hội thoại"
            onClick={() => setSearchOpen((o) => !o)}
          >
            <Search className="size-4.5" />
          </Button>
          {conversation ? (
            <ThreadActions
              conversation={conversation}
              onChanged={() => mutateConv()}
            />
          ) : null}
          {conversation?.contact?.id ? (
            <AssignControl
              contactId={conversation.contact.id}
              assignedUserId={conversation.contact.assignedUserId ?? null}
              onAssigned={() => mutateConv()}
            />
          ) : null}
          <Button
            variant={panelOpen ? "secondary" : "ghost"}
            size="icon"
            aria-label="Hồ sơ khách"
            onClick={() => setPanelOpen((o) => !o)}
          >
            <UserRound className="size-5" />
          </Button>
        </div>
      </header>

      {/* Tìm trong hội thoại */}
      {searchOpen ? (
        <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm trong hội thoại này..."
            className="h-7 flex-1 bg-transparent text-sm outline-none"
          />
          {search ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {shown.length} kết quả
            </span>
          ) : null}
          <button
            onClick={() => {
              setSearch("");
              setSearchOpen(false);
            }}
            className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={onScrollMessages}
      >
        <div className="mx-auto flex max-w-3xl flex-col px-4 py-4">
          {/* Đầu luồng: nút/chỉ báo kéo tin cũ */}
          {!search.trim() && canLoadMore ? (
            <button
              onClick={() => {
                const el = scrollRef.current;
                if (el && !loadingOlderRef.current) {
                  loadingOlderRef.current = true;
                  prevHeightRef.current = el.scrollHeight;
                  setLimit((l) => l + 50);
                }
              }}
              className="mx-auto mb-2 flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
            >
              <Loader2
                className={cn(
                  "size-3",
                  loadingOlderRef.current ? "animate-spin" : "hidden",
                )}
              />
              Tải tin cũ hơn ({total - messages.length})
            </button>
          ) : null}
          {isLoading ? (
            <div className="grid place-items-center py-20">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground">
              <MessagesSquare className="size-7" />
              <p className="text-sm">
                {search.trim()
                  ? "Không có tin nhắn khớp."
                  : "Chưa có tin nhắn nào trong hội thoại này."}
              </p>
            </div>
          ) : (
            rows.map((row, ri) => {
              const m = row[0];
              const prevRow = rows[ri - 1];
              const prev = prevRow ? prevRow[prevRow.length - 1] : undefined;
              const showDate = !prev || !sameDay(prev.sentAt, m.sentAt);
              const grouped =
                !showDate &&
                !!prev &&
                prev.senderType === m.senderType &&
                // Group chat: thành viên khác nhau → KHÔNG gộp (hiện avatar + tên riêng).
                (prev.senderUid ?? "") === (m.senderUid ?? "") &&
                new Date(m.sentAt).getTime() -
                  new Date(prev.sentAt).getTime() <
                  GROUP_GAP_MS;
              return (
                <React.Fragment key={m.id}>
                  {showDate ? <DateSeparator iso={m.sentAt} /> : null}
                  <MessageRow
                    m={m}
                    album={row.length > 1 ? row : undefined}
                    grouped={grouped}
                    isGroup={isGroup}
                    conversation={conversation}
                    memberProfile={
                      isGroup && m.senderUid
                        ? (memberProfiles?.[m.senderUid] ?? undefined)
                        : undefined
                    }
                    isLastSelf={m.id === lastSelfId}
                    onImage={setLightbox}
                    onReply={onReply}
                    onEdit={onEdit}
                    onRecall={onRecall}
                    onReact={onReact}
                    onCopy={onCopy}
                    onForward={setForwarding}
                  />
                </React.Fragment>
              );
            })
          )}
          {typing ? <TypingIndicator /> : null}
        </div>
      </div>

      {/* CRM tag bar */}
      {conversation?.friendship?.id ? (
        <TagBar
          friendId={conversation.friendship.id}
          tags={conversation.friendship.crmTagsPerNick ?? []}
          autoTags={conversation.friendship.autoTags ?? []}
          onChanged={() => mutateConv()}
        />
      ) : null}

      {/* Composer */}
      <Composer
        conversation={conversation}
        replyTo={replyTo}
        editing={editing}
        onCancelCompose={cancelCompose}
        onSubmit={handleSubmit}
        onUpload={handleFiles}
        onSticker={handleSticker}
        sending={sending}
        uploading={uploading}
      />

      {/* Lightbox */}
      {lightbox ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Xem ảnh"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

      {/* Chuyển tiếp */}
      {forwarding ? (
        <ForwardDialog
          message={forwarding}
          fromConversationId={convId}
          onClose={() => setForwarding(null)}
        />
      ) : null}
    </div>

    {/* Panel hồ sơ khách */}
    {panelOpen && conversation?.contactId ? (
      <ContactPanel
        contactId={conversation.contactId}
        onClose={() => setPanelOpen(false)}
      />
    ) : null}
    </div>
  );
}

function ThreadActions({
  conversation,
  onChanged,
}: {
  conversation: Conversation;
  onChanged: () => void;
}) {
  const accountId = conversation.zaloAccountId;
  const threadId = conversation.externalThreadId;
  const contactId = conversation.contact?.id;
  const status = conversation.friendship?.friendshipStatus;
  const isUser = conversation.threadType !== "group";
  const [busy, setBusy] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { data: labelData } = useSWR(
    menuOpen && threadId ? ["zalo-labels", accountId] : null,
    () => getZaloLabels(accountId),
  );
  const labels = labelData?.labels ?? [];

  async function run(fn: () => Promise<unknown>, ok: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Thao tác thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger
        render={
          <button
            aria-label="Thêm"
            title="Thêm thao tác"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
          >
            {busy ? (
              <Loader2 className="size-4.5 animate-spin" />
            ) : (
              <MoreVertical className="size-4.5" />
            )}
          </button>
        }
      />
      <DropdownMenuContent align="end">
        {contactId ? (
          <DropdownMenuItem
            onClick={() => run(() => sendCard(conversation.id, contactId), "Đã gửi danh thiếp")}
          >
            <IdCard className="size-4" /> Gửi danh thiếp
          </DropdownMenuItem>
        ) : null}

        {/* Nhãn Zalo gốc — submenu */}
        {threadId ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <TagIcon className="size-4" /> Nhãn Zalo
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
              <DropdownMenuItem
                onClick={() => run(() => assignZaloLabel(accountId, threadId, null), "Đã bỏ nhãn")}
              >
                <span className="text-muted-foreground">Bỏ nhãn</span>
              </DropdownMenuItem>
              {labels.length > 0 ? <DropdownMenuSeparator /> : null}
              {labels.length === 0 ? (
                <DropdownMenuItem disabled>Chưa có nhãn Zalo</DropdownMenuItem>
              ) : (
                labels.map((l) => (
                  <DropdownMenuItem
                    key={l.id}
                    onClick={() =>
                      run(() => assignZaloLabel(accountId, threadId, l.id), `Đã gắn "${l.text}"`)
                    }
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: l.color || "#90A4AE" }}
                    />
                    {l.text}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}

        {isUser && threadId ? (
          <>
            <DropdownMenuSeparator />
            {isFriend(status) ? (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => run(() => unfriend(accountId, threadId), "Đã huỷ kết bạn")}
              >
                <UserMinus className="size-4" /> Huỷ kết bạn
              </DropdownMenuItem>
            ) : status === "pending_sent" ? (
              <DropdownMenuItem
                onClick={() => run(() => recallFriendRequest(accountId, threadId), "Đã thu hồi lời mời")}
              >
                <UserMinus className="size-4" /> Thu hồi lời mời
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => run(() => sendFriendRequest(accountId, threadId), "Đã gửi lời mời kết bạn")}
              >
                <UserPlus className="size-4" /> Kết bạn
              </DropdownMenuItem>
            )}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AssignControl({
  contactId,
  assignedUserId,
  onAssigned,
}: {
  contactId: string;
  assignedUserId: string | null;
  onAssigned: () => void;
}) {
  const { user } = useAuth();
  const canManage = user?.role === "owner" || user?.role === "admin";
  // Chỉ owner/admin mới list được users (BE chặn member) → ẩn với member.
  const { data } = useSWR(canManage ? "team-users" : null, getUsers);
  const [busy, setBusy] = React.useState(false);
  if (!canManage) return null;

  const users = data?.users ?? [];
  const current = users.find((u) => u.id === assignedUserId);

  async function assign(uid: string | null) {
    setBusy(true);
    try {
      await assignContact(contactId, uid);
      onAssigned();
      toast.success(uid ? "Đã gán phụ trách" : "Đã bỏ gán");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không gán được");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className="flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs text-muted-foreground hover:bg-accent"
            aria-label="Gán phụ trách"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <UserCheck className="size-3.5" />
            )}
            <span className="max-w-24 truncate">
              {current ? current.fullName || current.email : "Chưa gán"}
            </span>
          </button>
        }
      />
      <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
        <DropdownMenuItem onClick={() => assign(null)}>
          <span className="text-muted-foreground">Bỏ gán</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {users
          .filter((u) => u.isActive)
          .map((u) => (
            <DropdownMenuItem key={u.id} onClick={() => assign(u.id)}>
              <UserCheck
                className={cn(
                  "size-4",
                  u.id === assignedUserId ? "text-primary" : "opacity-0",
                )}
              />
              {u.fullName || u.email}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TagBar({
  friendId,
  tags,
  autoTags,
  onChanged,
}: {
  friendId: string;
  tags: string[];
  autoTags: string[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const { data: tagData } = useSWR("crm-tags-all", getCrmTags);
  const allTags = tagData?.tags ?? [];

  async function save(next: string[]) {
    setBusy(true);
    try {
      await updateFriendTags(friendId, next);
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không cập nhật được tag");
    } finally {
      setBusy(false);
    }
  }

  const remove = (t: string) => save(tags.filter((x) => x !== t));
  const add = (t: string) => {
    if (tags.includes(t)) return;
    save([...tags, t]);
  };
  const suggestions = allTags.filter((t) => !tags.includes(t.name));

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t px-4 py-2">
      <TagIcon className="size-3.5 shrink-0 text-muted-foreground" />
      {/* Auto-tag (backend tự tính) — chip "AUTO" read-only */}
      {autoTags.map((key) => {
        const def = getAutoTagDef(key);
        return (
          <span
            key={`auto-${key}`}
            title={def.tooltip}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
            style={{
              color: def.color,
              borderColor: `${def.color}66`,
              backgroundColor: `${def.color}14`,
            }}
          >
            <span
              className="rounded px-1 text-[8px] font-bold uppercase leading-tight text-white"
              style={{ backgroundColor: def.color }}
            >
              auto
            </span>
            {def.icon} {def.label}
          </span>
        );
      })}
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
        >
          {prettyTagName(t)}
          <button
            onClick={() => remove(t)}
            disabled={busy}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Gỡ ${t}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              disabled={busy}
              className="inline-flex items-center gap-0.5 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Plus className="size-3" />
              )}
              Thêm tag
            </button>
          }
        />
        <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
          {suggestions.length === 0 ? (
            <DropdownMenuItem disabled>Hết tag để thêm</DropdownMenuItem>
          ) : (
            suggestions.map((t) => (
              <DropdownMenuItem key={t.id} onClick={() => add(t.name)}>
                {prettyTagName(t.name)}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ForwardDialog({
  message,
  fromConversationId,
  onClose,
}: {
  message: ChatMessage;
  fromConversationId: string;
  onClose: () => void;
}) {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data } = useSWR(["forward-conversations", debounced], () =>
    getConversations({ search: debounced || undefined, limit: 30 }),
  );
  const list = (data?.conversations ?? []).filter(
    (c) => c.id !== fromConversationId,
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirm() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      await forwardMessage(fromConversationId, message.id, Array.from(selected));
      toast.success(`Đã chuyển tiếp tới ${selected.size} hội thoại`);
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Chuyển tiếp thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Chuyển tiếp tới…</h2>
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="border-b p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm hội thoại..."
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Không có hội thoại
            </p>
          ) : (
            <ul>
              {list.map((c) => {
                const title = conversationTitle(c);
                const on = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => toggle(c.id)}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent/50"
                    >
                      <Avatar className="size-8">
                        {c.contact?.avatarUrl ? (
                          <AvatarImage src={c.contact.avatarUrl} alt={title} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                          {conversationAvatarText(c)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {title}
                      </span>
                      <span
                        className={cn(
                          "grid size-5 place-items-center rounded border",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border",
                        )}
                      >
                        {on ? <Check className="size-3.5" /> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t p-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0 || busy}
            onClick={confirm}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Chuyển tiếp{selected.size ? ` (${selected.size})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DateSeparator({ iso }: { iso: string }) {
  return (
    <div className="my-3 flex items-center justify-center">
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        {dayLabel(iso)}
      </span>
    </div>
  );
}

interface RowActions {
  onImage: (url: string) => void;
  onReply: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage) => void;
  onRecall: (m: ChatMessage) => void;
  onReact: (m: ChatMessage, emoji: string) => void;
  onCopy: (m: ChatMessage) => void;
  onForward: (m: ChatMessage) => void;
}

function MessageRow({
  m,
  album,
  grouped,
  isGroup,
  conversation,
  memberProfile,
  isLastSelf,
  onImage,
  onReply,
  onEdit,
  onRecall,
  onReact,
  onCopy,
  onForward,
}: {
  m: ChatMessage;
  album?: ChatMessage[];
  grouped: boolean;
  isGroup: boolean;
  conversation?: Conversation;
  memberProfile?: GroupMemberProfile;
  isLastSelf: boolean;
} & RowActions) {
  const isSelf = m.senderType === "self";

  // Sự kiện thu hồi/xoá (JSON action) → thông báo gọn ở giữa, không render thô.
  if (isRecallEvent(m)) {
    return (
      <div className="my-1 flex justify-center">
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
          Tin nhắn đã được thu hồi
        </span>
      </div>
    );
  }

  if (m.isDeleted) {
    return (
      <div className={cn("flex", isSelf ? "justify-end" : "justify-start", grouped ? "mt-0.5" : "mt-2")}>
        <div className="rounded-2xl border border-dashed px-3 py-1.5 text-xs italic text-muted-foreground">
          Tin nhắn đã thu hồi
        </div>
      </div>
    );
  }

  // Avatar người gửi: group → member profile theo uid; 1-1 → avatar contact.
  const avatarUrl = isSelf
    ? null
    : isGroup
      ? (memberProfile?.avatar ?? null)
      : (conversation?.contact?.avatarUrl ?? null);
  const senderLabel =
    m.senderName ||
    memberProfile?.displayName ||
    (conversation && !isGroup ? conversationTitle(conversation) : "Thành viên");
  const quote = quotePreview(m.quote);
  const canEdit = isSelf && (m.contentType === "text" || !m.contentType);

  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isSelf ? "justify-end" : "justify-start",
        grouped ? "mt-0.5" : "mt-2",
      )}
    >
      {!isSelf ? (
        <div className="w-7 shrink-0 self-end">
          {!grouped ? (
            <Avatar className="size-7">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback className="bg-muted text-[10px] font-semibold">
                {(senderLabel || "?").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "flex max-w-[78%] flex-col",
          isSelf ? "items-end" : "items-start",
          (m.reactions?.length ?? 0) > 0 ? "mb-2.5" : "",
        )}
      >
        {!isSelf && isGroup && !grouped ? (
          <span className="mb-0.5 px-1 text-[11px] font-medium text-muted-foreground">
            {senderLabel}
          </span>
        ) : null}

        <div className="group/msg relative w-fit max-w-full">
          <div
            className={cn(
              "relative min-w-0 text-sm",
              // Sticker: không bọc bong bóng màu.
              m.contentType === "sticker"
                ? ""
                : cn(
                    "rounded-2xl px-3 py-1.5",
                    isSelf
                      ? "rounded-br-md bg-chat-out text-chat-out-foreground"
                      : "rounded-bl-md bg-chat-in text-chat-in-foreground",
                  ),
            )}
          >
            {quote ? (
              <div
                className={cn(
                  "mb-1 border-l-2 pl-2 text-xs",
                  isSelf
                    ? "border-chat-out-foreground/40 text-chat-out-foreground/80"
                    : "border-primary/50 text-muted-foreground",
                )}
              >
                {quote.sender ? (
                  <span className="block font-medium">{quote.sender}</span>
                ) : null}
                <span className="line-clamp-2">{quote.text}</span>
              </div>
            ) : null}

            {album ? (
              <AlbumGrid items={album} onImage={onImage} />
            ) : (
              <MessageContent m={m} onImage={onImage} />
            )}
            <div
              className={cn(
                "mt-0.5 flex items-center justify-end gap-1 text-[10px] leading-none",
                m.contentType === "sticker"
                  ? "text-muted-foreground"
                  : isSelf
                    ? "text-chat-out-foreground/65"
                    : "text-muted-foreground",
              )}
            >
              {m.editedAt ? <span className="italic">đã sửa</span> : null}
              <span>{clockTime(m.sentAt)}</span>
              {isSelf && isLastSelf ? <Receipt m={m} /> : null}
            </div>

            {/* Reaction badge — đè góc dưới bóng (kiểu Zalo) */}
            <Reactions m={m} isSelf={isSelf} />
          </div>

          {/* Thanh hành động nổi — absolute, không đẩy layout */}
          <div
            className={cn(
              "absolute top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100",
              isSelf ? "right-full mr-1" : "left-full ml-1",
            )}
          >
            <ReactionPicker onPick={(e) => onReact(m, e)} />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    aria-label="Tùy chọn"
                    className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-accent"
                  >
                    <MoreVertical className="size-4" />
                  </button>
                }
              />
              <DropdownMenuContent align={isSelf ? "end" : "start"}>
                <DropdownMenuItem onClick={() => onReply(m)}>
                  <Reply className="size-4" /> Trả lời
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onForward(m)}>
                  <Forward className="size-4" /> Chuyển tiếp
                </DropdownMenuItem>
                {m.content ? (
                  <DropdownMenuItem onClick={() => onCopy(m)}>
                    <Copy className="size-4" /> Sao chép
                  </DropdownMenuItem>
                ) : null}
                {canEdit ? (
                  <DropdownMenuItem onClick={() => onEdit(m)}>
                    <Pencil className="size-4" /> Sửa
                  </DropdownMenuItem>
                ) : null}
                {isSelf ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onRecall(m)}
                    >
                      <Trash2 className="size-4" /> Thu hồi
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReactionPicker({ onPick }: { onPick: (e: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Thả cảm xúc"
        onClick={() => setOpen((o) => !o)}
        className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-accent"
      >
        <Smile className="size-4" />
      </button>
      {open ? (
        <div className="absolute bottom-9 left-1/2 z-20 flex -translate-x-1/2 gap-0.5 rounded-full border bg-popover p-1 shadow-md">
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className="grid size-8 place-items-center rounded-full text-lg transition-transform hover:scale-125"
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Receipt({ m }: { m: ChatMessage }) {
  if (m.seenAt)
    return <CheckCheck className="size-3.5 text-info" aria-label="Đã xem" />;
  if (m.deliveredAt)
    return (
      <CheckCheck className="size-3.5 opacity-70" aria-label="Đã nhận" />
    );
  const ageMs = Date.now() - new Date(m.sentAt).getTime();
  if (ageMs > 3000)
    return <Clock3 className="size-3 opacity-70" aria-label="Đang gửi" />;
  return <Check className="size-3.5 opacity-70" aria-label="Đã gửi" />;
}

function Reactions({ m, isSelf }: { m: ChatMessage; isSelf: boolean }) {
  if (!m.reactions || m.reactions.length === 0) return null;
  const counts = new Map<string, number>();
  for (const r of m.reactions)
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  const total = m.reactions.length;
  // Badge nhỏ đè góc dưới bóng (kiểu Zalo/Messenger).
  return (
    <span
      className={cn(
        "absolute -bottom-2 inline-flex items-center gap-0.5 rounded-full border bg-card px-1 py-0 text-[11px] leading-4 shadow-xs",
        isSelf ? "left-1.5" : "right-1.5",
      )}
    >
      {Array.from(counts.keys())
        .slice(0, 3)
        .map((emoji) => (
          <span key={emoji}>{emoji}</span>
        ))}
      {total > 1 ? (
        <span className="pl-0.5 tabular-nums text-muted-foreground">{total}</span>
      ) : null}
    </span>
  );
}

function MessageContent({
  m,
  onImage,
}: {
  m: ChatMessage;
  onImage: (url: string) => void;
}) {
  const caption = mediaCaption(m);

  switch (m.contentType) {
    case "call": {
      const c = callInfo(m);
      if (!c) return <Italic>[Cuộc gọi]</Italic>;
      return (
        <span className="flex items-center gap-1.5">
          <Phone
            className={cn("size-4", c.missed ? "text-overdue" : "text-info")}
          />
          <span>{c.label}</span>
          {c.duration ? (
            <span className="text-xs opacity-70">· {c.duration}</span>
          ) : null}
        </span>
      );
    }
    case "poll": {
      const p = pollInfo(m);
      if (!p) return <Italic>[Bình chọn]</Italic>;
      return (
        <div className="min-w-44 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <BarChart3 className="size-3.5" />
            {p.actor ? `${p.actor} · ` : ""}
            {p.header}
          </div>
          {p.question ? (
            <p className="wrap-break-word font-medium">“{p.question}”</p>
          ) : null}
          {p.options.length > 0 ? (
            <ul className="space-y-0.5 text-xs opacity-90">
              {p.options.map((o, i) => (
                <li key={i}>• {o}</li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    }
    case "link": {
      const l = linkInfo(m);
      if (!l) return <Italic>[Liên kết]</Italic>;
      return (
        <a
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="block max-w-xs overflow-hidden rounded-lg border bg-background/40 hover:bg-accent"
        >
          {l.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={l.thumb}
              alt=""
              className="h-32 w-full object-cover"
              loading="lazy"
            />
          ) : null}
          <div className="space-y-0.5 p-2">
            <p className="line-clamp-2 text-sm font-medium">{l.title}</p>
            {l.desc ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {l.desc}
              </p>
            ) : null}
            <p className="truncate text-xs text-info">{l.host}</p>
          </div>
        </a>
      );
    }
    case "contact_card": {
      const c = cardInfo(m);
      if (!c) return <Italic>[Thẻ]</Italic>;
      return (
        <div className="flex max-w-xs items-center gap-2.5">
          {c.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.thumb}
              alt=""
              className="size-10 shrink-0 rounded-lg object-cover"
              loading="lazy"
            />
          ) : null}
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium">{c.title}</p>
            {c.desc ? (
              <p className="truncate text-xs text-muted-foreground">{c.desc}</p>
            ) : null}
          </div>
        </div>
      );
    }
    case "image": {
      const url = imageUrl(m);
      if (!url) return <Italic>[Hình ảnh]</Italic>;
      return (
        <div className="space-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Hình ảnh"
            loading="lazy"
            onClick={() => onImage(url)}
            className="max-h-72 cursor-zoom-in rounded-lg object-cover"
          />
          {caption ? <Caption text={caption} /> : null}
        </div>
      );
    }
    case "sticker": {
      const sp = stickerParams(m);
      if (!sp) return <Italic>[Sticker]</Italic>;
      return (
        <AnimatedSticker
          catId={sp.catId}
          id={sp.id}
          fallbackUrl={stickerUrl(m) ?? undefined}
        />
      );
    }
    case "gif": {
      const url = extractMediaUrl(m);
      if (!url) return <Italic>[GIF]</Italic>;
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="GIF"
          loading="lazy"
          onClick={() => onImage(url)}
          className="max-h-72 cursor-zoom-in rounded-lg"
        />
      );
    }
    case "video": {
      const url = videoUrl(m);
      const poster = videoThumb(m) ?? undefined;
      if (!url) return <Italic>[Video]</Italic>;
      return (
        <div className="space-y-1">
          <video
            src={url}
            poster={poster}
            controls
            className="max-h-72 rounded-lg"
          />
          {caption ? <Caption text={caption} /> : null}
        </div>
      );
    }
    case "voice":
    case "audio": {
      const url = extractMediaUrl(m);
      if (!url) return <Italic>[Tin nhắn thoại]</Italic>;
      return <audio src={url} controls className="h-9 max-w-full" />;
    }
    case "file": {
      const info = fileInfo(m);
      if (!info?.href) return <Italic>[Tệp đính kèm]</Italic>;
      return (
        <a
          href={info.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border bg-background/50 px-3 py-2 hover:bg-accent"
        >
          <FileIcon className="size-5 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {info.name}
            </span>
            <span className="text-xs text-muted-foreground">{info.size}</span>
          </span>
        </a>
      );
    }
    case "card":
      return (
        <span className="whitespace-pre-wrap wrap-break-word">
          {displayText(m.content)}
        </span>
      );
    default: {
      // Tin sự kiện có mẫu câu (reminder…) → format câu.
      const act = actionMessage(m);
      if (act) {
        return (
          <span className="flex items-start gap-1.5 italic opacity-90">
            <span>{act.icon}</span>
            <span className="wrap-break-word">{act.text}</span>
          </span>
        );
      }
      const text = displayText(m.content);
      // Token camelCase (vd "sendBubbleMessage") → tin hệ thống chưa hỗ trợ.
      if (/^[a-z]+[A-Z][a-zA-Z]*$/.test(text.trim())) {
        return <Italic>[Tin nhắn hệ thống]</Italic>;
      }
      return (
        <span className="whitespace-pre-wrap wrap-break-word">
          <HighlightedText text={text} />
        </span>
      );
    }
  }
}

function Italic({ children }: { children: React.ReactNode }) {
  return <span className="italic opacity-90">{children}</span>;
}

function Caption({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap wrap-break-word text-sm">{text}</p>;
}

// Tô sáng @mention + link trong nội dung text.
const HL_RE = /(@[\p{Lu}][\p{L}0-9._-]*(?:\s[\p{Lu}][\p{L}0-9._-]*)?|https?:\/\/[^\s]+)/gu;
function HighlightedText({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(HL_RE);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (p.startsWith("@"))
          return (
            <span key={i} className="font-medium text-primary">
              {p}
            </span>
          );
        if (/^https?:\/\//.test(p))
          return (
            <a
              key={i}
              href={p}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {p}
            </a>
          );
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </>
  );
}

function AlbumGrid({
  items,
  onImage,
}: {
  items: ChatMessage[];
  onImage: (url: string) => void;
}) {
  const urls = items.map((it) => imageUrl(it)).filter(Boolean) as string[];
  const cols = urls.length === 1 ? 1 : urls.length === 2 ? 2 : 3;
  return (
    <div
      className={cn(
        "grid max-w-xs gap-1",
        cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-2" : "grid-cols-3",
      )}
    >
      {urls.map((u, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={u}
          alt="Hình ảnh"
          loading="lazy"
          onClick={() => onImage(u)}
          className="aspect-square w-full cursor-zoom-in rounded-lg object-cover"
        />
      ))}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-chat-in px-3 py-2.5">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}
