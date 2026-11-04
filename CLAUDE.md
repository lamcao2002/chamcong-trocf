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
| `docs/product/08-should-have.md` | Danh sách việc SH-01…SH-38 sau MVP, thứ tự nhóm, quyết định đang để mặc định |
| `docs/product/07-sprint-4.md` | Danh sách việc S4-01…S4-21, công thức lương, 18 ca P01–P18, kế hoạch production |
| `docs/product/06-sprint-3.md` | Danh sách việc S3-01…S3-21, 13 quyết định đã chốt, luồng duyệt và đọc dữ liệu |
| `docs/product/05-sprint-2.md` | Danh sách việc S2-01…S2-22, 17 quyết định đã chốt, thiết kế tính lại ngày công |
| `docs/product/02-dac-ta-engine-ngay-cong.md` | Bộ tính ngày công (Sprint 2): bước A–F, bảng trạng thái, **66 ca kiểm thử T01–T66**, ký hiệu ô Bảng công, quyết định đã chốt |
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
| S1-07 API đăng nhập, phiên cookie, đăng xuất | Code xong, đã chạy thử trên PostgreSQL trống — khoá 15 phút làm ở S4-21 |
| S1-08 Phân quyền 4 cấp, lọc `company_id`, lọc người được quản lý | Code xong, đã chạy thử trên PostgreSQL trống |
| S1-09 Màn A1 đăng nhập quản trị, nút Đăng xuất | Code xong, đã thử trên Chrome 320–1440 px |
| S1-10 Màn M1, đọc `?ma=`, PWA manifest | Code xong, Chrome xác nhận cài được PWA — M2 còn là màn tạm, chưa thử cài trên điện thoại thật |
| S1-11 `audit_logs` mọi endpoint ghi | Code xong — `writeAudit` trong cùng transaction, không ghi PIN |
| S1-12 → S1-16 Ca, ngày lễ, vị trí, địa điểm, cài đặt | Code xong, đã chạy qua giao diện trên Chrome |
| S1-17 → S1-19 Nhân sự, drawer, Đã nghỉ | Code xong, đã chạy qua giao diện trên Chrome |
| S1-20 Test API | Code xong — `npm run test:api`, CI chạy trên build thật |
| S1-21 Nhập dữ liệu demo, thử M1 trên điện thoại | Mới chạy kịch bản demo trên Chrome giả lập; **chưa thử iPhone/Android thật** |
| S1-22 Triển khai staging, demo | Bản Vercel từ `main` chạy được, `/api/v1/health` báo `db: up`; chưa demo |

## Tiến độ Sprint 2

| Việc | Trạng thái |
|---|---|
| S2-01 Hạ tầng | Xong: Production chạy `sin1`, khoảng 3 ms mỗi truy vấn tới CSDL |
| S2-02 Chốt quyết định | Xong: 17 quyết định đã ghi vào đặc tả, thêm T51–T53 |
| S2-03 `employees.left_date` | Code xong, đã chạy trên PostgreSQL tạm — **chưa áp lên Supabase, phải migrate trước khi triển khai** |
| S2-04 → S2-08 Engine | Code xong trong `lib/engine/`: 53/53 ca chạy xanh, gồm áp đơn và duyệt |
| S2-09 Service tính lại | Code xong `lib/services/recompute.ts`, đã chạy trên PostgreSQL tạm |
| S2-10 Gắn tính lại | Code xong: lần chấm, lịch, ca, vị trí, nhân viên, ngày lễ, cài đặt |
| S2-11 Cron | Code xong; **cần đặt `CRON_SECRET` trên Vercel** |
| S2-12 → S2-14 Xếp ca | Code xong API và màn A4, đã thử trên Chrome 375 và 1440 px |
| S2-15 → S2-18 Chấm công | Code xong API và màn M2, đã thử trên Chrome giả lập GPS; **chưa thử điện thoại thật** |
| S2-19 Kiểm tra ngày công | Xong, màn tạm đã thay bằng Bảng công ở S3-13 |
| S2-20 Test API | Code xong: 163 test, gồm chạy song song, kỳ đã công bố, chặn trang theo quyền |
| S2-21 Thử điện thoại thật | **Chưa làm**, cần người thử tại quán, phiếu thử ở `docs/product/05-sprint-2.md` |
| S2-22 Triển khai, demo | Đã merge `main`; **chưa so với tính tay, chưa demo** |

