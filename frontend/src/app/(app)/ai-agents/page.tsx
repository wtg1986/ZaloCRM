"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Bot,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Sparkles,
  Users,
  MessageSquare,
  Zap,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import {
  getAgents,
  getAgentPresets,
  getAgentProviders,
  createAgent,
  updateAgent,
  deleteAgent,
  type AiAgent,
  type AgentInput,
  type AgentPreset,
} from "@/lib/ai-agents";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectItem } from "@/components/ui/select";
import { Modal } from "@/components/staff/ui";

const fieldCls =
  "h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40";
const areaCls =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40";
const labelCls = "mb-1 block text-xs font-medium text-muted-foreground";

export default function AiAgentsPage() {
  const { data, isLoading, mutate } = useSWR("ai-agents", getAgents);
  const [editing, setEditing] = React.useState<AiAgent | "new" | null>(null);
  const agents = data?.agents ?? [];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Bot className="size-5 text-primary" /> Agent AI
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Tạo trợ lý AI theo vai trò / ngành nghề. Đính vào hội thoại để tự động trả lời khách —
            sau vài giây không có người thật phản hồi, AI sẽ tiếp quản.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Tạo Agent
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <EmptyState onCreate={() => setEditing("new")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {agents.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              onEdit={() => setEditing(a)}
              onChanged={() => mutate()}
            />
          ))}
        </div>
      )}

      {editing ? (
        <AgentFormModal
          agent={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            mutate();
          }}
        />
      ) : null}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-primary/10">
        <Bot className="size-6 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium">Chưa có Agent nào</p>
        <p className="text-xs text-muted-foreground">
          Tạo trợ lý AI đầu tiên để tự động trả lời khách hàng theo phong cách của bạn.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Sparkles className="size-4" /> Tạo Agent đầu tiên
      </Button>
    </div>
  );
}

function AgentCard({
  agent,
  onEdit,
  onChanged,
}: {
  agent: AiAgent;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  async function toggleEnabled() {
    setBusy(true);
    try {
      await updateAgent(agent.id, { enabled: !agent.enabled });
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không cập nhật được");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Xoá agent "${agent.name}"? Sẽ gỡ khỏi mọi hội thoại đang đính.`)) return;
    setBusy(true);
    try {
      await deleteAgent(agent.id);
      toast.success("Đã xoá agent");
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không xoá được");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hover-lift flex flex-col rounded-xl border bg-card p-4 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-lg">
          🤖
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{agent.name}</p>
            {!agent.enabled ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                Đang tắt
              </span>
            ) : null}
          </div>
          {agent.role ? (
            <p className="truncate text-xs text-muted-foreground">{agent.role}</p>
          ) : null}
        </div>
        <Switch checked={agent.enabled} onCheckedChange={toggleEnabled} disabled={busy} />
      </div>

      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{agent.systemPrompt}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        <Chip icon={<Zap className="size-3" />}>
          {agent.autonomy === "auto" ? "Tự gửi" : "Soạn nháp"}
        </Chip>
        <Chip icon={<MessageSquare className="size-3" />}>Chờ {agent.takeoverDelaySec}s</Chip>
        <Chip icon={<ShieldAlert className="size-3" />}>Tối đa {agent.maxAutoReplies}</Chip>
        {agent.handleGroups ? <Chip icon={<Users className="size-3" />}>Cả nhóm</Chip> : null}
        <Chip>{agent._count?.conversations ?? 0} hội thoại</Chip>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t pt-3">
        <Button size="sm" variant="outline" onClick={onEdit} disabled={busy}>
          <Pencil className="size-3.5" /> Sửa
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={remove}
          disabled={busy}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          Xoá
        </Button>
      </div>
    </div>
  );
}

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-muted-foreground">
      {icon}
      {children}
    </span>
  );
}

