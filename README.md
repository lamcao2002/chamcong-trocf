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
npm run db:migrate          # Sprint 1 chưa có migration → báo "bỏ qua"
npm run dev                 # http://localhost:3000 → chuyển tới /app
```

Kiểm tra kết nối: `curl http://localhost:3000/api/v1/health` → `{"ok":true,"db":"up",...}`.

Dùng Supabase thay docker: xem [docs/setup-supabase.md](docs/setup-supabase.md).

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
| `npm run db:check` / `db:studio` | kiểm tra migration / Drizzle Studio |

## Cấu trúc

```
app/
  (admin)/app/        trang quản trị  → /app
  (employee)/m/       app nhân viên   → /m
  api/v1/health/      GET kiểm tra env + DB
  layout.tsx          font Be Vietnam Pro, AntdRegistry
  providers.tsx       ConfigProvider (vi_VN, theme từ token)
components/           UI dùng chung
lib/
  env.ts              đọc & kiểm tra biến môi trường (zod)
  db/client.ts        kết nối postgres-js + drizzle (server-only)
  db/schema.ts        bảng dữ liệu (S1-04)
  theme/tokens.ts     màu, bo góc, gradient header → theme AntD
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
