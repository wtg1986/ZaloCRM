"use client";

import { io, type Socket } from "socket.io-client";

// Socket.IO singleton — nối thẳng tới backend (CORS dev='*'). Join org room sau
// khi connect để nhận event realtime (chat:message, chat:typing, zalo:*).
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url =
      process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3000";
    socket = io(url, {
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socket;
}

/** Join phòng org để nhận event phạm vi tổ chức. Gọi sau khi biết orgId. */
export function joinOrg(orgId: string) {
  const s = getSocket();
  const emitJoin = () => s.emit("org:join", { orgId });
  if (s.connected) emitJoin();
  s.on("connect", emitJoin);
}

/** Subscribe room account:<id> để nhận QR + trạng thái đăng nhập nick. */
export function subscribeAccount(accountId: string) {
  const s = getSocket();
  const emit = () => s.emit("zalo:subscribe", { accountId });
  if (s.connected) emit();
  s.on("connect", emit);
}

export function unsubscribeAccount(accountId: string) {
  getSocket().emit("zalo:unsubscribe", { accountId });
}