function AgentFormModal({
  agent,
  onClose,
  onSaved,
}: {
  agent: AiAgent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: presetData } = useSWR("ai-agent-presets", getAgentPresets);
  const presets = presetData?.presets ?? [];
  const { data: providerData } = useSWR("ai-agent-providers", getAgentProviders);
  const providers = providerData?.providers ?? [];

  const [form, setForm] = React.useState<AgentInput>(() => ({
    name: agent?.name ?? "",
    role: agent?.role ?? "",
    industry: agent?.industry ?? null,
    systemPrompt: agent?.systemPrompt ?? "",
    knowledge: agent?.knowledge ?? "",
    provider: agent?.provider ?? null,
    model: agent?.model ?? null,
    autonomy: agent?.autonomy ?? "auto",
    takeoverDelaySec: agent?.takeoverDelaySec ?? 10,
    maxAutoReplies: agent?.maxAutoReplies ?? 5,
    handoffKeywords: agent?.handoffKeywords ?? [],
    handleGroups: agent?.handleGroups ?? false,
    enabled: agent?.enabled ?? true,
  }));
  const [kwText, setKwText] = React.useState((agent?.handoffKeywords ?? []).join(", "));
  const [busy, setBusy] = React.useState(false);

  function set<K extends keyof AgentInput>(k: K, v: AgentInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function applyPreset(p: AgentPreset) {
    setForm((f) => ({
      ...f,
      industry: p.key,
      role: f.role || p.role,
      systemPrompt: p.systemPrompt,
      handoffKeywords: p.handoffKeywords,
    }));
    setKwText(p.handoffKeywords.join(", "));
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Nhập tên agent");
    if (!form.systemPrompt.trim()) return toast.error("Nhập system prompt");
    setBusy(true);
    const payload: AgentInput = {
      ...form,
      handoffKeywords: kwText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      if (agent) await updateAgent(agent.id, payload);
      else await createAgent(payload);
      toast.success(agent ? "Đã lưu agent" : "Đã tạo agent");
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={agent ? "Sửa Agent" : "Tạo Agent"} onClose={onClose} wide>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Preset ngành — chỉ khi tạo mới */}
        {!agent ? (
          <div>
            <label className={labelCls}>Chọn nhanh theo ngành (tuỳ chọn)</label>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:bg-accent",
                    form.industry === p.key && "border-primary bg-primary/5 text-primary",
                  )}
                >
                  <span>{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Tên agent *</label>
            <input
              className={fieldCls}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="VD: Trợ lý Spa Lan Anh"
            />
          </div>
          <div>
            <label className={labelCls}>Vai trò</label>
            <input
              className={fieldCls}
              value={form.role ?? ""}
              onChange={(e) => set("role", e.target.value)}
              placeholder="VD: Tư vấn viên"
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>System prompt — phong cách & nhiệm vụ *</label>
          <textarea
            className={cn(areaCls, "min-h-28")}
            value={form.systemPrompt}
            onChange={(e) => set("systemPrompt", e.target.value)}
            placeholder="Bạn là tư vấn viên spa thân thiện. Nhiệm vụ: tư vấn dịch vụ và mời khách đặt lịch..."
          />
        </div>

        <div>
          <label className={labelCls}>Tri thức / FAQ (giá, dịch vụ, chính sách… — AI chỉ dùng thông tin trong đây)</label>
          <textarea
            className={cn(areaCls, "min-h-24")}
            value={form.knowledge ?? ""}
            onChange={(e) => set("knowledge", e.target.value)}
            placeholder={"VD:\n- Gói chăm sóc da cơ bản: 500k/buổi.\n- Mở cửa 9h-21h hằng ngày.\n- Địa chỉ: 12 Nguyễn Trãi."}
          />
        </div>

        {/* Mô hình AI */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Mô hình AI</label>
            <Select
              className="w-full"
              placeholder="Mặc định tổ chức"
              value={form.provider ?? "__org__"}
              onValueChange={(v) => {
                if (v === "__org__") {
                  set("provider", null);
                  set("model", null);
                } else {
                  set("provider", v);
                  const p = providers.find((x) => x.id === v);
                  set("model", p?.models[0]?.value ?? null);
                }
              }}
            >
              <SelectItem value="__org__">Mặc định tổ chức</SelectItem>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </Select>
            {providers.length === 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Chưa có provider nào có API key. Điền key (vd GEMINI_AUTH_TOKEN) trong .env backend.
              </p>
            ) : null}
          </div>
          <div>
            <label className={labelCls}>Model</label>
            <Select
              className="w-full"
              placeholder={form.provider ? "Chọn model" : "Theo gói tổ chức"}
              disabled={!form.provider}
              value={form.model ?? ""}
              onValueChange={(v) => set("model", v)}
            >
              {(providers.find((p) => p.id === form.provider)?.models ?? []).map((mo) => (
                <SelectItem key={mo.value} value={mo.value}>
                  {mo.title}
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>

        {/* Hành vi tiếp quản */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Chế độ</label>
            <Select
              className="w-full"
              value={form.autonomy ?? "auto"}
              onValueChange={(v) => set("autonomy", v as AgentInput["autonomy"])}
            >
              <SelectItem value="auto">Tự gửi</SelectItem>
              <SelectItem value="draft">Soạn nháp chờ duyệt</SelectItem>
            </Select>
          </div>
          <div>
            <label className={labelCls}>Chờ trước khi tiếp quản (giây)</label>
            <input
              type="number"
              min={0}
              className={fieldCls}
              value={form.takeoverDelaySec ?? 10}
              onChange={(e) => set("takeoverDelaySec", Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelCls}>Tối đa lần tự trả lời</label>
            <input
              type="number"
              min={1}
              className={fieldCls}
              value={form.maxAutoReplies ?? 5}
              onChange={(e) => set("maxAutoReplies", Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Từ khoá bàn giao người thật (phân cách bởi dấu phẩy)</label>
          <input
            className={fieldCls}
            value={kwText}
            onChange={(e) => setKwText(e.target.value)}
            placeholder="khiếu nại, gặp nhân viên, hoàn tiền"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Xử lý cả chat nhóm</p>
            <p className="text-xs text-muted-foreground">Mặc định chỉ trả lời chat 1-1 với khách.</p>
          </div>
          <Switch
            checked={!!form.handleGroups}
            onCheckedChange={(v) => set("handleGroups", v)}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Bật agent</p>
            <p className="text-xs text-muted-foreground">Tắt thì không thể đính vào hội thoại.</p>
          </div>
          <Switch checked={!!form.enabled} onCheckedChange={(v) => set("enabled", v)} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t p-3">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Huỷ
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {agent ? "Lưu" : "Tạo Agent"}
        </Button>
      </div>
    </Modal>
  );
}
