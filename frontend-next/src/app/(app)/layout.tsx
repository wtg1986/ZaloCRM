"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { joinOrg } from "@/lib/socket";
import { AppSidebar } from "@/components/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Join phòng org để nhận realtime khi đã đăng nhập.
  React.useEffect(() => {
    if (user?.orgId) joinOrg(user.orgId);
  }, [user?.orgId]);

  if (loading || !user) {
    return (
      <div className="grid h-svh place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider delay={200}>
      <div className="flex h-svh overflow-hidden bg-background">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </TooltipProvider>
  );
}
