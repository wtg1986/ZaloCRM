"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Gom map value→label từ các <SelectItem> (kể cả trong <SelectGroup>) để
// Select.Value hiển thị NHÃN thay vì raw value.
function collectItems(
  children: React.ReactNode,
  map: Record<string, React.ReactNode>,
) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === SelectItem) {
      const p = child.props as { value: string; children: React.ReactNode };
      map[p.value] = p.children;
    } else if (child.type === SelectGroup) {
      collectItems((child.props as { children: React.ReactNode }).children, map);
    }
  });
}

/** Select có style đồng bộ design (thay <select> native). */
export function Select({
  value,
  onValueChange,
  placeholder,
  className,
  disabled,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const items = React.useMemo(() => {
    const m: Record<string, React.ReactNode> = {};
    collectItems(children, m);
    return m;
  }, [children]);
  return (
    <SelectPrimitive.Root
      items={items}
      value={value}
      onValueChange={(v) => onValueChange((v ?? "") as string)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        className={cn(
          "inline-flex h-9 min-w-0 items-center justify-between gap-2 rounded-lg border bg-background px-3 text-sm outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} className="truncate" />
        <SelectPrimitive.Icon className="shrink-0 text-muted-foreground">
          <ChevronDown className="size-4" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          className="isolate z-50 outline-none"
          sideOffset={4}
        >
          <SelectPrimitive.Popup className="z-50 max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            {children}
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export function SelectItem({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-7 outline-none select-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className,
      )}
    >
      <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex">
        <Check className="size-3.5" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="truncate">
        {children}
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <SelectPrimitive.Group>
      <SelectPrimitive.GroupLabel className="px-2 py-1 text-xs font-medium text-muted-foreground">
        {label}
      </SelectPrimitive.GroupLabel>
      {children}
    </SelectPrimitive.Group>
  );
}
