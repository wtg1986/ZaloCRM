"use client";

import * as React from "react";
import useSWR from "swr";
import { ChevronDown, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { prettyTagName } from "@/lib/tag-display";
import { useAuth } from "@/lib/auth";
import { getStatuses } from "@/lib/crm";
import { getCrmTags } from "@/lib/chat-ops";
import type { ConversationFilters } from "@/lib/resources";

export type RailFilters = Pick<
  ConversationFilters,
  | "assignedUserId"
  | "statusId"
  | "scoreMin"
  | "scoreMax"
  | "relationshipKindAny"
  | "tags"
  | "autoTagsAny"
  | "dateFrom"
>;

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
const TIME_OPTS = [
  { key: "today", label: "Hôm nay", days: 0 },
  { key: "7d", label: "7 ngày", days: 7 },
  { key: "30d", label: "30 ngày", days: 30 },
] as const;

const SCORE_OPTS = [
  { key: "high", label: "Cao ≥70", v: { scoreMin: 70 } },
  { key: "mid", label: "TB 40–69", v: { scoreMin: 40, scoreMax: 69 } },
  { key: "low", label: "Thấp <40", v: { scoreMax: 39 } },
] as const;

const REL_OPTS = [
  { key: "friend", label: "Bạn bè", v: "friend" },
  { key: "stranger", label: "Người lạ", v: "chatting_stranger,ghost" },
] as const;

const AUTO_TAGS = [
  { key: "ready", label: "Sẵn sàng", icon: "🔥" },
  { key: "stuck", label: "Đình trệ", icon: "🐢" },
  { key: "cold", label: "Nguội", icon: "❄️" },
  { key: "atrisk", label: "Rủi ro", icon: "⚠️" },
  { key: "rewarmed", label: "Hâm nóng", icon: "♨️" },
] as const;

const SALE_OPTS = [
  { key: "all", label: "Tất cả sale" },
  { key: "me", label: "Tôi" },
] as const;

interface RailState {
  sale: "all" | "me";
  statusId: string;
  scoreKey: string;
  relKey: string;
  timeKey: string;
  crmTags: string[];
  autoTags: string[];
}

const EMPTY: RailState = {
  sale: "all",
  statusId: "",
  scoreKey: "",
  relKey: "",
  timeKey: "",
  crmTags: [],
  autoTags: [],
};

export function FilterRail({
  value: _value,
  onChange,
}: {
  value: RailFilters;
  onChange: (f: RailFilters) => void;
}) {
  const { user } = useAuth();
  const { data: statusData } = useSWR("statuses", getStatuses);
  const { data: tagData } = useSWR("crm-tags-all", getCrmTags);
  const statuses = (statusData?.statuses ?? [])
    .slice()
    .sort((a, b) => a.order - b.order);
  const crmTags = tagData?.tags ?? [];

  const [st, setSt] = React.useState<RailState>(EMPTY);
  const [open, setOpen] = React.useState<Record<string, boolean>>({
    sale: true,
    stage: true,
    score: true,
    tag: true,
    time: false,
    auto: false,
    rel: false,
  });

  // Đẩy state → filter backend mỗi khi đổi.
  React.useEffect(() => {
    const score = SCORE_OPTS.find((o) => o.key === st.scoreKey)?.v ?? {};
    const rel = REL_OPTS.find((o) => o.key === st.relKey)?.v;
    const time = TIME_OPTS.find((o) => o.key === st.timeKey);
    onChange({
      assignedUserId: st.sale === "me" ? user?.id : undefined,
      statusId: st.statusId || undefined,
      relationshipKindAny: rel || undefined,
      tags: st.crmTags.length ? st.crmTags.join(",") : undefined,
      autoTagsAny: st.autoTags.length ? st.autoTags.join(",") : undefined,
      dateFrom: time ? daysAgoISO(time.days) : undefined,
      ...score,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, user?.id]);

  const activeCount =
    (st.sale !== "all" ? 1 : 0) +
    (st.statusId ? 1 : 0) +
    (st.scoreKey ? 1 : 0) +
    (st.relKey ? 1 : 0) +
    (st.timeKey ? 1 : 0) +
    st.crmTags.length +
    st.autoTags.length;

  const toggleTag = (name: string) =>
    setSt((s) => ({
      ...s,
      crmTags: s.crmTags.includes(name)
        ? s.crmTags.filter((x) => x !== name)
        : [...s.crmTags, name],
    }));
  const toggleAuto = (key: string) =>
    setSt((s) => ({
      ...s,
      autoTags: s.autoTags.includes(key)
        ? s.autoTags.filter((x) => x !== key)
        : [...s.autoTags, key],
    }));
  const toggleSection = (k: string) =>
    setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Filter className="size-4" /> Bộ lọc
          {activeCount > 0 ? (
            <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </span>
        {activeCount > 0 ? (
          <button
            onClick={() => setSt(EMPTY)}
            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" /> Xoá
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {/* Sale phụ trách */}
        <Section
          emoji="👤"
          title="Sale phụ trách"
          count={st.sale !== "all" ? 1 : 0}
          open={open.sale}
          onToggle={() => toggleSection("sale")}
        >
          <div className="space-y-0.5">
            {SALE_OPTS.map((o) => (
              <Row
                key={o.key}
                active={st.sale === o.key}
                onClick={() => setSt((s) => ({ ...s, sale: o.key }))}
              >
                {o.label}
              </Row>
            ))}
          </div>
        </Section>

        {/* Giai đoạn */}
        {statuses.length > 0 ? (
          <Section
            emoji="📊"
            title="Giai đoạn"
            count={st.statusId ? 1 : 0}
            open={open.stage}
            onToggle={() => toggleSection("stage")}
          >
            <div className="flex flex-wrap gap-1">
              <Pill
                active={!st.statusId}
                onClick={() => setSt((s) => ({ ...s, statusId: "" }))}
              >
                Tất cả
              </Pill>
              {statuses.map((s) => (
                <Pill
                  key={s.id}
                  active={st.statusId === s.id}
                  color={s.color || undefined}
                  onClick={() =>
                    setSt((p) => ({
                      ...p,
                      statusId: p.statusId === s.id ? "" : s.id,
                    }))
                  }
                >
                  {s.name}
                </Pill>
              ))}
            </div>
          </Section>
        ) : null}

        {/* Điểm */}
        <Section
          emoji="⭐"
          title="Điểm tiềm năng"
          count={st.scoreKey ? 1 : 0}
          open={open.score}
          onToggle={() => toggleSection("score")}
        >
          <div className="flex flex-wrap gap-1">
            {SCORE_OPTS.map((o) => (
              <Pill
                key={o.key}
                active={st.scoreKey === o.key}
                onClick={() =>
                  setSt((s) => ({
                    ...s,
                    scoreKey: s.scoreKey === o.key ? "" : o.key,
                  }))
                }
              >
                {o.label}
              </Pill>
            ))}
          </div>
        </Section>

        {/* Tag CRM */}
        {crmTags.length > 0 ? (
          <Section
            emoji="🏷"
            title="Tag CRM"
            count={st.crmTags.length}
            open={open.tag}
            onToggle={() => toggleSection("tag")}
          >
            <div className="flex flex-wrap gap-1">
              {crmTags.map((t) => (
                <Pill
                  key={t.id}
                  active={st.crmTags.includes(t.name)}
                  color={t.color || undefined}
                  onClick={() => toggleTag(t.name)}
                >
                  {prettyTagName(t.name)}
                </Pill>
              ))}
            </div>
          </Section>
        ) : null}

        {/* Thời gian */}
        <Section
          emoji="🕐"
          title="Thời gian"
          count={st.timeKey ? 1 : 0}
          open={open.time}
          onToggle={() => toggleSection("time")}
        >
          <div className="flex flex-wrap gap-1">
            {TIME_OPTS.map((o) => (
              <Pill
                key={o.key}
                active={st.timeKey === o.key}
                onClick={() =>
                  setSt((s) => ({
                    ...s,
                    timeKey: s.timeKey === o.key ? "" : o.key,
                  }))
                }
              >
                {o.label}
              </Pill>
            ))}
          </div>
        </Section>

        {/* Auto-tag */}
        <Section
          emoji="✨"
          title="Trạng thái tự động"
          count={st.autoTags.length}
          open={open.auto}
          onToggle={() => toggleSection("auto")}
        >
          <div className="flex flex-wrap gap-1">
            {AUTO_TAGS.map((a) => (
              <Pill
                key={a.key}
                active={st.autoTags.includes(a.key)}
                onClick={() => toggleAuto(a.key)}
              >
                {a.icon} {a.label}
              </Pill>
            ))}
          </div>
        </Section>

        {/* Quan hệ */}
        <Section
          emoji="🔗"
          title="Quan hệ"
          count={st.relKey ? 1 : 0}
          open={open.rel}
          onToggle={() => toggleSection("rel")}
        >
          <div className="flex flex-wrap gap-1">
            {REL_OPTS.map((o) => (
              <Pill
                key={o.key}
                active={st.relKey === o.key}
                onClick={() =>
                  setSt((s) => ({
                    ...s,
                    relKey: s.relKey === o.key ? "" : o.key,
                  }))
                }
              >
                {o.label}
              </Pill>
            ))}
          </div>
        </Section>
      </div>
    </aside>
  );
}

function Section({
  emoji,
  title,
  count,
  open,
  onToggle,
  children,
}: {
  emoji: string;
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-sidebar-border/60 last:border-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/40"
      >
        <span className="text-[13px]">{emoji}</span>
        <span className="flex-1">{title}</span>
        <span
          className={cn(
            "grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold tabular-nums",
            count > 0
              ? "bg-primary text-primary-foreground"
              : "bg-sidebar-accent text-muted-foreground",
          )}
        >
          {count}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
        />
      </button>
      {open ? <div className="px-3 pb-2.5">{children}</div> : null}
    </div>
  );
}

function Row({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50",
      )}
    >
      <span
        className={cn(
          "size-3 shrink-0 rounded-full border",
          active ? "border-primary bg-primary" : "border-border",
        )}
      />
      <span className="truncate">{children}</span>
    </button>
  );
}

function Pill({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-sidebar-accent/60",
      )}
    >
      {color ? (
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      {children}
    </button>
  );
}
