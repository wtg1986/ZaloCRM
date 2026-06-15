import type { NextConfig } from "next";

// Backend ZaloCRM (Fastify) chạy ở cổng 3000 khi dev. Proxy REST qua đây để
// frontend gọi same-origin (/api/...) — tránh CORS. Socket.IO nối thẳng tới
// BACKEND_URL (xem src/lib/socket.ts) vì CORS dev của backend = '*'.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
    ];
  },
  // Ảnh từ Zalo CDN + MinIO/S3 — cho phép hiển thị qua next/image nếu cần.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.zadn.vn" },
      { protocol: "https", hostname: "**.zdn.vn" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
};

export default nextConfig;
