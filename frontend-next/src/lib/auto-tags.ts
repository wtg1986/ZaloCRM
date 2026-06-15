// Map hiển thị 9 auto-tag (Friend.autoTags) — backend tự tính theo engagement.
// Đồng bộ với bản Vue (src/constants/auto-tags.ts). Chip "AUTO" read-only.
export interface AutoTagDef {
  icon: string;
  label: string;
  color: string;
  tooltip: string;
}

export const AUTO_TAG_DISPLAY: Record<string, AutoTagDef> = {
  active: {
    icon: "🔥",
    label: "Hoạt động",
    color: "#10B981",
    tooltip: "🔥 Hoạt động — KH vừa nhắn trong 24h qua, đang tương tác tích cực.",
  },
  cooling: {
    icon: "❄️",
    label: "Đang nguội",
    color: "#60A5FA",
    tooltip: "❄️ Đang nguội — KH im lặng 7–14 ngày. Follow-up sớm.",
  },
  cold: {
    icon: "🧊",
    label: "Nguội",
    color: "#3B82F6",
    tooltip: "🧊 Nguội — KH im lặng 15–60 ngày. Cần chiến dịch re-engage.",
  },
  frozen: {
    icon: "🥶",
    label: "Đóng băng",
    color: "#1E40AF",
    tooltip: "🥶 Đóng băng — KH im lặng > 60 ngày. Gần như mất liên lạc.",
  },
  rewarmed: {
    icon: "🔄",
    label: "Ấm trở lại",
    color: "#F59E0B",
    tooltip: "🔄 Ấm trở lại — KH cold/frozen vừa nhắn lại trong 48h.",
  },
  stuck: {
    icon: "⏰",
    label: "Đình trệ",
    color: "#EF4444",
    tooltip: "⏰ Đình trệ — KH dậm chân tại stage quá lâu. Cần rà soát.",
  },
  ready: {
    icon: "💯",
    label: "Sẵn sàng chốt",
    color: "#059669",
    tooltip: "💯 Sẵn sàng chốt — Lead score ≥ 80. Push proposal ngay.",
  },
  atrisk: {
    icon: "🚧",
    label: "Có nguy cơ",
    color: "#DC2626",
    tooltip: "🚧 Có nguy cơ — Score giảm > 20 điểm trong 7 ngày.",
  },
  "has-appointment": {
    icon: "📅",
    label: "Có lịch hẹn",
    color: "#7C3AED",
    tooltip: "📅 Có lịch hẹn — Có lịch hẹn sắp tới.",
  },
};

export function getAutoTagDef(key: string): AutoTagDef {
  return (
    AUTO_TAG_DISPLAY[key] ?? {
      icon: "🏷",
      label: key,
      color: "#9CA3AF",
      tooltip: `Auto-tag: ${key}`,
    }
  );
}