Cập nhật bảng này khi xong một việc.

## Tiến độ Sprint 3

| Việc | Trạng thái |
|---|---|
| S3-01 Chốt quyết định | Xong: 13 quyết định đã ghi vào đặc tả, thêm T54–T59 và bảng ký hiệu ô |
| S3-02 Kỳ công | Code xong `lib/domain/period.ts` |
| S3-03 → S3-05 Duyệt, Hộp việc, 4 thẻ số | Code xong API; đọc ngày công chung qua `readDayRecords` |
| S3-06 → S3-08 Đơn, giải trình, quyết định đơn | Code xong API, đã chạy trên PostgreSQL tạm |
| S3-09 Thanh dưới, sheet Tạo đơn | Code xong, đã thử trên Chrome 375 px; tab Lương còn là màn tạm tới Sprint 4 |
| S3-10, S3-11 Màn A2 | Code xong: xem, lọc, duyệt, Điều chỉnh khác, duyệt và từ chối đơn |
| S3-12 → S3-14 Bảng công | Code xong lưới, drawer ngày, bảng công một người |
| S3-15 → S3-17 Màn M3 | Code xong lịch, lịch tháng, giải trình, Đơn của tôi; **chưa thử điện thoại thật** |
| S3-18 Hiệu năng lưới | 131 nhân viên × 31 ngày khoảng 155 ms trên máy; **chưa đo trên Vercel** |
| S3-19 Test | Code xong: test API, Playwright 3 luồng trong CI (`npm run test:e2e`) |
| S3-20 Dữ liệu thật | Mới mô phỏng một tuần trên PostgreSQL tạm; **chưa có dữ liệu thật tại quán** |
| S3-21 Triển khai, demo | Đã đẩy nhánh `feat/sprint-3`; **chưa merge, chưa demo** |

## Tiến độ Sprint 4

| Việc | Trạng thái |
|---|---|
| S4-01 Chốt quyết định | 19 quyết định đã ghi vào `docs/product/07-sprint-4.md`, thêm P15–P17 và S4-21; **chưa đối chiếu với bảng lương của quán** |
| S4-02 Bộ tính lương | Code xong `lib/payroll/compute-pay.ts`: 18/18 ca P01–P18, hàm thuần |
| S4-03 → S4-07 API lương | Code xong `/payroll`, `/adjustments`, `/payroll/publish`, `/app/payslips`; kỳ đã công bố dùng cờ `stale` thay cho 409 |
| S4-08 → S4-11 Màn A5 | Code xong tổng quan, danh sách, sao kê, thưởng/phạt, hộp công bố, báo cần công bố lại |
| S4-12 Màn M4 | Code xong danh sách kỳ và phiếu; **chưa thử điện thoại thật** |
| S4-13 Test | Code xong test API và Playwright luồng công bố |
| S4-21 Khoá PIN | Code xong: khoá theo tài khoản trong `lib/auth/login.ts`, phản hồi giống tài khoản không tồn tại, Đặt lại PIN mở khoá ngay |
| S4-14 Chuẩn bị production | Code xong `npm run company:create`, khoá ngày chốt sau kỳ công bố đầu tiên, chặn seed theo CSDL đích (`lib/db/target.ts`) |

## Tiến độ Should Have

