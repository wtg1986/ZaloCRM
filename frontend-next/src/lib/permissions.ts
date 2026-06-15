"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth";

// Hook kiểm tra quyền cho UI (ẩn/hiện tab, nút). owner/admin (fullAccess) → luôn true.
// member → theo grants từ /profile. KHÔNG thay thế kiểm tra backend (requireGrant).
export function useCan() {
  const { user } = useAuth();
  return React.useCallback(
    (resource: string, action: string = "access"): boolean => {
      if (!user) return false;
      // owner/admin → luôn full (kể cả khi /profile chưa kịp gắn fullAccess).
      if (user.fullAccess || user.role === "owner" || user.role === "admin")
        return true;
      return user.grants?.[resource]?.[action] === true;
    },
    [user],
  );
}
