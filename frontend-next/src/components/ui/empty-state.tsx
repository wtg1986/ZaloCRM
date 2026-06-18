/**
 * EmptyState — trạng thái rỗng có minh hoạ SVG + tiêu đề + mô tả + hành động.
 * Có hiệu ứng vào nhẹ (fade-in-up). Dùng chung cho inbox/contacts/search…
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  art,
  title,
  description,
  action,
  className,
}: {
  art?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-fade-in-up flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      {art ? (
        <div className="mb-4 w-40 max-w-[60%] animate-float-slow [animation-duration:9s]">
          {art}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
