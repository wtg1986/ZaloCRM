"use client";

import * as React from "react";
import { apiGet, apiPost, setToken, getToken } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Bootstrap: nếu có token → fetch /profile xác thực.
  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const profile = await apiGet<AuthUser>("/profile");
        if (active) setUser(profile);
      } catch {
        setToken(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const res = await apiPost<{ token: string; user: AuthUser }>(
      "/auth/login",
      { email, password },
    );
    setToken(res.token);
    // res.user là JWT payload (chưa có fullAccess/grants) → fetch /profile để
    // có quyền hiệu lực ngay, tránh ẩn nhầm tab/nút sau khi đăng nhập.
    try {
      const profile = await apiGet<AuthUser>("/profile");
      setUser(profile);
    } catch {
      setUser(res.user);
    }
  }, []);

  const logout = React.useCallback(() => {
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải nằm trong <AuthProvider>");
  return ctx;
}
