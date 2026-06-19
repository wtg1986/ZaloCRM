# Deploy Production — Frontend (Vercel) + Backend (Docker / elest.io)

Kiến trúc tách:

```
   Người dùng
       │  https://app.yourdomain.com  (Vercel)
       ▼
┌──────────────┐   REST  https://api.yourdomain.com/api/*   ┌────────────────────────────┐
│  Frontend    │ ───────────────────────────────────────►   │  Backend (Docker/elest.io) │
│  Next.js     │   WebSocket  wss://api.yourdomain.com       │  Fastify + Socket.IO       │
│  (Vercel)    │ ◄───────────────────────────────────────   │  + Postgres + Redis + MinIO │
└──────────────┘                                             └────────────────────────────┘
       │  ảnh/video  https://storage.yourdomain.com/<bucket>/<key>  (MinIO public)
       ▼
```

- Frontend gọi **thẳng** backend (`NEXT_PUBLIC_API_URL`) — backend bật **CORS** cho domain Vercel.
- WebSocket nối thẳng backend (`NEXT_PUBLIC_SOCKET_URL`).
- Ảnh/video tải từ **MinIO public** (`S3_PUBLIC_URL`) — Zalo CDN cũng fetch URL này.

---

## A. Backend trên elest.io (Docker Compose)

File dùng: [`docker-compose.prod.yml`](../docker-compose.prod.yml) + [`backend/Dockerfile`](../backend/Dockerfile).
Gồm: `backend` + `db` (Postgres) + `redis` + `minio` + `minio-init` + `backup`.

### 1. Chuẩn bị env
```bash
cp .env.production.example .env.production
# Sinh secret:
openssl rand -hex 32   # → JWT_SECRET
openssl rand -hex 32   # → ENCRYPTION_KEY
```
Điền trong `.env.production`:
- `JWT_SECRET`, `ENCRYPTION_KEY` (≥32 ký tự — không có sẽ fail-fast).
- `DB_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` (mạnh).
- `APP_URL=https://app.yourdomain.com` (domain Vercel — cho CORS; nhiều domain cách nhau dấu phẩy).
- `S3_PUBLIC_URL=https://storage.yourdomain.com` (domain public của MinIO).
- AI keys nếu dùng (`GEMINI_AUTH_TOKEN`…).

### 2. Deploy
**Cách elest.io (khuyến nghị):** tạo service kiểu **Docker Compose / CI-CD từ Git**, trỏ tới repo, chỉ định file `docker-compose.prod.yml` và đưa nội dung `.env.production` vào phần Environment của elest.io. elest.io tự build + chạy + cấp TLS.

**Hoặc chạy tay trên VPS:**
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml logs -f backend
```

### 3. Map domain (trên elest.io / reverse proxy)
- `api.yourdomain.com` → cổng **3000** (backend) — bật TLS.
- `storage.yourdomain.com` → cổng **9000** (minio) — bật TLS. (Bucket đã set anonymous **download**, keys là UUID ngẫu nhiên.)
- **KHÔNG** mở cổng **9001** (console MinIO) ra ngoài.

### 4. Tạo admin lần đầu
Vào `https://api.yourdomain.com` qua frontend → trang Setup tạo tổ chức + admin (DB tự `prisma db push` lúc container start).

---

## B. Frontend trên Vercel

Thư mục: [`frontend/`](../frontend) (Next.js, `output` mặc định — **không** dùng `export`/`standalone`).

1. **Import repo** vào Vercel → **Root Directory = `frontend`**.
2. **Environment Variables** (Production) — xem [`frontend/.env.production.example`](../frontend/.env.production.example):
   - `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`
   - `NEXT_PUBLIC_SOCKET_URL=https://api.yourdomain.com`
   - `NEXT_PUBLIC_STORAGE_HOST=storage.yourdomain.com`
3. Deploy → gán domain `app.yourdomain.com`.
4. Quay lại backend: đảm bảo `APP_URL` đúng domain vừa gán (nếu khác phải cập nhật + restart backend).

> Test nhánh preview Vercel (`*.vercel.app`): đặt `CORS_ALLOW_VERCEL_PREVIEW=true` ở backend.

---

## C. Dọn dẹp repo (khuyến nghị)

- **Frontend Vue cũ** `frontend-veu/` không còn dùng — gỡ khỏi git:
  ```bash
  git rm -r --cached frontend-veu && echo "frontend-veu/" >> .gitignore
  ```
- **Monolith cũ** `docker/Dockerfile` + service `app` trong `docker-compose.yml` (build gộp FE+BE) **không dùng cho kiến trúc tách** — giữ lại tham khảo hoặc xoá. Production dùng `docker-compose.prod.yml`.

---

## D. Local dev (không đổi)

- Hạ tầng: `docker compose -f docker-compose.dev.yml up -d` (chỉ Postgres) hoặc compose chính cho minio/redis.
- Backend: `cd backend && npx tsx watch --env-file=.env src/app.ts` (cổng 3000).
- Frontend: `cd frontend && npx next dev -p 3001` (proxy `/api` → :3000 qua rewrites; để trống `NEXT_PUBLIC_API_URL`).
