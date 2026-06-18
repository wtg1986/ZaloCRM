"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  PLAN_CATALOG,
  BANK_INFO,
  formatVnd,
  type PlanCatalogItem,
} from "@/lib/platform";
import { Modal } from "@/components/staff/ui";

export function UpgradeDialog({
  currentPlan,
  initialPlan,
  onClose,
}: {
  currentPlan: string;
  initialPlan?: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [picked, setPicked] = React.useState<PlanCatalogItem | null>(
    () => PLAN_CATALOG.find((p) => p.key === initialPlan && p.priceMonthly > 0) ?? null,
  );
  const orgRef = (user?.orgId ?? "").slice(0, 8).toUpperCase();
  const transferNote = picked
    ? `NANGGOI ${orgRef} ${picked.key.toUpperCase()}`
    : "";

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`Đã sao chép ${label}`),
      () => toast.error("Không sao chép được"),
    );
  }

  return (
    <Modal title="Nâng gói dịch vụ" onClose={onClose} wide>
      <div className="space-y-4">
        {/* Bảng giá */}
        <div className="grid grid-cols-3 gap-3">
          {PLAN_CATALOG.map((p) => {
            const isCurrent = p.key === currentPlan;
            const isPicked = picked?.key === p.key;
            return (
              <div
                key={p.key}
                className={cn(
                  "flex flex-col rounded-xl border p-3",
                  p.highlight && "border-primary",
                  isPicked && "ring-2 ring-primary",
                )}
              >
                {p.highlight ? (
                  <span className="mb-1 w-fit rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Phổ biến
                  </span>
                ) : null}
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="mb-2 text-lg font-bold text-primary">
                  {p.priceMonthly === 0
                    ? "0đ"
                    : `${p.priceMonthly.toLocaleString("vi-VN")}đ`}
                  {p.priceMonthly > 0 ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      /tháng
                    </span>
                  ) : null}
                </p>
                <ul className="mb-3 flex-1 space-y-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs">
                      <Check className="mt-0.5 size-3 shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <span className="rounded-lg bg-muted px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
                    Gói hiện tại
                  </span>
                ) : p.priceMonthly === 0 ? (
                  <span className="rounded-lg px-2 py-1.5 text-center text-xs text-muted-foreground">
                    —
                  </span>
                ) : (
                  <button
                    onClick={() => setPicked(p)}
                    className="rounded-lg bg-primary px-2 py-1.5 text-center text-xs font-medium text-primary-foreground hover:opacity-90"
                  >
                    Chọn gói này
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Hướng dẫn chuyển khoản */}
        {picked ? (
          <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
            <p className="text-sm font-semibold">
              Chuyển khoản để nâng lên gói {picked.name} —{" "}
              <span className="text-primary">{formatVnd(picked.priceMonthly)}</span>
            </p>
            <CopyRow label="Ngân hàng" value={BANK_INFO.bank} onCopy={copy} />
            <CopyRow label="Số tài khoản" value={BANK_INFO.account} onCopy={copy} />
            <CopyRow label="Chủ tài khoản" value={BANK_INFO.holder} onCopy={copy} />
            <CopyRow
              label="Số tiền"
              value={`${picked.priceMonthly.toLocaleString("vi-VN")}đ`}
              onCopy={copy}
            />
            <CopyRow label="Nội dung CK" value={transferNote} onCopy={copy} highlight />
            <p className="pt-1 text-xs text-muted-foreground">
              Sau khi chuyển khoản đúng nội dung, gói sẽ được kích hoạt trong vài
              giờ làm việc. Cần gấp: liên hệ hỗ trợ kèm mã{" "}
              <b>{orgRef}</b>.
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
  highlight,
}: {
  label: string;
  value: string;
  onCopy: (v: string, label: string) => void;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <button
        onClick={() => onCopy(value, label.toLowerCase())}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-medium hover:bg-accent",
          highlight && "bg-warning/15 text-warning",
        )}
      >
        {value}
        <Copy className="size-3 opacity-60" />
      </button>
    </div>
  );
}
