# Audit Backend ZaloCRM — Giữ / Sửa / Thay?

> Mục tiêu: trả lời bằng **bằng chứng** câu hỏi "backend có giữ được không, hay phải viết lại?" — trước khi quyết định dựng frontend mới.
> Ngày: 07/06/2026. Phạm vi: đọc sâu engine Zalo + module chat/contacts + quét chỉ số nợ kỹ thuật toàn bộ `backend/src` (205 file, ~42.000 dòng).

---

## 0. Kết luận 1 dòng

> **GIỮ backend. Nợ ở đây là "tổ chức" (god-file + endpoint rác + phình scope), KHÔNG phải "mục ruỗng". Engine Zalo là tài sản quý — viết lại sẽ là sai lầm đắt giá. Dồn sức làm frontend mới; backend chỉ cần dọn ~1 tuần.**

Điểm sức khỏe backend: **7.5/10** — lõi tốt, lớp route cần sắp xếp lại.

---

## 1. Bằng chứng định lượng (toàn `backend/src`)

| Chỉ số | Con số | Đọc ra điều gì |
|---|---:|---|
| Tổng dòng / file | 42.081 / 205 | TB ~205 dòng/file — **lành** |
| `TODO/FIXME/HACK` | **14** | Rất thấp cho 42k dòng → code có kỷ luật |
| `@ts-ignore` / `@ts-expect-error` | **0** | Không giấu lỗi type — dấu hiệu tốt hiếm thấy |
| `console.*` còn sót | **5** | Gần như dùng `logger` đồng nhất |
| `eslint-disable` | **5** | Tối thiểu |
| `any` (ép kiểu lỏng) | **281** | ⚠️ Điểm yếu type — nhưng **dồn ở module `zalo`** do `zca-js` không có type |
| Test case / file | **358 / 30** | ✅ Có lưới an toàn thật, gồm test bảo mật (SQLi, SSRF, authz) |
| Endpoint one-off (backfill/migrate/admin) | **13** | 🔧 Rác cần đưa ra khỏi route production |

**Diễn giải:** một codebase "mục" thường có hàng trăm TODO, đầy `@ts-ignore`, không test. Backend này **ngược lại**: 0 ts-ignore, 14 TODO, 358 test. Đây là code **bảo trì được**.

---

## 2. Đánh giá từng phần — Giữ / Sửa / Thay

### 🟢 GIỮ NGUYÊN — tài sản lõi (đừng đụng)

**Engine Zalo** — `zalo-pool.ts`, `zalo-listener-factory.ts`, `zalo-message-sync.ts`, `zalo-rate-limiter.ts`, `shared/zalo-operations.ts`, `chat/message-handler.ts`
- `zalo-pool.ts` (512 dòng): quản lý nhiều nick, QR login, reconnect, **circuit breaker** (>5 disconnect/5phút → ngừng auto-reconnect, đòi QR), **restore nick archived** theo `zaloUid`, manual-disable chống auto-reconnect. Xử lý lỗi fire-and-forget cẩn thận. Bình luận giải thích "tại sao".
- `message-handler.ts` (822 dòng) tách thành nhiều hàm helper nhỏ (`mirrorInboundMediaContent`, `detectContentType`...) rồi 1 `handleIncomingMessage` — **cấu trúc tốt**, không phải khối hỗn độn.
- Đây là code reverse-engineer giao thức Zalo, **đã trả giá production** qua nhiều version (webchat type, cliMsgId cho undo, dedup msgId...). **Viết lại = đi lại toàn bộ vết đau.**

> Lưu ý: "dead code dòng 418-424" mà `Giai_thich.md` từng nêu **đã được dọn** — hiện là code xử lý tin thật. Plan đó đã thực thi xong.

**Hạ tầng dùng chung** — `shared/`: crypto (AES-GCM chuẩn), storage (S3/MinIO), redis, event-buffer, phone normalize. Gọn, đúng việc. Giữ.

**Tầng test** — 358 case. Giữ và mở rộng; đây là thứ cho phép refactor an toàn.

### 🟡 SỬA (tổ chức lại — không viết lại logic)

**God route files** — `contact-routes.ts` (1.620 dòng, **31 endpoint**), `chat-routes.ts` (1.085)
- `contact-routes.ts` trộn quá nhiều việc trong 1 file: contacts CRUD + stats + pipeline + duplicates + merge + **friends** PATCH + **conversations** ensure + parent-candidates + **admin/backfill**. → Tách theo concern: `contacts`, `friends`, `conversations`, `duplicates/merge` thành các file riêng. *Logic giữ nguyên, chỉ chẻ file.*
- Từng endpoint TB ~50 dòng — **bản thân endpoint ổn**; vấn đề là **gom quá nhiều vào 1 file**.

