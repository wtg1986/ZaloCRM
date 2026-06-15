"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, setToken, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();
  const [mode, setMode] = React.useState<
    "loading" | "login" | "setup" | "register"
  >("loading");
  const [submitting, setSubmitting] = React.useState(false);

  // Đã đăng nhập rồi → vào thẳng inbox.
  React.useEffect(() => {
    if (user) router.replace("/inbox");
  }, [user, router]);

  // Xác định first-run setup hay login thường.
  React.useEffect(() => {
    apiGet<{ needsSetup: boolean }>("/setup/status")
      .then((r) => setMode(r.needsSetup ? "setup" : "login"))
      .catch(() => setMode("login"));
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      await login(
        String(fd.get("email")),
        String(fd.get("password")),
      );
      router.replace("/inbox");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Đăng nhập thất bại",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const res = await apiPost<{ token: string; user: AuthUser }>(
        "/auth/register",
        {
          orgName: String(fd.get("orgName")),
          fullName: String(fd.get("fullName")),
          email: String(fd.get("email")),
          password: String(fd.get("password")),
        },
      );
      setToken(res.token);
      toast.success("Tạo tổ chức thành công — chào mừng!");
      window.location.href = "/inbox";
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Đăng ký thất bại",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const res = await apiPost<{ token: string; user: AuthUser }>("/setup", {
        orgName: String(fd.get("orgName")),
        fullName: String(fd.get("fullName")),
        email: String(fd.get("email")),
        password: String(fd.get("password")),
      });
      setToken(res.token);
      toast.success("Tạo tài khoản quản trị thành công");
      window.location.href = "/inbox";
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Không tạo được tài khoản",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <span className="text-xl font-bold">Z</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">ZaloCRM</h1>
            <p className="text-sm text-muted-foreground">
              Quản lý đa nick Zalo cho đội sale
            </p>
          </div>
        </div>

        {mode === "loading" ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : mode === "login" ? (
          <Card>
            <CardHeader>
              <CardTitle>Đăng nhập</CardTitle>
              <CardDescription>
                Nhập email và mật khẩu để vào hệ thống.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required autoFocus />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <Input id="password" name="password" type="password" required />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  Đăng nhập
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Chưa có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="font-medium text-primary hover:underline"
                >
                  Đăng ký tổ chức mới
                </button>
              </p>
            </CardContent>
          </Card>
        ) : mode === "register" ? (
          <Card>
            <CardHeader>
              <CardTitle>Đăng ký tổ chức mới</CardTitle>
              <CardDescription>
                Tạo tổ chức &amp; tài khoản quản trị. Gói Miễn phí: 1 nick · 3 nhân
                viên · 500 khách.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="r-orgName">Tên tổ chức / shop</Label>
                  <Input id="r-orgName" name="orgName" required autoFocus />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r-fullName">Họ tên của bạn</Label>
                  <Input id="r-fullName" name="fullName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r-email">Email</Label>
                  <Input id="r-email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r-password">Mật khẩu</Label>
                  <Input
                    id="r-password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  Tạo tổ chức &amp; bắt đầu
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Đã có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="font-medium text-primary hover:underline"
                >
                  Đăng nhập
                </button>
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Thiết lập lần đầu</CardTitle>
              <CardDescription>
                Chưa có tài khoản nào — tạo tổ chức &amp; tài khoản quản trị.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSetup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Tên tổ chức / shop</Label>
                  <Input id="orgName" name="orgName" required autoFocus />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Họ tên của bạn</Label>
                  <Input id="fullName" name="fullName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  Tạo tài khoản &amp; bắt đầu
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
