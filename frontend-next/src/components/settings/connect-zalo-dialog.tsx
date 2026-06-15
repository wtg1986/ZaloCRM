"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Smartphone, X } from "lucide-react";
import {
  createZaloAccount,
  loginZaloAccount,
} from "@/lib/resources";
import {
  getSocket,
  subscribeAccount,
  unsubscribeAccount,
} from "@/lib/socket";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Step = "form" | "qr" | "scanned" | "done";

export function ConnectZaloDialog({
  onClose,
  onConnected,
}: {
  onClose: () => void;
  onConnected: () => void;
}) {
  const [step, setStep] = React.useState<Step>("form");
  const [busy, setBusy] = React.useState(false);
  const [accountId, setAccountId] = React.useState<string | null>(null);
  const [qrImage, setQrImage] = React.useState<string | null>(null);
  const [expired, setExpired] = React.useState(false);
  const [scanned, setScanned] = React.useState<{
    displayName?: string;
    avatar?: string;
  } | null>(null);

  // Lắng nghe socket QR cho nick đang tạo.
  React.useEffect(() => {
    if (!accountId) return;
    const socket = getSocket();
    subscribeAccount(accountId);

    const onQr = (e: { accountId: string; qrImage: string }) => {
      if (e.accountId !== accountId) return;
      setQrImage(e.qrImage);
      setExpired(false);
      setStep("qr");
    };
    const onExpired = (e: { accountId: string }) => {
      if (e.accountId !== accountId) return;
      setExpired(true);
    };
    const onScanned = (e: {
      accountId: string;
      displayName?: string;
      avatar?: string;
    }) => {
      if (e.accountId !== accountId) return;
      setScanned({ displayName: e.displayName, avatar: e.avatar });
      setStep("scanned");
    };
    const onConnectedEvt = (e: { accountId: string }) => {
      if (e.accountId !== accountId) return;
      setStep("done");
      toast.success("Kết nối nick Zalo thành công");
      onConnected();
    };

    socket.on("zalo:qr", onQr);
    socket.on("zalo:qr-expired", onExpired);
    socket.on("zalo:scanned", onScanned);
    socket.on("zalo:connected", onConnectedEvt);
    return () => {
      socket.off("zalo:qr", onQr);
      socket.off("zalo:qr-expired", onExpired);
      socket.off("zalo:scanned", onScanned);
      socket.off("zalo:connected", onConnectedEvt);
      unsubscribeAccount(accountId);
    };
  }, [accountId, onConnected]);

  async function startConnect(form: FormData) {
    if (busy) return;
    setBusy(true);
    try {
      const acc = await createZaloAccount({
        displayName: String(form.get("displayName") || "").trim() || undefined,
        proxyUrl: String(form.get("proxyUrl") || "").trim() || undefined,
      });
      setAccountId(acc.id);
      setStep("qr");
      await loginZaloAccount(acc.id);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không tạo được nick");
      setStep("form");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-xl border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Kết nối nick Zalo</h2>
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
            aria-label="Đóng"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4">
          {step === "form" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void startConnect(new FormData(e.currentTarget));
              }}
              className="space-y-3"
            >
              <p className="text-sm text-muted-foreground">
                Đặt tên gợi nhớ cho nick rồi quét QR bằng app Zalo trên điện
                thoại.
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium">Tên nick</label>
                <input
                  name="displayName"
                  placeholder="VD: Sale 1 - Hương"
                  autoFocus
                  className="h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  Proxy <span className="text-muted-foreground">(tùy chọn)</span>
                </label>
                <input
                  name="proxyUrl"
                  placeholder="http://user:pass@host:port"
                  className="h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Tạo & quét QR
              </Button>
            </form>
          ) : step === "done" ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircle2 className="size-12 text-success" />
              <p className="font-medium">Đã kết nối!</p>
              <p className="text-sm text-muted-foreground">
                Nick Zalo đã sẵn sàng nhận & gửi tin.
              </p>
              <Button className="mt-2" onClick={onClose}>
                Xong
              </Button>
            </div>
          ) : step === "scanned" ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Avatar className="size-14">
                {scanned?.avatar ? (
                  <AvatarImage src={scanned.avatar} alt="" />
                ) : null}
                <AvatarFallback>
                  {(scanned?.displayName || "Z").slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="font-medium">{scanned?.displayName || "Đã quét QR"}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Xác nhận đăng nhập trên điện thoại…
              </p>
            </div>
          ) : (
            // step qr
            <div className="flex flex-col items-center gap-3 text-center">
              {qrImage ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${qrImage}`}
                    alt="QR đăng nhập Zalo"
                    className="size-56 rounded-lg border"
                  />
                  {expired ? (
                    <div className="absolute inset-0 grid place-items-center rounded-lg bg-background/80 text-sm font-medium">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="size-4 animate-spin" /> Đang tạo mã
                        mới…
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="grid size-56 place-items-center rounded-lg border">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <ol className="space-y-1 text-left text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Smartphone className="size-4" /> Mở app Zalo trên điện thoại
                </li>
                <li>2. Vào <b>Cài đặt → Quét mã QR</b></li>
                <li>3. Quét mã trên màn hình này</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
