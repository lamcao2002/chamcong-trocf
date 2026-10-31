# chamcong-mvp

MVP chấm công · xếp ca · tính lương cho nhà hàng / quán cà phê.
Một repo Next.js phục vụ hai giao diện: **`/app`** (quản trị, desktop + mobile) và **`/m`** (app nhân viên, PWA).

Stack: Next.js 15 (App Router, TypeScript strict) · Ant Design 5 · Drizzle ORM · PostgreSQL (Supabase, Singapore) · Vercel · Vitest.

## Chạy lần đầu

Yêu cầu: Node 22 (`nvm use`), Docker.

```bash
npm install                 # lần đầu sẽ tạo package-lock.json → commit file này
cp .env.example .env.local
npm run db:up               # PostgreSQL 16 trong docker, cổng 5432
npm run db:migrate          # tạo 21 bảng
npm run db:seed             # công ty mẫu PHONHO, đăng nhập ha@phonho.vn, PIN 1234
npm run dev                 # http://localhost:3000 → chuyển tới /app
```

Kiểm tra kết nối: `curl http://localhost:3000/api/v1/health` → `{"ok":true,"db":"up",...}`.

Dùng Supabase thay docker: xem [docs/setup-supabase.md](docs/setup-supabase.md).

Tài liệu sản phẩm (PRD, Sprint, đặc tả engine) nằm trong `docs/product/`; bối cảnh cho Claude Code ở `CLAUDE.md`.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `lint:fix` | ESLint (next/core-web-vitals + typescript + prettier) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` / `format:check` | Prettier |
| `npm test` / `test:watch` | Vitest |
| `npm run check` | lint + typecheck + format + test (giống CI) |
| `npm run db:up` / `db:down` | bật/tắt PostgreSQL docker |
| `npm run db:generate` | sinh migration SQL từ `lib/db/schema.ts` vào `drizzle/` |
| `npm run db:migrate` | áp dụng migration |
| `npm run db:seed` | nạp dữ liệu mẫu "Cà phê Phố Nhỏ" (chạy lại không đổi gì) |
| `npm run db:check` / `db:studio` | kiểm tra migration / Drizzle Studio |

## Cấu trúc

```
app/
  (admin)/app/(shell)/  trang quản trị có menu → /app
  (employee)/m/       app nhân viên   → /m
  api/v1/health/      GET kiểm tra env + DB
  layout.tsx          font Be Vietnam Pro, AntdRegistry
  providers.tsx       ConfigProvider (vi_VN, theme từ token)
components/           UI dùng chung (admin/: khung quản trị; common/: drawer form, thanh chưa lưu, toast, chặn rời trang)
lib/
  env.ts              đọc & kiểm tra biến môi trường (zod)
  db/client.ts        kết nối postgres-js + drizzle (server-only)
  db/schema.ts        21 bảng dữ liệu
  db/seed.ts          dữ liệu mẫu (nội dung ở db/seed-data.ts)
  auth/pin.ts         băm và kiểm tra PIN (argon2)
  theme/tokens.ts     màu, bo góc, gradient header → theme AntD + biến CSS
  navigation/admin.ts menu quản trị theo quyền
scripts/migrate.ts    chạy migration
drizzle/              file migration sinh ra (commit vào git)
docs/                 hướng dẫn hạ tầng
.github/workflows/    CI
```

## CI (GitHub Actions)

Mỗi push vào `main` và mỗi PR:

1. **quality** — install → lint → typecheck → format:check → test → build
2. **db** — PostgreSQL 16 trống → `db:check` → `db:migrate` (2 lần, phải idempotent) → kiểm tra schema đã generate migration chưa

Khuyến nghị bật *Branch protection* cho `main`: bắt buộc 2 job trên xanh trước khi merge.

## Quy ước

- Thời điểm lưu `timestamptz` (UTC); ngày công tính theo `Asia/Ho_Chi_Minh`.
- Tiền lưu số nguyên VND (`bigint`), không dùng số thực.
- Tên cột `snake_case` (Drizzle `casing: 'snake_case'`).
- Không commit `.env*` (trừ `.env.example`).
