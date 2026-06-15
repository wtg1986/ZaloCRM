"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Bold,
  CalendarPlus,
  FileText,
  ImagePlus,
  Italic,
  Loader2,
  Paperclip,
  Send,
  Smile,
  Sparkles,
  Sticker as StickerIcon,
  Strikethrough,
  Underline,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getGroupMembers,
  type GroupMember,
  type SendMention,
  type SendStyle,
} from "@/lib/resources";
import type { ChatMessage, Conversation } from "@/lib/types";
import {
  aiSuggest,
  getStickers,
  getTemplates,
  type StickerItem,
} from "@/lib/chat-ops";
import { createAppointment } from "@/lib/crm";
import { ApiError } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AnimatedSticker } from "@/components/inbox/animated-sticker";

const EMOJIS = [
  "😀","😁","😂","🤣","😊","😍","😘","😎","🤩","🥰",
  "👍","👎","👌","🙏","👏","💪","🔥","🎉","❤️","💯",
  "😢","😭","😡","😤","🤔","😴","🥳","😅","🙌","✅",
];

interface Fmt {
  b: boolean;
  i: boolean;
  u: boolean;
  s: boolean;
}

// Serialize contentEditable → plain text + Zalo styles [{st,start,len}].
function serialize(root: HTMLElement): { text: string; styles: SendStyle[] } {
  let text = "";
  const ranges: SendStyle[] = [];

  function fmtOf(node: Node): Fmt {
    const f: Fmt = { b: false, i: false, u: false, s: false };
    let el = node.parentElement;
    while (el && el !== root.parentElement) {
      const tag = el.tagName;
      if (tag === "B" || tag === "STRONG") f.b = true;
      if (tag === "I" || tag === "EM") f.i = true;
      if (tag === "U" || tag === "INS") f.u = true;
      if (tag === "S" || tag === "STRIKE" || tag === "DEL") f.s = true;
      const st = el.style;
      if (st) {
        if (st.fontWeight === "bold" || parseInt(st.fontWeight) >= 600) f.b = true;
        if (st.fontStyle === "italic") f.i = true;
        const td = `${st.textDecoration} ${st.textDecorationLine}`;
        if (td.includes("underline")) f.u = true;
        if (td.includes("line-through")) f.s = true;
      }
      el = el.parentElement;
    }
    return f;
  }

  function rec(node: Node) {
    node.childNodes.forEach((c) => {
      if (c.nodeType === Node.TEXT_NODE) {
        const t = c.textContent || "";
        if (!t) return;
        const f = fmtOf(c);
        const start = text.length;
        (["b", "i", "u", "s"] as const).forEach((k) => {
          if (f[k]) ranges.push({ st: k, start, len: t.length });
        });
        text += t;
      } else if (c.nodeType === Node.ELEMENT_NODE) {
        const tag = (c as HTMLElement).tagName;
        if (tag === "BR") {
          text += "\n";
        } else {
          if ((tag === "DIV" || tag === "P") && text && !text.endsWith("\n"))
            text += "\n";
          rec(c);
        }
      }
    });
  }
  rec(root);

  ranges.sort((a, b) => (a.st === b.st ? a.start - b.start : a.st < b.st ? -1 : 1));
  const merged: SendStyle[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && last.st === r.st && last.start + last.len === r.start)
      last.len += r.len;
    else merged.push({ ...r });
  }
  return { text: text.replace(/ /g, " ").trimEnd(), styles: merged };
}

interface NormMember {
  uid: string;
  name: string;
  avatar?: string;
}

function normalizeMembers(raw: unknown): NormMember[] {
  const out: NormMember[] = [];
  const seen = new Set<string>();
  // BE có thể trả mảng, hoặc object {memberId: info}, hoặc undefined → chuẩn hoá.
  const list: GroupMember[] = Array.isArray(raw)
    ? (raw as GroupMember[])
    : raw && typeof raw === "object"
      ? (Object.values(raw) as GroupMember[])
      : [];
  for (const m of list) {
    if (!m || typeof m !== "object") continue;
    const uid = m.uid || m.userId || m.zaloUid || m.id || "";
    const name = m.displayName || m.zaloName || m.name || "";
    if (!uid || !name || seen.has(uid)) continue;
    seen.add(uid);
    out.push({ uid, name, avatar: m.avatar || m.avatarUrl });
  }
  return out;
}

// Lấy plain-text từ đầu editor tới con trỏ (để dò "@query").
function textBeforeCaret(root: HTMLElement | null): string {
  if (!root) return "";
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.focusNode) return "";
  if (!root.contains(sel.focusNode)) return "";
  const range = sel.getRangeAt(0).cloneRange();
  range.selectNodeContents(root);
  range.setEnd(sel.focusNode, sel.focusOffset);
  return range.toString();
}