| Việc | Trạng thái |
|---|---|
| SH-01 Thêm hàng loạt | Code xong `POST /employees/bulk`, bộ đọc `lib/domain/staff-import.ts`, đã thử trên Chrome 375 và 1440 px |
| SH-02 Gửi link cài app, QR | Code xong; tin nhắn chỉ kèm PIN ngay sau khi tạo hoặc đặt lại PIN; **chưa quét QR bằng điện thoại thật** |
| SH-03, SH-04 Xuất Excel | Code xong `/timesheet/export`, `/payroll/export`; kỳ đã công bố lấy bản chụp |
| SH-05 In phiếu | Code xong trang `/app/in-phieu`, in một người hoặc cả kỳ, mỗi người một tờ; **chưa in ra giấy thật** |
| SH-09, SH-10 Duyệt hàng loạt | Code xong `POST /approvals/bulk` (`lib/services/bulk-approval.ts`), chọn nhiều ở Hộp việc; đề xuất lấy lại từ server, số đổi thì bỏ qua và báo lại |
| SH-12 Duyệt loạt Bảng công | Code xong chế độ chọn ô, dùng chung API với Hộp việc |
| SH-13 Kỳ lệch, Tự chọn | Code xong `lib/domain/timesheet-view.ts`: chỉ đổi khoảng xem, tối đa 62 ngày; Excel, drawer một người và duyệt loạt đi theo khoảng đó |
| SH-14 Theo tuần | Code xong `?view=week`, `TimesheetWeek.tsx`; chưa thử điện thoại thật |
| SH-16 Thông báo | Code xong bảng `notifications`, `lib/services/notifications.ts`, chuông ở app nhân viên; chưa có web push |
| SH-17, SH-18 Đăng ký ca | Code xong: mỗi ô một đơn `shift_register`, lưới ở tab Lịch, nhận ở Xếp ca và Hộp việc; **chưa thử điện thoại thật** |
| SH-19 Đơn Muộn/sớm | Code xong, engine thêm T60–T66; miễn tính muộn, không đổi công |
| SH-20 Đơn Đổi ca | Code xong: duyệt thì sửa lịch hai ngày; đã có lần chấm thì chặn |
| SH-27, SH-28 Gắn thiết bị | Code xong `lib/services/device.ts`, mặc định tắt; gắn ở lần chấm đầu, chỉ chặn ở bước chấm; **chưa thử iPhone/Android thật, không bật cho quán trước khi thử** |
| SH-36 → SH-38 Nhiều vị trí, Theo ca, lịch nháp | Code xong: vị trí phụ, vị trí từng ca, lương theo vị trí của ca (P19–P21), nháp + Công bố/Bỏ nháp theo tuần, kiểu xem Theo ca; đã thử Chrome 375 và 1440 px. lương riêng từng vị trí; **cần áp migration `0005_positions_drafts` và `0006_extra_position_pay` trước khi deploy** |
| App nhân viên: tab Tôi, sheet Tạo đơn mới | Code xong: thanh dưới 4 tab + nút giữa, tab Tôi để trống; Đăng ký ca chọn trong sheet Tạo đơn (có ghi chú), bỏ thẻ ở tab Lịch; đã thử Chrome 320 và 375 px, **chưa thử điện thoại thật** |
| Sửa, xoá đơn; giờ mở đăng ký ca | Code xong: sửa/xoá đơn còn Chờ trong 10 phút, đăng ký ca chỉ gửi/bỏ trong 07:00 T5 – 07:00 T7; Đơn của tôi ở tab Tôi; **chưa thử điện thoại thật** |
| Đơn từ (lịch sử đơn cho quản lý) | Code xong `/app/don-tu`, `GET /requests`, `lib/services/request-history.ts`; đã thử Chrome 375 và 1440 px |
| Xoá nhân viên (ngoài danh sách SH) | Code xong `DELETE /employees/:id`, chỉ Quản trị viên, gõ lại email; xoá dữ liệu của người đó, giữ quyết định họ đã đưa cho người khác và bỏ tên |

## Lệnh

```bash
npm install && cp .env.example .env.local
npm run db:up        # Postgres docker
npm run dev
npm run check        # lint + typecheck + format + test — chạy trước khi commit
npm run test:api     # test API qua HTTP: cần app đang chạy với REGISTRATION_ALWAYS_OPEN=1, DATABASE_URL phải là localhost
npm run test:e2e     # Playwright trên app đang chạy; PW_CHANNEL=chrome để dùng Chrome của máy
npm run db:generate  # sau khi sửa lib/db/schema.ts, commit cả thư mục drizzle/
npm run db:migrate
npm run db:seed      # dữ liệu mẫu; staging cần SEED_PIN và CONFIRM_DB, production bị chặn
npm run company:create -- --ma=QUANA --ten="Cà phê A" --admin-ten="Nguyễn Văn A" --admin-email=a@quan.vn  # CSDL ngoài máy cần CONFIRM_DB
```

## Quy ước code

