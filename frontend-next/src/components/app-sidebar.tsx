"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  LogOut,
  MessageSquare,
  Megaphone,
  Settings,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

// IA mới — 5 mục chính (xem docs/PHAN-TICH-CHIEN-LUOC-SAN-PHAM.md).
// perm = quyền (resource) cần để thấy tab; bỏ trống = ai cũng thấy.
const NAV: {
  href: string;
  label: string;
  icon: typeof MessageSquare;
  perm?: string;
}[] = [
  { href: "/inbox", label: "Tin nhắn", icon: MessageSquare, perm: "conversation" },
  { href: "/contacts", label: "Khách hàng", icon: Users, perm: "contact" },
  { href: "/broadcasts", label: "Gửi hàng loạt", icon: Megaphone, perm: "broadcast" },
  { href: "/appointments", label: "Lịch hẹn", icon: CalendarDays },
  { href: "/reports", label: "Báo cáo", icon: BarChart3, perm: "engagement_score" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const can = useCan();
  const canManageStaff = user?.role === "owner" || user?.role === "admin";
  // Ẩn tab nếu member không có quyền (resource.access). owner/admin thấy hết.
  const navItems = NAV.filter((item) => !item.perm || can(item.perm, "access"));
  if (canManageStaff) {
    navItems.push({ href: "/nhan-vien", label: "Nhân viên", icon: UserCog });
  }

  const initials =
    user?.fullName
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "?";

  return (
    <aside className="flex h-svh w-[68px] shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-3">
      {/* Logo */}
      <Link
        href="/inbox"
        className="mb-2 grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"
        aria-label="ZaloCRM"
      >
        <span className="text-lg font-bold">Z</span>
      </Link>

      {/* Nav */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger
                render={
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    className={cn(
                      "group relative grid size-11 place-items-center rounded-xl transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 -translate-x-2 rounded-r-full bg-primary" />
                    )}
                    <Icon className="size-5" />
                  </Link>
                }
              />
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Footer: theme + settings + user */}
      <div className="flex flex-col items-center gap-1">
        <ThemeToggle />
        {can("settings", "access") ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href="/settings"
                  aria-label="Cài đặt"
                  className="grid size-11 place-items-center rounded-xl text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                >
                  <Settings className="size-5" />
                </Link>
              }
            />
            <TooltipContent side="right">Cài đặt</TooltipContent>
          </Tooltip>
        ) : null}

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="mt-1 size-9 rounded-full"
                onClick={logout}
                aria-label="Đăng xuất"
              >
                <Avatar className="size-9">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            }
          />
          <TooltipContent side="right">
            <span className="flex items-center gap-1.5">
              <LogOut className="size-3.5" /> Đăng xuất ·{" "}
              {user?.fullName || user?.email}
            </span>
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
