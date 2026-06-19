# ─────────────────────────────────────────────────────────────────────────────
# Backend-only image — deploy tách (vd elest.io). Frontend deploy riêng (Vercel).
# Build context = ./backend (xem docker-compose.prod.yml).
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
# prisma generate chỉ cần schema (không connect) — dùng URL giả để qua validate.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate
RUN npm run build

# ── Stage 2: Production runtime ──────────────────────────────────────────────
FROM node:20-alpine
# tini = init (reap zombie), ffmpeg = xử lý video/thumbnail.
RUN apk add --no-cache tini ffmpeg curl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist             /app/dist
COPY --from=builder /app/node_modules     /app/node_modules
COPY --from=builder /app/prisma           /app/prisma
COPY --from=builder /app/prisma.config.ts /app/prisma.config.ts
COPY --from=builder /app/package.json     /app/package.json

RUN mkdir -p /var/lib/zalo-crm/files

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
# Đồng bộ schema vào DB rồi chạy server. Prisma đọc DATABASE_URL từ env.
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/app.js"]
