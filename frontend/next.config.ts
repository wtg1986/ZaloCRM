import type { NextConfig } from "next";

// KIẾN TRÚC DEPLOY:
//  - DEV: proxy /api → backend local (same-origin, tránh CORS). FE gọi tương đối.
//  - PROD (Vercel): FE gọi THẲNG backend qua NEXT_PUBLIC_API_URL (xem src/lib/api.ts)
//    + WebSocket qua NEXT_PUBLIC_SOCKET_URL (xem src/lib/socket.ts). Backend bật
//    CORS cho domain Vercel. → rewrites bên dưới CHỈ phục vụ dev.
//  - KHÔNG dùng output:"export" (sẽ tắt rewrites + SSR). KHÔNG cần "standalone"
//    (chỉ cần khi self-host bằng Docker; Vercel chạy Next native).
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";
const STORAGE_HOST = process.env.NEXT_PUBLIC_STORAGE_HOST; // vd storage.yourdomain.com

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  { protocol: "https", hostname: "**.zadn.vn" },
  { protocol: "https", hostname: "**.zdn.vn" },
  { protocol: "http", hostname: "localhost" },
];
if (STORAGE_HOST) {
  remotePatterns.push({ protocol: "https", hostname: STORAGE_HOST });
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
    ];
  },
  images: { remotePatterns },
};

export default nextConfig;
