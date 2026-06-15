# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trong repo này. Viết tiếng Việt cho dễ trao đổi với team.

## Dự án là gì

**ZaloCRM** — CRM quản lý tập trung nhiều tài khoản Zalo cá nhân trên 1 web UI. Chat real-time, gửi/nhận media qua object storage, Facebook Lead ingestion, AI assistant đa provider, automation (Bot-Auto), lead scoring, RBAC phòng ban, privacy PIN, analytics, PWA mobile.

Tự động hóa Zalo qua thư viện `zca-js` (MIT). Mục đích học tập / tự động hóa cá nhân — có thể vi phạm ToS của Zalo. Đây là fork độc lập, không liên kết với Zalo/VNG.

## Cấu trúc repo (monorepo 2 phần, KHÔNG có package.json gốc)

```
backend/    Node 20 · Fastify 5 · Prisma 7 · TypeScript 6 · Socket.IO · BullMQ
frontend/   Vue 3 · Vuetify 4 · Pinia · Vue Router · TipTap · Chart.js · Vite
docs/       Hướng dẫn người dùng, deploy, git workflow, phase reports
plans/      Sprint plans + conductor prompts
scripts/    Test/seed/backfill scripts (.mjs, .sh, .sql)
docker-compose.yml   Stack: app · db (PG16) · redis · minio · backup
```

## Lệnh thường dùng

### Backend (`cd backend`)
| Lệnh | Việc |
|---|---|
| `npm run dev` | Dev server (tsx watch, port 3000) |
| `npm run build` | `tsc` → `dist/` |
| `npm test` | Vitest run (toàn bộ) |
| `npm test -- <file>` | Chạy 1 file test |
| `npm run db:push` | Prisma `db push` (đồng bộ schema, không tạo migration) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Seed (`prisma/seed.ts`) |

### Frontend (`cd frontend`)
| Lệnh | Việc |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `vue-tsc -b && vite build` |

### Full stack (Docker)
```bash
docker compose up -d --build      # build + chạy toàn bộ. App ở :3080
docker compose logs -f app
```
Container entrypoint tự chạy `prisma db push --accept-data-loss` lúc start.

## Kiến trúc backend

- Entrypoint: [backend/src/app.ts](backend/src/app.ts) — bootstrap Fastify + Socket.IO, register toàn bộ routes, rồi khởi động **nhiều cron/worker nền** (health check Zalo, presence, friend-sync, scoring scheduler, automation engine, FB lead worker, labels sync…). Process được thiết kế **không bao giờ crash** (bắt `uncaughtException`/`unhandledRejection`).
- Tổ chức theo **module** trong [backend/src/modules/](backend/src/modules/): `zalo`, `chat`, `contacts`, `ai`, `automation` (blocks/sequences/triggers/broadcasts/lists), `scoring`, `rbac`, `privacy`, `integrations` (Facebook), `analytics`, `dashboard`, `engagement`, `notifications`, `search`, `api` (public REST + webhook), `auth`, `activity`, `branding`.
- [backend/src/shared/](backend/src/shared/): `zalo-pool` (quản lý connection pool zca-js per account), `crypto`, `storage` (MinIO/S3), `redis-client`, `event-buffer`, `phone`.
- Config tập trung: [backend/src/config/index.ts](backend/src/config/index.ts) — đọc env 1 lần lúc start. Production **fail-fast** nếu `JWT_SECRET`/`ENCRYPTION_KEY` thiếu hoặc < 32 ký tự.
- DB: **62 model Prisma** trong [backend/prisma/schema.prisma](backend/prisma/schema.prisma) (~2100 dòng), PostgreSQL 16.

### Pattern một route module
```ts
export async function xxxRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);   // hầu hết routes cần auth
  app.get('/api/v1/...', async (request) => { ... });
}
```
Rồi `await app.register(xxxRoutes)` trong [app.ts](backend/src/app.ts). API prefix chuẩn: `/api/v1/...`; API công khai: `/api/public/...`.

## Kiến trúc frontend

- Views: [frontend/src/views/](frontend/src/views/) (~23 view chính + subfolder `settings/`, `rbac/`, `privacy/`, `automation/`).
- Router: [frontend/src/router/index.ts](frontend/src/router/index.ts) — lazy import, `meta.requiresAuth`, `meta.layout`. Settings dùng layout 6-group sidebar lồng nhau.
- State: Pinia stores trong [frontend/src/stores/](frontend/src/stores/) (`auth`, `privacy`, `rbac`).
- Alias `@` → `frontend/src` (xem [frontend/vite.config.ts](frontend/vite.config.ts)).
- Real-time qua `socket.io-client`. API qua `axios` trong [frontend/src/api/](frontend/src/api/).

## Quy ước code QUAN TRỌNG

- **Backend dùng `NodeNext`** → mọi import nội bộ PHẢI có đuôi `.js` (kể cả file `.ts`): `import { x } from './foo.js'`. Đây là lỗi hay gặp nhất.
- TypeScript `strict: true` cả 2 phía.
- BigInt được patch `.toJSON()` ở đầu [app.ts](backend/src/app.ts) (Message.zaloMsgIdNum là BigInt).
- Comment trong code **viết được cả tiếng Việt** — match style file xung quanh (codebase trộn Việt/Anh, comment giải thích "tại sao" bằng tiếng Việt rất phổ biến).
- CHANGELOG.md viết tiếng Việt theo từng version; cập nhật khi release.

## Git workflow

- `origin` = `wtg1986/ZaloCRM` (fork này — push vào đây).
- `upstream` = `locphamnguyen/ZaloCRM` (gốc, **read-only**, KHÔNG push).
- Branch chính: `main`. Feature lớn → branch `feat/xxx` rồi merge.
- **KHÔNG commit `.env`** hay secret. **KHÔNG `push --force` lên main.**
- Chi tiết quy trình sync upstream / đóng góp ngược: [docs/HUONG-DAN-GIT-WORKFLOW.md](docs/HUONG-DAN-GIT-WORKFLOW.md).
- Commit/push chỉ khi user yêu cầu.

## Test

- Vitest ở [backend/tests/](backend/tests/) — gồm cả test bảo mật (SQLi, SSRF, authz, proxy auth). Chạy `npm test` trong `backend/` trước khi push thay đổi backend.
- Frontend chưa có test runner.

## Lưu ý vận hành

- Object storage (`S3_*`): dùng được MinIO / Amazon S3 / Cloudflare R2. `S3_PUBLIC_URL` phải là URL browser truy cập được thì ảnh/video mới hiển thị.
- AI provider mặc định: Anthropic (`AI_DEFAULT_MODEL=claude-sonnet-4-6`); hỗ trợ thêm OpenAI/Gemini/Qwen/Kimi. Khi đụng tới code AI, mặc định dùng model Claude mới nhất.
- Redis bắt buộc cho BullMQ (FB lead worker, form discovery) + event buffer.
- Nhiều cron chạy theo giờ VN (xem comment trong [app.ts](backend/src/app.ts)).
</content>
