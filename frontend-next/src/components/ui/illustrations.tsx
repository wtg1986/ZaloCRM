/**
 * illustrations.tsx — Minh hoạ SVG inline, line-art nhẹ nhàng (tông Calm + Indigo).
 * Dùng trực tiếp CSS var của theme (--primary, --muted-foreground, --border…) nên
 * tự thích ứng sáng/tối. Không thêm dependency, nhẹ và sắc nét ở mọi DPI.
 */
import * as React from "react";

type Props = React.SVGProps<SVGSVGElement>;

const P = "var(--primary)";
const MUTED = "var(--muted-foreground)";
const BORDER = "var(--border)";
const CARD = "var(--card)";

/* ── Brand art cho trang đăng nhập ────────────────────────────────────────── */
/* "Nhiều nick Zalo → gom về một inbox". Dùng currentColor → panel set màu chữ. */
export function AuthBrandArt({ className, ...props }: Props) {
  return (
    <svg viewBox="0 0 400 300" fill="none" className={className} aria-hidden {...props}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {/* Đường nối avatar → mép cửa sổ inbox (cong, vẽ trước nên nằm dưới) */}
        <g strokeWidth="1.5" opacity="0.4">
          <path d="M84 82 Q 116 120 132 140" />
          <path d="M322 74 Q 290 110 268 134" />
          <path d="M84 238 Q 116 200 132 180" />
          <path d="M326 232 Q 300 206 268 180" />
        </g>

        {/* Glow nền cho cửa sổ trung tâm */}
        <circle cx="200" cy="158" r="82" fill="currentColor" fillOpacity="0.06" stroke="none" />

        {/* Cửa sổ inbox trung tâm */}
        <g>
          <rect x="132" y="108" width="136" height="104" rx="16" fill="currentColor" fillOpacity="0.14" />
          <rect x="132" y="108" width="136" height="104" rx="16" strokeWidth="2" />
          {/* header: glyph chat + tiêu đề */}
          <rect x="146" y="122" width="16" height="16" rx="5" fill="currentColor" fillOpacity="0.9" stroke="none" />
          <rect x="170" y="127" width="58" height="6" rx="3" fill="currentColor" fillOpacity="0.55" stroke="none" />
          <line x1="144" y1="150" x2="256" y2="150" strokeWidth="1.5" opacity="0.25" />
          {/* 3 dòng hội thoại: avatar + dòng chữ */}
          <g stroke="none" fill="currentColor">
            <circle cx="156" cy="166" r="7" fillOpacity="0.9" />
            <rect x="170" y="163" width="80" height="6" rx="3" fillOpacity="0.45" />
            <circle cx="156" cy="186" r="7" fillOpacity="0.9" />
            <rect x="170" y="183" width="66" height="6" rx="3" fillOpacity="0.45" />
            <circle cx="156" cy="206" r="7" fillOpacity="0.9" />
            <rect x="170" y="203" width="74" height="6" rx="3" fillOpacity="0.45" />
          </g>
        </g>

        {/* Avatar các nick (account nodes) — 4 góc */}
        <AccountNode cx={84} cy={82} />
        <AccountNode cx={322} cy={74} />
        <AccountNode cx={84} cy={238} />
        <AccountNode cx={326} cy={232} />
      </g>
    </svg>
  );
}

/* Một avatar tài khoản: vòng tròn + người + chấm trạng thái. */
function AccountNode({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="24" fill="currentColor" fillOpacity="0.16" />
      <circle cx={cx} cy={cy} r="24" strokeWidth="2" />
      <circle cx={cx} cy={cy - 5} r="6.5" fill="currentColor" fillOpacity="0.9" stroke="none" />
      <path
        d={`M${cx - 11} ${cy + 15} a11 11 0 0 1 22 0`}
        fill="currentColor"
        fillOpacity="0.9"
        stroke="none"
      />
      {/* chấm online */}
      <circle cx={cx + 17} cy={cy + 16} r="6" fill="#34d399" stroke="currentColor" strokeWidth="2" />
    </g>
  );
}

