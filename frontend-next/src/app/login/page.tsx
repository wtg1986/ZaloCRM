"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
    <main className="relative grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      {/* Bảng thương hiệu — chỉ desktop */}
      <aside className="relative hidden overflow-hidden bg-primary px-12 py-14 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-float-slow absolute -left-24 -top-24 size-96 rounded-full bg-white/15 blur-3xl" />
          <div className="animate-float-slow absolute -right-16 top-1/3 size-80 rounded-full bg-violet-300/25 blur-3xl [animation-delay:2s]" />
          <div className="animate-float-slow absolute -bottom-24 left-1/4 size-96 rounded-full bg-indigo-300/20 blur-3xl [animation-delay:4s]" />
          <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(currentColor_1px,transparent_1px)] bg-size-[22px_22px]" />
        </div>

        <div className="animate-fade-in-up relative flex items-center gap-2.5">
          <LogoMark className="size-9" />
          <span className="text-lg font-bold tracking-tight">ZaloCRM</span>
        </div>

        <div className="animate-fade-in-up stagger-2 relative max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-primary-foreground/90 ring-1 ring-white/15">
            <span className="animate-pulse-soft size-1.5 rounded-full bg-emerald-400" />
            CRM cho đội sale Zalo
          </span>
          <h2 className="mt-6 text-[2.6rem] font-bold leading-[1.08] tracking-tight">
            Quản lý mọi nick Zalo trên một màn hình.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-primary-foreground/75">
            Gom mọi cuộc chat, khách hàng và trợ lý AI về một nơi — đội sale không
            bỏ lỡ khách nào.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-primary-foreground/90">
            <Feature>Chat real-time đa tài khoản, không bỏ lỡ khách</Feature>
            <Feature>Trợ lý AI tự động trả lời theo kịch bản</Feature>
            <Feature>Khách hàng, nhãn &amp; phân quyền cho đội sale</Feature>
          </ul>
        </div>

        <p className="animate-fade-in-up stagger-4 relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} ZaloCRM — CRM cho đội sale Zalo
        </p>
      </aside>

      {/* Bảng form */}
      <section className="relative grid place-items-center overflow-hidden bg-muted/30 px-4 py-10">
        <div aria-hidden className="pointer-events-none absolute inset-0 lg:hidden">
          <div className="absolute -right-10 -top-20 size-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-10 size-72 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="relative w-full max-w-sm space-y-6">
          <div className="animate-fade-in-up flex flex-col items-center gap-3 text-center lg:hidden">
            <LogoMark className="size-12" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">ZaloCRM</h1>
              <p className="text-sm text-muted-foreground">
                Quản lý đa nick Zalo cho đội sale
              </p>
            </div>
          </div>

          <div className="animate-fade-in-up stagger-1">
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
        </div>
      </section>
    </main>
  );
}

function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-sm ring-1 ring-white/25",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-1/2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 5h16v11h-9l-5 4v-4H4z" fill="currentColor" fillOpacity="0.2" />
        <path d="M8 10h8M8 13h5" />
      </svg>
    </span>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 size-4 shrink-0 text-primary-foreground/90" />
      <span>{children}</span>
    </li>
  );
}