export function Composer({
  conversation,
  replyTo,
  editing,
  onCancelCompose,
  onSubmit,
  onUpload,
  onSticker,
  sending,
  uploading,
}: {
  conversation?: Conversation;
  replyTo: ChatMessage | null;
  editing: ChatMessage | null;
  onCancelCompose: () => void;
  onSubmit: (
    text: string,
    styles: SendStyle[],
    mentions: SendMention[],
  ) => void | Promise<void>;
  onUpload: (files: FileList | null, asImage: boolean) => void | Promise<void>;
  onSticker: (s: StickerItem) => void | Promise<void>;
  sending: boolean;
  uploading: boolean;
}) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [empty, setEmpty] = React.useState(true);
  const [aiBusy, setAiBusy] = React.useState(false);

  // @mention — chỉ chat nhóm. Track {uid,name} đã chèn để tính pos/len lúc gửi.
  const isGroup = conversation?.threadType === "group";
  const { data: memberData } = useSWR(
    isGroup && conversation?.zaloAccountId && conversation?.externalThreadId
      ? ["group-members", conversation.zaloAccountId, conversation.externalThreadId]
      : null,
    () =>
      getGroupMembers(
        conversation!.zaloAccountId,
        conversation!.externalThreadId as string,
      ),
  );
  const members = React.useMemo(
    () => normalizeMembers(memberData?.members ?? []),
    [memberData],
  );
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const insertedMentions = React.useRef<{ uid: string; name: string }[]>([]);

  const focus = React.useCallback(() => {
    requestAnimationFrame(() => editorRef.current?.focus());
  }, []);

  // Prefill khi vào chế độ sửa; focus khi reply/edit.
  React.useEffect(() => {
    if (!editorRef.current) return;
    if (editing) {
      editorRef.current.innerText = editing.content || "";
      setEmpty(!editing.content);
    }
    if (editing || replyTo) focus();
  }, [editing, replyTo, focus]);

  function clearEditor() {
    if (editorRef.current) editorRef.current.innerHTML = "";
    insertedMentions.current = [];
    setMentionQuery(null);
    setEmpty(true);
  }

  function exec(cmd: string) {
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(cmd);
    editorRef.current?.focus();
  }

  function insertText(s: string) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand("insertText", false, s);
    setEmpty(!el.innerText.trim());
  }

  // Phát hiện đang gõ "@query" ngay trước con trỏ → mở popover gợi ý thành viên.
  function onEditorInput() {
    const el = editorRef.current;
    if (el) setEmpty(!el.innerText.trim());
    if (!isGroup || members.length === 0) return;
    const before = textBeforeCaret(el);
    const mm = before.match(/(?:^|\s)@([\p{L}0-9._]*)$/u);
    setMentionQuery(mm ? mm[1] : null);
  }

  function pickMention(member: NormMember) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel && mentionQuery !== null) {
      // Xoá "@query" vừa gõ rồi chèn "@Name ".
      const back = mentionQuery.length + 1;
      for (let i = 0; i < back; i++)
        (sel as unknown as { modify: (a: string, b: string, c: string) => void }).modify(
          "extend",
          "backward",
          "character",
        );
    }
    document.execCommand("insertText", false, `@${member.name} `);
    insertedMentions.current.push({ uid: member.uid, name: member.name });
    setMentionQuery(null);
    setEmpty(!el.innerText.trim());
  }

  function computeMentions(text: string): SendMention[] {
    const out: SendMention[] = [];
    const used = new Set<number>();
    for (const m of insertedMentions.current) {
      const token = `@${m.name}`;
      let from = 0;
      let idx = text.indexOf(token, from);
      while (idx !== -1 && used.has(idx)) {
        from = idx + 1;
        idx = text.indexOf(token, from);
      }
      if (idx !== -1) {
        used.add(idx);
        out.push({ pos: idx, uid: m.uid, len: token.length });
      }
    }
    return out;
  }

  function submit() {
    const el = editorRef.current;
    if (!el || sending) return;
    const { text, styles } = serialize(el);
    if (!text.trim()) return;
    const mentions = computeMentions(text);
    clearEditor();
    void onSubmit(text, styles, mentions);
  }

  const filteredMembers = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [mentionQuery, members]);

  return (
    <div className="border-t p-3">
      <div className="mx-auto max-w-3xl">
        {replyTo || editing ? (
          <div className="mb-1.5 flex items-center gap-2 rounded-lg border-l-2 border-primary bg-muted/60 px-3 py-1.5 text-xs">
            <span className="font-medium text-primary">
              {editing ? "Đang sửa tin" : "Đang trả lời"}
            </span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {(editing ?? replyTo)?.content || "[nội dung]"}
            </span>
            <button
              onClick={() => {
                if (editing) clearEditor();
                onCancelCompose();
              }}
              className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-accent"
              aria-label="Huỷ"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        <div className="relative rounded-xl border bg-card focus-within:ring-2 focus-within:ring-ring/40">
          {/* @mention popover */}
          {filteredMembers.length > 0 ? (
            <div className="absolute bottom-full left-2 z-30 mb-1 w-60 overflow-hidden rounded-xl border bg-popover shadow-md">
              <p className="border-b px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                Nhắc tới thành viên
              </p>
              <ul className="max-h-52 overflow-y-auto py-1">
                {filteredMembers.map((m) => (
                  <li key={m.uid}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickMention(m);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
                    >
                      <Avatar className="size-6">
                        {m.avatar ? <AvatarImage src={m.avatar} alt="" /> : null}
                        <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                          {m.name.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm">{m.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Editor */}
          <div className="relative px-3 pt-2">
            {empty ? (
              <span className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">
                Nhập tin nhắn… (Enter để gửi)
              </span>
            ) : null}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-label="Soạn tin"
              onInput={onEditorInput}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape" && mentionQuery !== null) {
                  setMentionQuery(null);
                }
              }}
              className="max-h-40 min-h-6 overflow-y-auto text-sm outline-none [&_b]:font-semibold [&_strong]:font-semibold"
            />
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-0.5 px-1.5 pb-1.5 pt-1">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void onUpload(e.target.files, true);
                e.target.value = "";
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                void onUpload(e.target.files, false);
                e.target.value = "";
              }}
            />

            <Tool label="Đậm" onClick={() => exec("bold")}>
              <Bold className="size-4" />
            </Tool>
            <Tool label="Nghiêng" onClick={() => exec("italic")}>
              <Italic className="size-4" />
            </Tool>
            <Tool label="Gạch chân" onClick={() => exec("underline")}>
              <Underline className="size-4" />
            </Tool>
            <Tool label="Gạch ngang" onClick={() => exec("strikeThrough")}>
              <Strikethrough className="size-4" />
            </Tool>
            <Divider />
            <Tool
              label="Gửi ảnh"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
            >
              <ImagePlus className="size-4" />
            </Tool>
            <Tool
              label="Gửi tệp"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Paperclip className="size-4" />
            </Tool>
            <EmojiPopover onPick={insertText} />
            <StickerPopover onPick={onSticker} />
            <TemplatePopover onPick={insertText} />
            {conversation?.contactId ? (
              <AppointmentPopover
                contactId={conversation.contactId}
                contactName={conversation.contact?.fullName || ""}
              />
            ) : null}
            <Tool
              label="AI gợi ý trả lời"
              disabled={aiBusy || !conversation}
              onClick={async () => {
                if (!conversation) return;
                setAiBusy(true);
                try {
                  const r = await aiSuggest(conversation.id);
                  if (r.content) insertText(r.content);
                  else toast.message("AI chưa có gợi ý");
                } catch (e) {
                  toast.error(
                    e instanceof ApiError ? e.message : "AI lỗi",
                  );
                } finally {
                  setAiBusy(false);
                }
              }}
            >
              {aiBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4 text-primary" />
              )}
            </Tool>

            <Button
              size="icon"
              className="ml-auto size-9 shrink-0"
              disabled={empty || sending}
              onClick={submit}
              aria-label="Gửi"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </div>
        {uploading ? (
          <p className="mt-1.5 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Đang tải tệp lên…
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Tool({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // dùng onMouseDown để không mất selection trong editor (formatting).
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-border" />;
}

function usePopover() {
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
  return { open, setOpen, ref };
}

function EmojiPopover({ onPick }: { onPick: (e: string) => void }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <Tool label="Emoji" onClick={() => setOpen((o) => !o)}>
        <Smile className="size-4" />
      </Tool>
      {open ? (
        <div className="absolute bottom-10 left-0 z-20 grid w-64 grid-cols-8 gap-0.5 rounded-xl border bg-popover p-2 shadow-md">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onMouseDown={(ev) => {
                ev.preventDefault();
                onPick(e);
              }}
              className="grid size-7 place-items-center rounded-md text-lg hover:bg-accent"
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StickerPopover({ onPick }: { onPick: (s: StickerItem) => void }) {
  const { open, setOpen, ref } = usePopover();
  const [kw, setKw] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(kw), 300);
    return () => clearTimeout(t);
  }, [kw]);
  const { data, isLoading } = useSWR(
    open ? ["stickers", debounced] : null,
    () => getStickers(debounced || undefined),
  );
  const stickers = data?.stickers ?? [];
  return (
    <div ref={ref} className="relative">
      <Tool label="Sticker" onClick={() => setOpen((o) => !o)}>
        <StickerIcon className="size-4" />
      </Tool>
      {open ? (
        <div className="absolute bottom-10 left-0 z-20 w-72 rounded-xl border bg-popover p-2 shadow-md">
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="Tìm sticker (vui, yêu, buồn...)"
            className="mb-2 h-8 w-full rounded-md border bg-background px-2 text-xs outline-none"
          />
          <div className="grid max-h-52 grid-cols-4 gap-1 overflow-y-auto">
            {isLoading ? (
              <div className="col-span-4 grid place-items-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : stickers.length === 0 ? (
              <p className="col-span-4 py-6 text-center text-xs text-muted-foreground">
                Không có sticker
              </p>
            ) : (
              stickers.map((s) => (
                <button
                  key={`${s.catId}-${s.id}`}
                  onClick={() => {
                    onPick(s);
                    setOpen(false);
                  }}
                  className="grid aspect-square place-items-center rounded-lg p-1 hover:bg-accent"
                >
                  <AnimatedSticker
                    catId={s.catId}
                    id={s.id}
                    size={56}
                    meta={{
                      type: s.type,
                      staticUrl: s.staticUrl,
                      spriteUrl: s.spriteUrl ?? null,
                      totalFrames: s.totalFrames ?? 1,
                      duration: s.duration ?? 0,
                      size: 130,
                    }}
                  />
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TemplatePopover({ onPick }: { onPick: (s: string) => void }) {
  const { open, setOpen, ref } = usePopover();
  const [kw, setKw] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(kw), 250);
    return () => clearTimeout(t);
  }, [kw]);
  const { data, isLoading } = useSWR(
    open ? ["templates", debounced] : null,
    () => getTemplates(debounced || undefined),
  );
  const templates = data?.templates ?? [];
  return (
    <div ref={ref} className="relative">
      <Tool label="Mẫu tin nhanh" onClick={() => setOpen((o) => !o)}>
        <FileText className="size-4" />
      </Tool>
      {open ? (
        <div className="absolute bottom-10 left-0 z-20 w-80 rounded-xl border bg-popover p-2 shadow-md">
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="Tìm mẫu tin..."
            className="mb-2 h-8 w-full rounded-md border bg-background px-2 text-xs outline-none"
          />
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {isLoading ? (
              <div className="grid place-items-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Chưa có mẫu tin
              </p>
            ) : (
              templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    onPick(t.content);
                    setOpen(false);
                  }}
                  className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-accent"
                >
                  <span className="block truncate text-xs font-medium">
                    {t.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t.content}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AppointmentPopover({
  contactId,
  contactName,
}: {
  contactId: string;
  contactName: string;
}) {
  const { open, setOpen, ref } = usePopover();
  const [busy, setBusy] = React.useState(false);

  async function submit(form: FormData) {
    const date = String(form.get("date") || "");
    if (!date) return;
    setBusy(true);
    try {
      await createAppointment({
        contactId,
        appointmentDate: date,
        appointmentTime: String(form.get("time") || "") || undefined,
        title: String(form.get("title") || "") || undefined,
        location: String(form.get("location") || "") || undefined,
        notes: String(form.get("notes") || "") || undefined,
      });
      toast.success("Đã tạo lịch hẹn");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không tạo được lịch hẹn");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <Tool label="Tạo lịch hẹn" onClick={() => setOpen((o) => !o)}>
        <CalendarPlus className="size-4" />
      </Tool>
      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(new FormData(e.currentTarget));
          }}
          className="absolute bottom-10 left-0 z-20 w-72 space-y-2 rounded-xl border bg-popover p-3 shadow-md"
        >
          <p className="text-xs font-medium">
            Lịch hẹn {contactName ? `với ${contactName}` : ""}
          </p>
          <input
            name="title"
            placeholder="Tiêu đề (vd: Tư vấn gói A)"
            className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none"
          />
          <div className="flex gap-2">
            <input
              name="date"
              type="date"
              required
              className="h-8 flex-1 rounded-md border bg-background px-2 text-xs outline-none"
            />
            <input
              name="time"
              type="time"
              className="h-8 w-24 rounded-md border bg-background px-2 text-xs outline-none"
            />
          </div>
          <input
            name="location"
            placeholder="Địa điểm"
            className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none"
          />
          <textarea
            name="notes"
            placeholder="Ghi chú"
            rows={2}
            className="w-full resize-none rounded-md border bg-background px-2 py-1 text-xs outline-none"
          />
          <Button type="submit" size="sm" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Tạo lịch hẹn
          </Button>
        </form>
      ) : null}
    </div>
  );
}
