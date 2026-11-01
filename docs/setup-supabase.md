# Thiết lập Supabase (dev + staging) — S1-02

Hai project Supabase riêng biệt, cùng region **Southeast Asia (Singapore) – ap-southeast-1** để độ trễ thấp từ Việt Nam.

| Môi trường | Supabase project | Dùng cho | Biến `APP_ENV` |
|---|---|---|---|
| local | (không cần) — `docker compose` | máy lập trình viên | `local` |
| dev | `chamcong-dev` | dùng chung khi cần dữ liệu thật hơn, thử migration | `local` |
| staging | `chamcong-staging` | Vercel Preview + QA, demo khách | `staging` |
| production | (Sprint 4) | khách thật | `production` |

## 1. Tạo project

1. supabase.com → **New project** → tên `chamcong-dev`, region **Singapore**, đặt mật khẩu DB mạnh (lưu vào trình quản lý mật khẩu của nhóm).
2. Lặp lại cho `chamcong-staging`.
3. Trong **Database → Settings**: đặt timezone mặc định không bắt buộc — ứng dụng tự đặt `TimeZone=Asia/Ho_Chi_Minh` cho mỗi kết nối và lưu thời điểm dạng `timestamptz` (UTC).

> Ta **không** dùng Supabase Auth, Storage hay Realtime ở Sprint 1 — chỉ PostgreSQL. Đăng nhập bằng PIN tự xây (S1-07).

## 2. Lấy chuỗi kết nối

**Project Settings → Database → Connection string**:

| Biến | Loại kết nối | Cổng | Dùng ở đâu |
|---|---|---|---|
| `DATABASE_URL` | **Transaction pooler** | 6543 | runtime Next.js / Vercel serverless (`prepare: false` đã bật trong `lib/db/client.ts`) |
| `DATABASE_URL_DIRECT` | **Session pooler** (hoặc Direct connection nếu có IPv6) | 5432 | `npm run db:migrate`, `drizzle-kit` |

Thay `[YOUR-PASSWORD]` trong chuỗi bằng mật khẩu DB. Nếu mật khẩu có ký tự đặc biệt (`@ : / ? #`), mã hoá URL trước.

## 3. Biến môi trường

| Biến | local | Vercel Preview (staging) | Vercel Production |
|---|---|---|---|
| `APP_ENV` | `local` | `staging` | `production` |
| `DATABASE_URL` | docker / dev pooler | staging pooler 6543 | (Sprint 4) |
| `DATABASE_URL_DIRECT` | trống / dev 5432 | staging 5432 | (Sprint 4) |
| `APP_TIMEZONE` | `Asia/Ho_Chi_Minh` | `Asia/Ho_Chi_Minh` | `Asia/Ho_Chi_Minh` |
| `CRON_SECRET` | trống | không cần, cron chỉ chạy trên Production | chuỗi ngẫu nhiên từ 16 ký tự |

Vercel: **Project → Settings → Environment Variables**, chọn đúng scope *Preview* / *Production*. Tạo secret: `openssl rand -base64 48`.

## 4. Chạy migration

```bash
# máy bạn
npm run db:generate      # sau khi sửa lib/db/schema.ts → sinh file SQL trong ./drizzle
npm run db:migrate       # áp dụng lên DATABASE_URL_DIRECT ?? DATABASE_URL

# staging (từ máy có quyền, hoặc job CI sau này)
DATABASE_URL_DIRECT="postgresql://...:5432/postgres" APP_ENV=staging DATABASE_URL="$DATABASE_URL_DIRECT" npm run db:migrate
```

Quy tắc: migration chỉ **thêm** (expand) trong một release; xoá cột/bảng ở release sau (contract). Không sửa file migration đã merge vào `main`.

## Nạp dữ liệu và tạo công ty

Script ghi dữ liệu tự nhận diện CSDL theo chuỗi kết nối, không tin `APP_ENV`. Với CSDL ngoài máy, lần chạy đầu sẽ dừng và in giá trị cần gõ vào `CONFIRM_DB`; đọc kỹ tên project trong đó trước khi chạy lại.

```bash
# Dữ liệu mẫu trên staging; production luôn bị chặn, CSDL đã có công ty khác cũng bị chặn
APP_ENV=staging SEED_PIN=<pin> CONFIRM_DB="<giá trị script in ra>" npm run db:seed

# Quán mới: tạo công ty và Quản trị viên đầu tiên. PIN tự sinh, chỉ in một lần
CONFIRM_DB="<giá trị script in ra>" npm run company:create -- \
  --ma=QUANA --ten="Cà phê A" --admin-ten="Nguyễn Văn A" --admin-email=a@quan.vn
```

Không ghi `CONFIRM_DB` vào `.env.local`: biến này chỉ có tác dụng khi gõ lại cho từng lần chạy.

## 5. GitHub Secrets (cho CI về sau)

Sprint 1 CI chỉ dùng PostgreSQL service tạm, **không cần secret**. Khi bật tự động migrate staging (Sprint 2+), thêm:

- `STAGING_DATABASE_URL_DIRECT`

## 6. Kiểm tra

```bash
npm run dev
curl http://localhost:3000/api/v1/health
# {"ok":true,"env":"local","db":"up","dbLatencyMs":3,"time":"..."}
```

`db: "down"` + HTTP 503 → sai chuỗi kết nối hoặc DB chưa chạy; HTTP 500 `not_configured` → thiếu/sai biến môi trường (xem log server).
