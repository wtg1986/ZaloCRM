"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputCls =
  "h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40";
export const labelCls = "mb-1 block text-xs font-medium text-muted-foreground";

export function initials(name: string): string {
  const p = (name || "?").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export function Chip({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "green" | "amber" | "indigo" | "slate";
}) {
  const tones: Record<string, string> = {
    default: "bg-secondary text-secondary-foreground",
    green: "bg-success/15 text-success",
    amber: "bg-warning/15 text-warning",
    indigo: "bg-primary/10 text-primary",
    slate: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "flex max-h-[88vh] w-full flex-col overflow-hidden rounded-xl border bg-card shadow-lg",
          wide ? "max-w-2xl" : "max-w-md",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