- `lib/db/client.ts` là `server-only`; client component không import DB
- Biến môi trường chỉ đọc qua `getServerEnv()` (`lib/env.ts`)
- Màu/bo góc lấy từ `lib/theme/tokens.ts`, không hardcode; CSS module dùng biến từ `themeCssVars()`
- Trang quản trị nằm trong `app/(admin)/app/(shell)/`, bọc bằng `AdminPage`; thêm mục menu ở `lib/navigation/admin.ts`
- Form sửa dùng `FormDrawer`, trang có nút lưu tổng dùng `UnsavedBar` (`components/common/`): cả hai đã tự chặn rời trang; toast dùng `useToast`
- Trong `(shell)` đã có `loading.tsx`: chặn quyền ở page chuyển hướng phía client (HTTP 200), chỉ phiên hết hạn ở layout mới trả 307
- Route API bọc `withAuth`, trang quản trị gọi `requireAdminPage` (`lib/auth/guard.ts`); truy vấn lọc bằng `scopeToCompany`/`scopeToStaff`, luật quyền ở `lib/auth/policy.ts`
- `@ant-design/cssinjs` ghim bản 1.x cùng `antd` 5: lên 2.x sẽ có hai bản, `AntdRegistry` mất CSS phía server và trang nháy form thô
- Service ở `lib/services/`: mọi truy vấn lọc `company_id`, ID từ client qua `assertOwned`, ghi kèm `writeAudit`; route chỉ parse rồi gọi service
- Mọi thao tác làm đổi ngày công gọi `recomputeDays` hoặc `recomputeOpenPeriod` trong cùng transaction; `day_records` là kết quả tính lại được, không ghi tay
- Mọi màn đọc ngày công đi qua `readDayRecords` (`lib/services/day.ts`), không đọc thẳng `day_records`; việc trong Hộp việc định danh bằng nhân viên × ngày × ca × cờ, không dùng `day_records.id`
- Tiền chỉ tính trong `lib/payroll/compute-pay.ts`; phiếu đã công bố đọc từ bản chụp `payslips`, không tính lại
- Excel và phiếu in lấy số qua `getPayrollDocument`; modal hiện PIN phải `destroyOnHidden`, nếu không PIN nằm lại trong DOM
- Duyệt hàng loạt không nhận quyết định từ client: chỉ nhận khoá việc và nhãn đã thấy, đề xuất lấy lại qua `getInbox`
- Kỳ lệch và Tự chọn chỉ là khoảng xem của Bảng công; Lương, Hộp việc và phiếu luôn theo `companies.cutoff_day`
- Thông báo ghi bằng `notify` trong cùng transaction với việc gây ra nó; đổi ô lịch đã công bố đi qua `writeCells`
- Lưu lịch từ ngày mai trở đi vào `schedule_drafts` (`lib/services/schedule-drafts.ts`); nhân viên, Bảng công, Lương chỉ đọc `schedule_cells`. Công bố/Bỏ nháp ở `schedule-publish.ts`
- Vị trí của nhân viên đọc qua `positionsOf` (`lib/services/staff-positions.ts`, vị trí chính đứng đầu); vị trí của ca qua `positionOfShift`, ca chưa ghi là vị trí chính
- Gắn thiết bị dùng cookie httpOnly `cc_device`, không dùng localStorage, không xoá khi đăng xuất; `device_hash` không bao giờ ra API hay `audit_logs`
- Thêm bảng có `employee_id` thì thêm vào `deleteEmployee` (`lib/services/employees.ts`) và `TABLES` của `tests/api/employee-delete.test.ts`
- Thêm endpoint mới thì thêm dòng vào `MATRIX` của `tests/api/permissions.test.ts`
- Hạn sửa đơn và giờ mở đăng ký ca tính bằng `editableUntil`, `registrationWindow` (`lib/domain/request-window.ts`); service đọc đợt qua `currentRegistrationWindow`. Test API cần `REGISTRATION_ALWAYS_OPEN=1`
- Form drawer dùng `useCrudDrawer`; trường không có ô nhập phải `useWatch` với `preserve: true`
- Validation dùng zod, chung cho form và API (`lib/validation/`)
- Migration chỉ thêm (expand); không sửa migration đã merge
- Viết test Vitest cạnh file (`*.test.ts`); engine phải có đủ T01–T66
- Văn bản giao diện tiếng Việt; số `1.234.567đ`, ngày `dd/mm/yyyy`
