# CLAUDE.md — bối cảnh dự án cho Claude Code

Đọc file này trước mỗi phiên. Trả lời người dùng bằng **tiếng Việt**.

## Dự án là gì

MVP app **chấm công · xếp ca · tính lương** cho một quán cà phê / nhà hàng 5–10 nhân viên.
Tham khảo sản phẩm E-HRM Pro (chamcong.worksheet.vn) — **không sao chép** asset, logo, văn bản có bản quyền.

- `/app` — trang quản trị (desktop + mobile, menu trái ≥ 992px, thanh dưới < 992px)
- `/m` — app nhân viên (PWA): chấm VÀO/RA CA có GPS, xem lịch, gửi đơn, xem phiếu lương

## Tài liệu nguồn (đọc khi cần, đừng đoán)

| File | Dùng khi |
|---|---|
| `docs/product/03-prd-mvp.md` | **Nguồn chính**: phạm vi, 14 màn hình, 36 user story + tiêu chí nghiệm thu, 21 bảng CSDL, 36 nhóm API, phi chức năng |
| `docs/product/04-sprint-1.md` | Danh sách việc S1-01…S1-22, thứ tự, định nghĩa hoàn thành |
| `docs/product/02-dac-ta-engine-ngay-cong.md` | Bộ tính ngày công (Sprint 2): bước A–F, bảng trạng thái, **50 ca kiểm thử T01–T50**, 9 câu hỏi mở |
| `docs/product/01-ke-hoach-mvp.md` | Kế hoạch 5 bước, 4 quyết định đã chốt |
| `docs/website-analysis/` | Phân tích sản phẩm gốc: UI tokens (05), data model (07), flows (06) |
| `docs/setup-supabase.md` | Hạ tầng dev/staging |

Ký hiệu trong tài liệu: **[Gốc]** = quan sát được trên bản gốc; **[Đề xuất]** = quyết định của ta. Khi code theo [Đề xuất] mà chưa chốt, để hằng số/cấu hình dễ đổi và ghi chú.

## Quyết định đã chốt

- Next.js 15 App Router + TypeScript strict, Ant Design 5, một repo cho cả `/app` và `/m`
- PostgreSQL trên Supabase (Singapore), **Drizzle ORM** + drizzle-kit; Vercel
- Đăng nhập tự xây: mã công ty + email + PIN 4 số, PIN băm **argon2**, bảng `sessions`, cookie httpOnly; khoá 15 phút sau 5 lần sai
- 4 quyền: app (nhân viên), manager (quản lý nhóm), hr (nhân sự), admin (quản trị) — mọi truy vấn lọc theo `company_id`
- Thời điểm `timestamptz` (UTC), ngày công theo `Asia/Ho_Chi_Minh`; tiền `bigint` VND; cột `snake_case`
- Mỗi endpoint ghi → một dòng `audit_logs`
- Bộ tính ngày công là **hàm thuần** (cùng đầu vào → cùng `DayRecord`), không đọc giờ hệ thống ngoài tham số `now`

## Tiến độ Sprint 1

| Việc | Trạng thái |
|---|---|
| S1-01 Repo, AntD theme, ESLint, Prettier | Code xong — chờ `npm install` + `npm run check` xác nhận |
| S1-02 Drizzle, env, docker Postgres, hướng dẫn Supabase, `/api/v1/health` | Code xong — chưa tạo project Supabase thật |
| S1-03 CI GitHub Actions | Code xong — chờ push lên GitHub để chạy lần đầu |
| S1-04 Migration 21 bảng + seed "Cà phê Phố Nhỏ" | Code xong, đã chạy thử trên PostgreSQL 16 trống — chưa áp lên Supabase, chờ review schema |
| S1-05 Khung giao diện quản trị | Code xong, đã thử trên Chrome 375–1440 px — người xem còn là `DEV_VIEWER`, S1-08 thay bằng phiên thật |
| S1-06 Drawer form, thanh chưa lưu, toast, hỏi khi rời trang | Code xong, đã thử trên Chrome 375–1440 px — chưa có màn thật nào dùng, chưa thử trên điện thoại thật |
| S1-07 API đăng nhập, phiên cookie, đăng xuất | Code xong, đã chạy thử trên PostgreSQL trống — **chưa làm khoá 15 phút sau 5 lần sai** theo yêu cầu; cột `failed_pin_attempts`, `locked_until` chưa dùng |
| S1-08 Phân quyền 4 cấp, lọc `company_id`, lọc người được quản lý | Code xong, đã chạy thử trên PostgreSQL trống — `/app/login` còn là trang tạm tới S1-09 |
| S1-09 … S1-22 | Chưa làm |

Cập nhật bảng này khi xong một việc.

## Lệnh

```bash
npm install && cp .env.example .env.local
npm run db:up        # Postgres docker
npm run dev
npm run check        # lint + typecheck + format + test — chạy trước khi commit
npm run db:generate  # sau khi sửa lib/db/schema.ts, commit cả thư mục drizzle/
npm run db:migrate
npm run db:seed      # dữ liệu mẫu; staging cần SEED_PIN, production bị chặn
```

## Quy ước code

- `lib/db/client.ts` là `server-only`; client component không import DB
- Biến môi trường chỉ đọc qua `getServerEnv()` (`lib/env.ts`)
- Màu/bo góc lấy từ `lib/theme/tokens.ts`, không hardcode; CSS module dùng biến từ `themeCssVars()`
- Trang quản trị nằm trong `app/(admin)/app/(shell)/`, bọc bằng `AdminPage`; thêm mục menu ở `lib/navigation/admin.ts`
- Form sửa dùng `FormDrawer`, trang có nút lưu tổng dùng `UnsavedBar` (`components/common/`): cả hai đã tự chặn rời trang; toast dùng `useToast`
- Route API bọc `withAuth`, trang quản trị gọi `requireAdminPage` (`lib/auth/guard.ts`); truy vấn lọc bằng `scopeToCompany`/`scopeToStaff`, luật quyền ở `lib/auth/policy.ts`
- Validation dùng zod, chung cho form và API (`lib/validation/`)
- Migration chỉ thêm (expand); không sửa migration đã merge
- Viết test Vitest cạnh file (`*.test.ts`); engine phải có đủ T01–T50
- Văn bản giao diện tiếng Việt; số `1.234.567đ`, ngày `dd/mm/yyyy`
