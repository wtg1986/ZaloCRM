// Resolve URL media từ Message.content (tin Zalo lưu media dưới dạng JSON string
// trong `content`: {href, hdUrl, thumb, params, ...}). Port từ frontend cũ
// (message-bubble.vue) — nguồn chân lý cho cách Zalo đóng gói ảnh/video/file/voice.

import type { ChatMessage } from "@/lib/types";

function safeParse(s: unknown): Record<string, unknown> | null {
  if (typeof s !== "string") return null;
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const ZALO_CDN = ["zdn.vn", "zaloapp.com", "zalocontent.com"];

/** URL ảnh — hdUrl > href > normalUrl > thumbUrl > thumb; chấp nhận http trực tiếp. */
export function imageUrl(m: ChatMessage): string | null {
  if (
    m.contentType &&
    ["link", "qr_code", "sticker", "reminder", "call", "contact_card"].includes(
      m.contentType,
    )
  ) {
    return null;
  }
  if (m.contentType === "image" && m.content) {
    if (m.content.startsWith("http")) return m.content;
    const p = safeParse(m.content);
    if (p) {
      return (
        (p.hdUrl as string) ||
        (p.href as string) ||
        (p.normalUrl as string) ||
        (p.thumbUrl as string) ||
        (p.thumb as string) ||
        null
      );
    }
  }
  // Một số tin ảnh có contentType khác nhưng content JSON chứa href ảnh.
  const p = safeParse(m.content);
  if (p) {
    const href =
      (p.hdUrl as string) ||
      (p.href as string) ||
      (p.normalUrl as string) ||
      (p.thumb as string) ||
      "";
    if (href && /\.(jpg|jpeg|png|webp|gif)/i.test(href)) return href;
    if (href && ZALO_CDN.some((h) => href.includes(h))) {
      const params =
        typeof p.params === "string" ? safeParse(p.params) : p.params;
      const fileExt = (params as Record<string, unknown> | null)?.fileExt as
        | string
        | undefined;
      if (!fileExt || /^(jpg|jpeg|png|webp|gif)$/i.test(fileExt)) return href;
    }
  }
  return null;
}

export function videoUrl(m: ChatMessage): string | null {
  if (m.contentType !== "video" || !m.content) return null;
  if (m.content.startsWith("http")) return m.content;
  const p = safeParse(m.content);
  if (!p) return null;
  return (
    (p.href as string) || (p.fileUrl as string) || (p.normalUrl as string) || null
  );
}

export function videoThumb(m: ChatMessage): string | null {
  const p = safeParse(m.content);
  if (!p) return null;
  const thumb =
    (p.thumbUrl as string) || (p.thumb as string) || (p.thumbnail as string);
  if (typeof thumb !== "string" || !thumb.startsWith("http")) return null;
  if (/\.(mp4|mov|webm|mkv)(\?|#|$)/i.test(thumb)) return null;
  return thumb;
}

/** Voice / gif / audio — lấy URL http đầu tiên trong content. */
export function extractMediaUrl(m: ChatMessage): string | null {
  const content = m.content;
  if (!content) return null;
  if (content.startsWith("http")) return content;
  const p = safeParse(content);
  if (!p) return null;
  const url =
    (p.hdUrl as string) ||
    (p.href as string) ||
    (p.url as string) ||
    (p.normalUrl as string) ||
    "";
  return typeof url === "string" && url.startsWith("http") ? url : null;
}

export interface FileInfo {
  name: string;
  size: string;
  href: string;
}

function fmtSize(bytes: number): string {
  return bytes > 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

export function fileInfo(m: ChatMessage): FileInfo | null {
  const p = safeParse(m.content);
  if (!p) return null;
  if (
    p.href &&
    p.name &&
    typeof p.size === "number" &&
    typeof p.mime === "string" &&
    !p.mime.startsWith("image/") &&
    !p.mime.startsWith("video/")
  ) {
    return { name: p.name as string, size: fmtSize(p.size), href: p.href as string };
  }
  const params = typeof p.params === "string" ? safeParse(p.params) : p.params;
  const pp = params as Record<string, unknown> | null;
  if (pp?.fileExt || pp?.fType === 1) {
    const bytes = parseInt((pp.fileSize as string) || "0");
    return {
      name: (p.title as string) || `file.${pp.fileExt || "unknown"}`,
      size: fmtSize(bytes),
      href: (p.href as string) || "",
    };
  }
  return null;
}

/** Sticker — proxy backend redirect tới CDN Zalo (?img=1 render ngay). */
export function stickerUrl(m: ChatMessage): string | null {
  const p = stickerParams(m);
  if (!p) return null;
  return `/api/v1/zalo-sticker/${p.catId}/${p.id}?img=1`;
}

/** id + catId của sticker (để fetch metadata animation). */
export function stickerParams(
  m: ChatMessage,
): { id: number; catId: number } | null {
  if (m.contentType !== "sticker") return null;
  const p = safeParse(m.content);
  if (!p) return null;
  const id = Number(p.id);
  const catId = Number(p.catId);
  if (!id || !catId) return null;
  return { id, catId };
}

/** Caption đi kèm ảnh/video/file (bỏ URL / filename / path). */
export function mediaCaption(m: ChatMessage): string {
  const p = safeParse(m.content);
  if (!p) return "";
  for (const c of [p.title, p.caption, p.description, p.text]) {
    if (typeof c !== "string") continue;
    const t = c.trim();
    if (!t || /^https?:\/\//i.test(t) || t.startsWith("/")) continue;
    if (
      /\.(jpe?g|png|webp|gif|mp4|mov|avi|mkv|webm|pdf|docx?|xlsx?|zip|rar)$/i.test(
        t,
      )
    )
      continue;
    return t;
  }
  return "";
}

function paramsOf(p: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!p) return null;
  return typeof p.params === "string"
    ? safeParse(p.params)
    : (p.params as Record<string, unknown> | null) ?? null;
}

function fmtDuration(sec: number): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} giây`;
  if (s === 0) return `${m} phút`;
  return `${m} phút ${s} giây`;
}

// ── Cuộc gọi (contentType="call") ────────────────────────────────────────────
export interface CallInfo {
  label: string;
  duration: string;
  missed: boolean;
  outgoing: boolean;
  video: boolean;
}
export function callInfo(m: ChatMessage): CallInfo | null {
  if (m.contentType !== "call") return null;
  const p = safeParse(m.content);
  const params = paramsOf(p);
  const dur = Number(params?.duration ?? p?.duration ?? 0);
  const outgoing = Number(params?.isCaller ?? p?.isCaller ?? 0) === 1;
  const video = Number(params?.calltype ?? params?.callType ?? 0) === 1;
  const missed = dur === 0;
  const v = video ? "video " : "";
  const label = missed
    ? outgoing
      ? `Cuộc gọi ${v}không trả lời`.trim()
      : `Cuộc gọi ${v}nhỡ`.trim()
    : outgoing
      ? `Cuộc gọi ${v}đi`.trim()
      : `Cuộc gọi ${v}đến`.trim();
  return { label, duration: fmtDuration(dur), missed, outgoing, video };
}

// ── Bình chọn (contentType="poll") ───────────────────────────────────────────
export interface PollInfo {
  header: string;
  question: string;
  actor: string;
  options: string[];
}
export function pollInfo(m: ChatMessage): PollInfo | null {
  if (m.contentType !== "poll") return null;
  const p = safeParse(m.content);
  if (!p) return null;
  const params = paramsOf(p);
  const action = String(p.action || "").toLowerCase();
  const header =
    action === "create"
      ? "Đã tạo bình chọn"
      : action === "vote"
        ? "Đã bình chọn"
        : action === "update"
          ? "Cập nhật bình chọn"
          : action === "close"
            ? "Bình chọn đã đóng"
            : "Bình chọn";
  const rawOpts =
    (params?.options as unknown[]) || (params?.choices as unknown[]) || [];
  const options = Array.isArray(rawOpts)
    ? rawOpts
        .map((o) =>
          typeof o === "string"
            ? o
            : ((o as { text?: string; content?: string })?.text ??
              (o as { content?: string })?.content ??
              ""),
        )
        .filter(Boolean)
    : [];
  return {
    header,
    question: String(params?.question || p.title || "").trim(),
    actor: String(params?.dName || "").trim(),
    options,
  };
}

// ── Link preview (contentType="link") ────────────────────────────────────────
export interface LinkInfo {
  href: string;
  title: string;
  desc: string;
  thumb: string | null;
  host: string;
}
export function linkInfo(m: ChatMessage): LinkInfo | null {
  if (m.contentType !== "link") return null;
  const p = safeParse(m.content);
  if (!p) return null;
  const params = paramsOf(p);
  const href = String(p.href || "");
  if (!href) return null;
  let host = "";
  try {
    host = new URL(href).hostname.replace(/^www\./, "");
  } catch {
    /* ignore */
  }
  const title =
    String(params?.mediaTitle || "") ||
    (String(p.title || "") !== href ? String(p.title || "") : "") ||
    host;
  const thumb =
    typeof p.thumb === "string" && p.thumb.startsWith("http") ? p.thumb : null;
  return {
    href,
    title: title || host,
    desc: String(p.description || params?.description || ""),
    thumb,
    host,
  };
}

// ── Thẻ (contact_card / nhắc hẹn) ────────────────────────────────────────────
export interface CardInfo {
  title: string;
  desc: string;
  thumb: string | null;
  href: string;
}
export function cardInfo(m: ChatMessage): CardInfo | null {
  if (m.contentType !== "contact_card") return null;
  const p = safeParse(m.content);
  if (!p) return null;
  const thumb =
    typeof p.thumb === "string" && p.thumb.startsWith("http")
      ? p.thumb
      : typeof p.href === "string" && /\.(png|jpe?g|webp)/i.test(p.href)
        ? p.href
        : null;
  return {
    title: String(p.title || ""),
    desc: String(p.description || ""),
    thumb,
    href: String(p.href || ""),
  };
}

// Tin sự kiện hệ thống còn lại (reminder, profile…) — format câu từ params.msg.
// KHÔNG fallback vào title (title đôi khi là rác kiểu "sendBubbleMessage").
export function actionMessage(
  m: ChatMessage,
): { icon: string; text: string } | null {
  const p = safeParse(m.content);
  if (!p || !p.action) return null;
  const action = String(p.action).toLowerCase();
  const params = paramsOf(p);
  const msg = params?.msg as Record<string, unknown> | undefined;
  const tpl = (msg?.vi as string) || (msg?.en as string) || "";
  if (!tpl) {
    // Không có mẫu câu → dùng title NẾU nó không phải token rác camelCase.
    const t = String(p.title || "").trim();
    if (!t || /^[a-z]+[A-Z][a-zA-Z]*$/.test(t)) return null;
    return { icon: "ℹ️", text: t };
  }
  const actor = String(params?.dName || params?.fromName || m.senderName || "");
  const subject = String(
    params?.question || params?.eventName || params?.title || p.description || "",
  );
  const text = tpl
    .replace(/%1\$s/g, actor)
    .replace(/%2\$s/g, subject)
    .replace(/%3\$s/g, "")
    .replace(/%4\$s/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  const icon = action.includes("reminder") || action.includes("actionlist")
    ? "⏰"
    : "ℹ️";
  return { icon, text };
}

// Sự kiện thu hồi/xoá của Zalo: content là JSON array
// [{type, actionType, clientDelMsgId, globalDelMsgId, ...}] — KHÔNG phải nội dung
// đọc được, không nên render thô thành bong bóng.
export function isRecallEvent(m: ChatMessage): boolean {
  const c = (m.content || "").trim();
  if (!c.startsWith("[")) return false;
  try {
    const arr = JSON.parse(c);
    return (
      Array.isArray(arr) &&
      arr.some(
        (x) =>
          x &&
          typeof x === "object" &&
          ("clientDelMsgId" in x ||
            "globalDelMsgId" in x ||
            (x as Record<string, unknown>).actionType != null),
      )
    );
  } catch {
    return false;
  }
}

/** Văn bản hiển thị cho link/card khi content là JSON. */
export function displayText(content: string | null | undefined): string {
  if (!content) return "";
  if (!content.startsWith("{")) return content;
  const p = safeParse(content);
  if (!p) return content;
  if (p.title && p.href) return `${p.title}\n🔗 ${p.href}`;
  return (
    (p.title as string) ||
    (p.text as string) ||
    (p.description as string) ||
    (p.href ? `🔗 ${p.href}` : content)
  );
}