**13 endpoint one-off** (`backfill-*`, `migrate-*`, `run-detector`, `/admin/*`)
- Đây là script bảo trì chạy 1 lần bị để lại dưới dạng HTTP route → làm rối API + rủi ro bảo mật. → Chuyển sang `scripts/` (CLI) hoặc gộp vào 1 route `/admin` có guard rõ ràng.

**281 `any`**
- Phần lớn ở module `zalo` (SDK `zca-js` không có type) — **chấp nhận được, khó tránh**. → Tạo 1 file `zca-types.d.ts` khai báo type tối thiểu cho các hàm hay dùng (sendMessage, getUserInfo, login...) để giảm `any` ở ranh giới SDK. Không cần làm sạch 100%.

### 🔴 KHÔNG THAY, nhưng ẨN/HẠ scope (theo bản phân tích sản phẩm)

Các phân hệ chất lượng-code ổn nhưng **thừa nhu cầu** cho khách SMB: Lead Scoring (5 bảng), Automation Phase 7 (6 bảng), RBAC phòng ban, Privacy PIN. → **Giữ code, không phơi ra UI mặc định** (gói Pro/Enterprise). Xem [PHAN-TICH-CHIEN-LUOC-SAN-PHAM.md](PHAN-TICH-CHIEN-LUOC-SAN-PHAM.md).

---

## 3. API contract cho frontend mới — có sẵn xài được không?

**Có.** REST đã chuẩn hóa tốt:
- Prefix nhất quán: `/api/v1/...` (nội bộ) + `/api/public/...` (công khai).
- Auth đồng nhất: `app.addHook('preHandler', authMiddleware)` đầu mỗi route module; JWT.
- Real-time: Socket.IO với room `account:<id>`, event `zalo:qr|connected|disconnected|message|...` — frontend mới chỉ việc subscribe.
- Pattern phản hồi/serializer ổn (vd `friend-serializer.ts` làm "cuốn sổ chung").

**Frontend mới sẽ dùng ~60% endpoint; ~40% còn lại là admin/backfill/phase nâng cao** → bỏ qua lúc đầu, không ảnh hưởng.

→ **Kết luận: frontend mới gắn thẳng vào backend cũ được ngay, không cần đổi backend trước.**

---

## 4. Việc dọn backend đề xuất (~1 tuần, làm song song hoặc trước frontend)

| Ưu tiên | Việc | Effort | Lợi ích |
|---|---|---|---|
| P1 | Tách `contact-routes.ts` → contacts / friends / conversations / merge | 1–2 ngày | Dễ bảo trì hẳn, file < 400 dòng |
| P1 | Gỡ 13 endpoint one-off ra `scripts/` hoặc `/admin` có guard | 0.5 ngày | API sạch, bớt rủi ro |
| P2 | `zca-types.d.ts` cho SDK → giảm `any` ở ranh giới | 1 ngày | An toàn type chỗ hay gãy nhất |
| P2 | Tách `chat-routes.ts` tương tự | 1 ngày | Đồng bộ |
| P3 | Đánh dấu module Pro (scoring/automation/rbac/privacy) "không vào luồng chính" | 0.5 ngày | Chuẩn bị đóng gói |
| P3 | Bật flag tắt verbose `prisma:query` log ở dev | 5 phút | Log dev sạch |

> Lưu ý: backend dùng `NodeNext` → mọi import nội bộ phải có đuôi `.js`. Khi tách file nhớ giữ quy ước này (lỗi hay gặp nhất).

---

## 5. Quyết định cuối

```
                 ┌─────────────────────────────────────────────┐
   GIỮ (lõi)     │ Engine Zalo · shared · DB schema · 358 test  │  ← moat
                 ├─────────────────────────────────────────────┤
   SỬA (1 tuần)  │ Tách god-route · gỡ endpoint rác · type SDK  │
                 ├─────────────────────────────────────────────┤
   LÀM MỚI       │ TOÀN BỘ FRONTEND — IA 5 menu, UI/UX sạch     │  ← nơi đổ công
                 ├─────────────────────────────────────────────┤
   ẨN (Pro)      │ Scoring · Automation · RBAC sâu · Privacy    │
                 └─────────────────────────────────────────────┘
```

**Không viết mới backend.** Lý do gọn: nó *bảo trì được* (số liệu chứng minh), và phần khó nhất — engine Zalo — đúng là phần không nên đụng. Cái bạn thấy "khó bảo trì" thực ra **95% nằm ở frontend** (view 1.600 dòng) + cảm giác "code người khác". Làm frontend mới giải quyết cả hai, và 1 tuần dọn route là đủ để backend cũng sạch.

**Bước tiếp theo đề xuất:** chốt stack + thiết kế hệ design (màu, typography, component) cho frontend mới, rồi dựng khung IA 5 menu + 1 màn mẫu nối API thật.
</content>
