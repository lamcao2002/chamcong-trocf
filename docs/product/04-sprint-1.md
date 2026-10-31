# Sprint 1 — Nền tảng và cấu hình

Oct 31, 2026 · @Lam Cao

Sprint 1 dựng nền tảng và toàn bộ phần cấu hình: sau **10 ngày làm việc**, quản trị viên đăng nhập được, tạo công ty "Cà phê Phố Nhỏ" với 5 vị trí, 6 ca, 2 địa điểm, ngày lễ và 8 nhân viên, và nhân viên đăng nhập được app.

- **Phạm vi:** 13 user story US01–US13 của [PRD MVP](https://claude.ai/artifact/5QrdHBtnhcZbjy8NXCVctB); màn A1, A6–A10, M1.
- **Khối lượng:** 22 việc, tổng khoảng 18 ngày công.
- **Giả định đội ngũ:** 2 lập trình viên full-stack — Dev A nghiêng backend, Dev B nghiêng giao diện. Nếu chỉ 1 người, sprint kéo dài khoảng 3,5 tuần.
- **Ngoài sprint:** xếp ca, chấm công, bộ tính ngày công (Sprint 2).

## Quyết định cần chốt trước ngày 1

Năm điểm sau chặn việc S1-01 đến S1-04; đề xuất dưới đây sẽ được dùng nếu không có ý kiến khác.

| Quyết định | Đề xuất | Lý do |
| --- | --- | --- |
| Nơi chạy | Vercel (web) + Supabase (PostgreSQL, vùng Singapore) | Ít vận hành, có gói miễn phí cho giai đoạn thử |
| Truy cập CSDL | Drizzle ORM + migration bằng drizzle-kit | Kiểu TypeScript chặt, SQL dễ đọc, migration nằm trong repo |
| Đăng nhập | Tự làm (PIN băm argon2, phiên lưu bảng `sessions`, cookie httpOnly) | Mô hình mã công ty + email + PIN không khớp sẵn với thư viện đăng nhập phổ biến |
| Repo | Một repo GitHub, một ứng dụng Next.js chứa cả `/app` và `/m` | Dùng chung API, kiểu dữ liệu và bộ tính ngày công |
| Tên miền | Tên miền tạm của Vercel trong Sprint 1; tên miền thật trước Sprint 4 | Không chặn tiến độ |

## Danh sách việc

22 việc, tổng 18 ngày công; cột Trạng thái là danh sách chọn để cập nhật hằng ngày

| ID | Việc | Story | Ước lượng (ngày) | Phụ thuộc | Người | Ngày | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1-01 | Tạo repo Next.js (App Router, TypeScript), Ant Design 5, ESLint, Prettier | — | 0,5 | — | Dev B | 1 | Chưa làm |
| S1-02 | Supabase dev + staging, Drizzle, biến môi trường | — | 0,5 | — | Dev A | 1 | Chưa làm |
| S1-03 | CI GitHub Actions: lint, kiểm kiểu, test, kiểm migration | — | 0,5 | S1-01 | Dev A | 1 | Chưa làm |
| S1-04 | Migration 21 bảng theo PRD + seed "Cà phê Phố Nhỏ" | — | 1,5 | S1-02 | Dev A | 2–3 | Chưa làm |
| S1-05 | Khung giao diện quản trị: menu trái ≥ 992 px, thanh dưới < 992 px, header gradient, design tokens | — | 1 | S1-01 | Dev B | 2 | Chưa làm |
| S1-06 | Component dùng chung: drawer form, thanh "N thay đổi chưa lưu", toast, hỏi xác nhận khi rời trang | — | 1 | S1-05 | Dev B | 3 | Chưa làm |
| S1-07 | API đăng nhập quản trị + app, PIN băm argon2, phiên cookie httpOnly, khoá 15 phút sau 5 lần sai | US01, US03, US04 | 1 | S1-04 | Dev A | 4 | Chưa làm |
| S1-08 | Middleware quyền 4 cấp, lọc `company_id`, lọc theo người được quản lý | US02 | 1 | S1-07 | Dev A | 5 | Chưa làm |
| S1-09 | Màn A1 đăng nhập quản trị | US01 | 0,5 | S1-06, S1-07 | Dev B | 4 | Chưa làm |
| S1-10 | Màn M1 đăng nhập nhân viên, đọc `?ma=`, PWA manifest cơ bản | US03 | 0,5 | S1-07 | Dev B | 4 | Chưa làm |
| S1-11 | Ghi `audit_logs` cho mọi endpoint ghi | — | 0,5 | S1-08 | Dev A | 5 | Chưa làm |
| S1-12 | API + màn thư viện ca: form ca, nhãn "Làm X giờ Y phút", ca qua đêm, mã bất biến | US05 | 1 | S1-08 | Dev A + B | 6 | Chưa làm |
| S1-13 | API + màn ngày lễ, nút thêm ngày lễ Việt Nam năm sau | US08 | 0,5 | S1-08 | Dev A | 6 | Chưa làm |
| S1-14 | API + màn A7 vị trí: kiểu ca, ca được làm, ngày, địa điểm, kiểu lương, hệ số OT | US06 | 1,5 | S1-12 | Dev A + B | 7 | Chưa làm |
| S1-15 | API + màn A9 địa điểm: Leaflet, lấy vị trí (trung bình 5 lần), bán kính 30–500 m, vị trí được chấm | US07 | 1,5 | S1-08 | Dev B | 6–7 | Chưa làm |
| S1-16 | API + màn A10 cài đặt: thông tin công ty, link cài app, quy tắc chấm công | US09, US10 | 1 | S1-06, S1-08 | Dev B | 5 | Chưa làm |
| S1-17 | API + màn A6 danh sách nhân sự, lọc trạng thái và vị trí | US11 | 0,5 | S1-08 | Dev B | 8 | Chưa làm |
| S1-18 | Drawer thêm/sửa nhân viên: kiểm tra trường, PIN tự sinh, cấu hình thừa hưởng, 3 công tắc ghi đè, quyền, đặt lại PIN | US11, US12 | 1,5 | S1-14, S1-17 | Dev A + B | 8 | Chưa làm |
| S1-19 | Trạng thái Đã nghỉ, chặn đăng nhập | US13 | 0,25 | S1-18 | Dev A | 8 | Chưa làm |
| S1-20 | Test API: đăng nhập, phân quyền, kiểm tra dữ liệu vào | US01–US13 | 1 | S1-19 | Dev A | 9 | Chưa làm |
| S1-21 | Nhập dữ liệu demo qua giao diện; thử M1 trên iPhone và Android | — | 0,5 | S1-19 | Dev B | 9 | Chưa làm |
| S1-22 | Triển khai staging, demo cuối sprint | — | 0,25 | S1-20, S1-21 | Dev A + B | 10 | Chưa làm |

## Thứ tự làm theo ngày

Đường găng là S1-02 → S1-04 → S1-07 → S1-08 → S1-12 → S1-14 → S1-18: trễ một việc trên đường này là trễ cả sprint.

1. **Ngày 1–3 — Nền:** Dev A dựng CSDL, CI, migration và dữ liệu mẫu (S1-02, S1-03, S1-04); Dev B dựng repo, khung giao diện và component dùng chung (S1-01, S1-05, S1-06).
2. **Ngày 4–5 — Đăng nhập và quyền:** Dev A làm API đăng nhập, phân quyền, nhật ký (S1-07, S1-08, S1-11); Dev B làm màn đăng nhập A1, M1 và màn Cài đặt (S1-09, S1-10, S1-16).
3. **Ngày 6–8 — Cấu hình và nhân sự:** ca, ngày lễ, vị trí, địa điểm, rồi nhân sự (S1-12 đến S1-19); hai người làm chung các màn có form lớn.
4. **Ngày 9 — Kiểm thử:** test API, nhập dữ liệu demo bằng tay, thử app trên điện thoại thật (S1-20, S1-21).
5. **Ngày 10 — Demo:** triển khai staging, demo, họp rút kinh nghiệm, nhận việc Sprint 2 (S1-22).

## Chi tiết kỹ thuật

Một ứng dụng Next.js, chia thư mục theo vai trò để Sprint 2 cắm bộ tính ngày công vào mà không đụng phần khác.

```
app/
  (admin)/app/...        trang quản trị A1–A10
  (employee)/m/...       app nhân viên M1–M4
  api/v1/...             route handler REST
lib/
  db/schema.ts           21 bảng Drizzle
  db/seed.ts             dữ liệu "Cà phê Phố Nhỏ"
  auth/                  PIN, phiên, quyền
  engine/                bộ tính ngày công (Sprint 2)
  validation/            schema zod dùng chung client + server
components/              drawer form, thanh chưa lưu, layout
drizzle/                 file migration
```

| Hạng mục | Lựa chọn |
| --- | --- |
| Giao diện | Next.js App Router, Ant Design 5 (ConfigProvider theo design tokens), font Be Vietnam Pro |
| Kiểm tra dữ liệu | zod, dùng chung cho form và API |
| Bản đồ | Leaflet + react-leaflet, tile OpenStreetMap |
| Ngày giờ | dayjs với plugin timezone, cố định Asia/Ho\_Chi\_Minh |
| Băm PIN | argon2 |
| Test | Vitest cho API và hàm thuần; Playwright để dành Sprint 3 |

**Dữ liệu mẫu (S1-04)** lấy đúng từ bản tham khảo: ca CA1, CA2, SANG, CHIEU, TOI, TV2; vị trí Quản lý ca (lương tháng 10–12 triệu, 3 bậc), Pha chế 28.000đ/giờ, Phục vụ 25.000đ/giờ, Thu ngân 7.000.000đ/tháng, Tạp vụ 60.000đ/công; địa điểm Quán Hoàn Kiếm và Quán Tây Hồ, bán kính 60 m; 8 nhân viên; 5 ngày lễ năm 2026.

## Định nghĩa hoàn thành và kịch bản demo

Sprint 1 chỉ đóng khi cả sáu điều kiện dưới đây đều đạt.

- [ ] 13 story US01–US13 đạt tiêu chí nghiệm thu trong PRD
- [ ] CI xanh: lint, kiểm kiểu, test API, migration chạy sạch trên CSDL trống
- [ ] Không API nào trả PIN gốc; mọi endpoint ghi có dòng `audit_logs`
- [ ] Giao diện dùng được ở 375 px và 1440 px
- [ ] Staging chạy được, có tài khoản demo cho người xem
- [ ] Rời trang khi có thay đổi chưa lưu luôn hỏi xác nhận

**Kịch bản demo (15 phút):**

1. Đăng nhập sai PIN 5 lần → thấy bị khoá 15 phút; đăng nhập đúng bằng tài khoản quản trị.
2. Tạo ca TOI 17:00–22:00, thấy nhãn "Làm 5 giờ"; tạo ca đêm 22:00–06:00, thấy nhận là qua đêm.
3. Tạo vị trí Phục vụ: linh hoạt, ca SANG/CHIEU/TOI, 25.000đ/giờ, cả hai quán.
4. Thêm địa điểm bằng "Lấy vị trí hiện tại" ngay tại phòng họp, chỉnh bán kính 60 m.
5. Thêm nhân viên Lê Ngọc Ánh vào vị trí Phục vụ; bật Lương riêng 27.000đ/giờ.
6. Mở link cài app trên điện thoại, đăng nhập bằng email + PIN của Ánh.
7. Chuyển Ánh sang Đã nghỉ → đăng nhập lại trên điện thoại bị từ chối.
8. Đăng nhập bằng tài khoản Quản lý nhóm → chỉ thấy người mình quản lý, không thấy số tiền lương.

## Rủi ro và cách xử lý

Rủi ro lớn nhất là migration 21 bảng làm sai rồi phải sửa giữa Sprint 2; vì vậy ngày 3 có buổi review schema bắt buộc.

| Rủi ro | Dấu hiệu | Xử lý |
| --- | --- | --- |
| Schema thiếu trường cho bộ tính ngày công | Sprint 2 phải đổi bảng `day_records`, `approvals` | Review schema ngày 3 đối chiếu với đặc tả bộ tính ngày công; migration chỉ thêm, không sửa cột cũ |
| Form vị trí và nhân sự lớn hơn dự kiến | S1-14 hoặc S1-18 chưa xong cuối ngày 8 | Cắt phần ghi đè Địa điểm riêng sang Sprint 2; giữ Lương riêng và Ca riêng |
| GPS trong nhà kém khi "Lấy vị trí hiện tại" | Toạ độ lệch > 50 m so với Google Maps | Luôn cho kéo ghim trên bản đồ; hiển thị độ chính xác của lần đo |
| Chỉ có 1 lập trình viên | Ngày 5 mới xong S1-07 | Kéo dài sprint thành 3,5 tuần, không cắt story bảo mật (US01, US02) |
| Chưa chốt nơi chạy | Ngày 1 chưa có CSDL | Chạy PostgreSQL bằng Docker trên máy, chuyển lên Supabase sau |