/* ── Empty states ─────────────────────────────────────────────────────────── */

export function EmptyInboxArt({ className, ...props }: Props) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden {...props}>
      <ellipse cx="100" cy="140" rx="64" ry="9" fill={MUTED} opacity="0.12" />
      <rect x="40" y="34" width="120" height="84" rx="14" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <path d="M48 46 l52 38 l52 -38" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <rect x="116" y="20" width="52" height="40" rx="10" fill={P} fillOpacity="0.14" stroke={P} strokeWidth="2" />
      <path d="M128 36 h28 M128 46 h18" stroke={P} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyChatArt({ className, ...props }: Props) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden {...props}>
      <ellipse cx="100" cy="142" rx="60" ry="8" fill={MUTED} opacity="0.12" />
      <rect x="30" y="40" width="104" height="60" rx="16" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <path d="M30 92 q0 8 8 8 h6 v10 l14 -10" fill={CARD} stroke={BORDER} strokeWidth="2" strokeLinejoin="round" />
      <path d="M46 60 h64 M46 76 h40" stroke={MUTED} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <rect x="92" y="64" width="78" height="50" rx="14" fill={P} fillOpacity="0.14" stroke={P} strokeWidth="2" />
      <path d="M170 106 q0 8 -8 8 h-6 v10 l-14 -10" fill={P} fillOpacity="0.14" stroke={P} strokeWidth="2" strokeLinejoin="round" />
      <path d="M106 82 h44 M106 96 h28" stroke={P} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyContactsArt({ className, ...props }: Props) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden {...props}>
      <ellipse cx="100" cy="140" rx="62" ry="9" fill={MUTED} opacity="0.12" />
      <rect x="44" y="34" width="112" height="92" rx="14" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <circle cx="74" cy="64" r="14" fill={P} fillOpacity="0.16" stroke={P} strokeWidth="2" />
      <path d="M58 92 a16 14 0 0 1 32 0" stroke={P} strokeWidth="2" strokeLinecap="round" />
      <path d="M104 58 h40 M104 72 h30 M104 100 h52 M104 112 h34" stroke={MUTED} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

export function EmptyCalendarArt({ className, ...props }: Props) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden {...props}>
      <ellipse cx="100" cy="142" rx="58" ry="8" fill={MUTED} opacity="0.12" />
      <rect x="50" y="42" width="100" height="84" rx="12" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <line x1="50" y1="66" x2="150" y2="66" stroke={BORDER} strokeWidth="2" />
      <line x1="74" y1="34" x2="74" y2="50" stroke={P} strokeWidth="3" strokeLinecap="round" />
      <line x1="126" y1="34" x2="126" y2="50" stroke={P} strokeWidth="3" strokeLinecap="round" />
      <g fill={MUTED} opacity="0.4">
        <rect x="64" y="78" width="16" height="12" rx="3" />
        <rect x="92" y="78" width="16" height="12" rx="3" />
        <rect x="120" y="78" width="16" height="12" rx="3" />
        <rect x="64" y="98" width="16" height="12" rx="3" />
        <rect x="120" y="98" width="16" height="12" rx="3" />
      </g>
      <rect x="90" y="96" width="20" height="16" rx="4" fill={P} fillOpacity="0.18" stroke={P} strokeWidth="2" />
      <path d="M95 104 l3 3 l6 -7" stroke={P} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function EmptySearchArt({ className, ...props }: Props) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden {...props}>
      <ellipse cx="100" cy="142" rx="56" ry="8" fill={MUTED} opacity="0.12" />
      <circle cx="92" cy="74" r="40" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <circle cx="92" cy="74" r="26" fill={P} fillOpacity="0.12" stroke={P} strokeWidth="2" />
      <path d="M120 102 l22 22" stroke={P} strokeWidth="4" strokeLinecap="round" />
      <path d="M80 74 h24 M80 84 h14" stroke={P} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
