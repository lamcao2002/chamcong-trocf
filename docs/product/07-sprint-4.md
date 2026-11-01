# Sprint 4 — Lương và chạy thử

Nov 1, 2026 · @Lam Cao

Sprint 4 hoàn tất MVP: sau **10 ngày làm việc**, quản lý xem được sao kê từng người, thêm thưởng/phạt, công bố phiếu lương cho nhân viên xem trên app, và bản production chạy trên CSDL riêng có sao lưu.

- **Phạm vi:** 3 user story US34–US36 của [PRD MVP](03-prd-mvp.md); màn A5, M4; so lương với bảng tính tay; khoá PIN của US01; triển khai production.
- **Khối lượng:** 21 việc, tổng khoảng 16 ngày công.
- **Giả định đội ngũ:** 2 lập trình viên full-stack — Dev A nghiêng backend, Dev B nghiêng giao diện. Nếu chỉ 1 người, sprint kéo dài khoảng 3 tuần.
- **Ngoài sprint:** bậc lương, phụ cấp, phạt tự động, BHXH, in PDF, Excel, lịch sử công bố lại (sau MVP).

**Lịch thực tế dài hơn sprint.** MVP chỉ xong khi quán dùng trọn một kỳ tháng và lương khớp tính tay, mà kỳ đó dài khoảng 30 ngày. Code có thể xong trong 10 ngày, nhưng S4-18 chỉ đóng được sau ngày chốt của kỳ đầu tiên. Quán bắt đầu chấm công càng sát đầu kỳ thì MVP càng sớm xong.

## Hiện trạng đầu sprint

Code Sprint 3 đã merge vào `main` và chạy ở `sin1`, nhưng phần thử với người thật của hai sprint trước vẫn dở; lương không thể nghiệm thu nếu chưa có dữ liệu thật.

| Điểm | Hiện trạng | Xử lý |
| --- | --- | --- |
| Thử tại quán | S2-21, S2-22, S3-20, S3-21 chưa xong: chưa thử điện thoại thật, chưa so với tính tay, chưa demo | Làm trước hoặc song song ngày 1, theo phiếu thử trong [Sprint 2](05-sprint-2.md) |
| Quán thử | Chưa có; PRD yêu cầu trước Sprint 3 | Bắt buộc phải có, S4-18 không làm thay được |
| Bảng lương tính tay | Chưa có mẫu của quán, nên S4-01 chưa đóng; công thức hiện lấy từ bản gốc | Xin mẫu sớm nhất có thể, đối chiếu trước khi trả lương thật |
| CSDL Production | `docs/setup-supabase.md` để trống phần này; cần xác nhận bản đang chạy có dùng chung project với staging không | S4-15 tách project riêng, không chuyển dữ liệu thử sang |
| Khoá đã lộ | `CRON_SECRET` đang dùng từng hiện trong lịch sử hội thoại | S4-15 tạo khoá mới cho production |

## Quyết định đã chốt

Bốn điểm dưới đây do chủ sản phẩm chốt ngày 01/11/2026; riêng Q2 phải xác nhận bằng bảng lương của quán trước khi trả lương thật.

| # | Câu hỏi | Quyết định | Tác động |
| --- | --- | --- | --- |
| Q1 | Khoá 15 phút sau 5 lần sai PIN | **Làm trước khi lên production**, thay quyết định chưa làm ở S1-07 | Thêm S4-21 |
| Q2 | Ca ghép đi làm 1 công, nghỉ phép 0,5 công (B2) | Giữ theo đặc tả, xác nhận sau bằng bảng lương của quán | Lương tháng, lương công |
| Q3 | Lương giờ có trả ngày phép và ngày lễ không | Có: công của ngày × giờ chuẩn ca × đơn giá | Dòng riêng trên sao kê, P15, P16 |
| Q4 | Lương tháng có trần ở công chuẩn không | Không trần, theo bản gốc | P17 |

Mười lăm điểm tiếp theo được chốt theo đề xuất cùng ngày.

| # | Câu hỏi | Đề xuất | Ảnh hưởng |
| --- | --- | --- | --- |
| D1 | **Làm tròn tiền** | Giữ đơn giá chưa làm tròn trong tính toán; mỗi dòng sao kê làm tròn tới đồng; thực lĩnh là tổng các dòng đã làm tròn | Mọi dòng |
| D2 | **Giờ chuẩn cho đơn giá OT** | Giờ chuẩn của ca trên dòng ngày công | US34 |
| D3 | **OT dòng không gắn ca** (ngày nghỉ tuần): không có giờ chuẩn | Dùng giờ chuẩn của ca cố định; không có thì 8 giờ, để thành hằng số dễ đổi | T35 |
| D4 | **Đơn giá OT của lương công** | Đơn giá công ÷ giờ chuẩn ca; lương giờ dùng thẳng đơn giá giờ | US34 |
| D5 | **Ngày nghỉ tuần với lương giờ** | Phút làm trên dòng `off_day` chỉ trả qua OT đã duyệt, không cộng vào lương giờ, tránh trả hai lần | T35 |
| D6 | **Ngày lễ có đi làm** | Trả cả phần lương ngày và OT 300%, khớp T34 (1 công + OT) | T34 |
| D7 | **OT chờ duyệt, ca ngoài lịch chưa duyệt** | OT chờ không vào thực lĩnh; công tạm của ca ngoài lịch vẫn tính, người đó chưa "sẵn sàng" | US34 |
| D8 | **Sẵn sàng** | Không còn việc nào trong kỳ theo cùng quy tắc của Hộp việc | US34 |
| D9 | **Thực lĩnh âm** (phạt lớn hơn lương) | Giữ số âm, hiện cảnh báo, không tự chuyển sang kỳ sau | US35, US36 |
| D10 | **Sửa sau công bố:** quyết định C8 đang trả 409, trái US36 | Bỏ 409; sửa được và đặt `stale`, trang Lương báo "cần công bố lại" | US36 |
| D11 | **Công bố lại** | Thay bản chụp cũ, `audit_logs` giữ số trước đó; lịch sử cho nhân viên xem để sau MVP | US36 |
| D12 | **Công bố khi còn việc tồn** | Cho phép, hộp xác nhận nêu rõ số việc và OT chờ | US36 |
| D13 | **Đổi ngày chốt sau khi đã công bố:** kỳ mới sẽ chồng lên kỳ cũ | Chặn đổi khi đã có kỳ công bố; cần đổi thì xử lý tay | Cài đặt |
| D14 | **Thưởng/phạt của chính mình** | Theo C6: không tự thêm, trừ khi công ty chỉ có một Quản trị viên | US35 |
| D15 | **Nhân viên đã nghỉ giữa kỳ** | Vẫn có phiếu, tính tới `left_date` | US36 |

## Công thức lương

Quan sát từ bản gốc trong `docs/website-analysis/04-feature-specifications.md`; bộ tính lương là hàm thuần giống bộ tính ngày công, và số liệu dưới đây thành test.

| Khoản | Công thức | Ví dụ |
| --- | --- | --- |
| Lương tháng | mức ÷ công chuẩn × công | 11.000.000 ÷ 26 × 26 = 11.000.000đ |
| Lương giờ | phút làm ÷ 60 × đơn giá giờ | 79,35 giờ × 25.000 = 1.983.750đ |
| Lương công | đơn giá × công | 60.000 × 27 = 1.620.000đ |
| Ngày có công không có phút làm của lương giờ (phép, lễ, thiếu giờ được duyệt) | công của ngày × giờ chuẩn ca × đơn giá giờ | 1 × 7,5 × 25.000 = 187.500đ |
| Đơn giá giờ của lương tháng | mức ÷ công chuẩn ÷ giờ chuẩn ca | 10.000.000 ÷ 26 ÷ 7,5 = 51.282đ |
| OT | phút ÷ 60 × đơn giá giờ × hệ số | 90 phút × 51.282 × 150% = 115.385đ |
| Thực lĩnh | lương + OT đã duyệt + thưởng − phạt | 10.000.000 + 115.385 = 10.115.385đ |

Hệ số OT lấy theo `is_holiday`, `off_day` và thứ của ngày, vì `day_records` không lưu hệ số; ghi đè trong `pay_override` thắng vị trí, như engine đang làm.

**Bộ ca kiểm thử lương (S4-02):**

| ID | Kiểu | Dữ liệu vào | Kết quả mong đợi | Nguồn |
| --- | --- | --- | --- | --- |
| P01 | Tháng | 11.000.000, chuẩn 26, 26 công | 11.000.000đ | Gốc |
| P02 | Tháng + OT | 10.000.000, 26 công, OT 90 phút ngày thường, ca 7,5 giờ | 10.115.385đ | Gốc |
| P03 | OT chờ | P02 + 294 phút chờ (98, 100, 96) | Thực lĩnh giữ 10.115.385đ; dự phóng 10.492.308đ, +376.923đ | Gốc |
| P04 | Giờ | 25.000đ/giờ, 4.761 phút | 1.983.750đ | Gốc |
| P05 | Công | 60.000đ, 27 công | 1.620.000đ | Gốc |
| P06 | Thưởng, phạt | P01, thưởng 500.000, phạt 200.000 | 11.300.000đ | Đề xuất |
| P07 | Thiếu công | 7.000.000, chuẩn 26, 25,5 công | 6.865.385đ | Đề xuất |
| P08 | Ngày nghỉ tuần, lương giờ | 25.000đ/giờ, `off_day` 240 phút, OT duyệt 240 ở 200% | 200.000đ, không có lương giờ cho 240 phút | D5 |
| P09 | Ngày lễ | 10.000.000, chuẩn 26, ca 7,5 giờ, 1 công, OT 450 phút ở 300% | 384.615đ + 1.153.846đ | D6 |
| P10 | Thứ Bảy nghỉ để trống hệ số | OT 60 phút, hệ số ngày thường 150% | Tính 150% | Gốc |
| P11 | Ghi đè lương | Vị trí 25.000đ, `pay_override` 27.000đ/giờ, 60 phút | 27.000đ | Gốc |
| P12 | Thực lĩnh âm | 60.000đ, 1 công, phạt 100.000đ | −40.000đ, có cảnh báo | D9 |
| P13 | Không có ngày công | Vị trí tháng, 0 công | 0đ, vẫn có phiếu | Đề xuất |
| P14 | Làm tròn | Ba dòng có phần lẻ | Thực lĩnh bằng đúng tổng ba dòng đã làm tròn | D1 |
| P15 | Nghỉ phép, lương giờ | 25.000đ/giờ, ca 7,5 giờ, 1 ngày phép năm, 1 ngày nghỉ ốm | 187.500đ cho phép năm, 0đ cho nghỉ ốm | Q3 |
| P16 | Ngày lễ không đi làm, lương giờ | 25.000đ/giờ, ca 8 giờ, trạng thái `le`, 1 công | 200.000đ | Q3 |
| P17 | Vượt công chuẩn | 10.000.000, chuẩn 26, 28 công | 10.769.231đ | Q4 |
| P18 | Thiếu giờ được duyệt, lương giờ | 25.000đ/giờ, ca 5 giờ, 1 công, 0 phút làm | 125.000đ | Q3 |

## Danh sách việc

21 việc, tổng 16,25 ngày công; cột Trạng thái cập nhật hằng ngày.

| ID | Việc | Story | Ước lượng (ngày) | Phụ thuộc | Người | Ngày | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S4-01 | Chốt quyết định, đối chiếu công thức với bảng lương của quán, cập nhật tài liệu | US34 | 0,25 | — | Dev A | 1 | Đang làm |
| S4-02 | Hàm thuần `computePay` trong `lib/payroll/`, dòng có công thức chữ, ca P01–P18 | US34 | 1,5 | S4-01 | Dev A | 1–2 | Xong |
| S4-03 | API `GET /payroll`, `/payroll/:employeeId`: quỹ lương, sẵn sàng, OT chờ, sao kê, chỉ Nhân sự+ | US34 | 1 | S4-02 | Dev A | 3 | Xong |
| S4-04 | Thay 409 của kỳ đã công bố bằng `stale`; `recomputeDays` chỉ đặt `stale` khi số thật sự đổi | US36 | 0,75 | S4-01 | Dev A | 4 | Xong |
| S4-05 | API `POST`, `DELETE /adjustments`: số tiền > 0, lý do bắt buộc, chặn tự thêm | US35 | 0,5 | S4-01 | Dev B | 1 | Xong |
| S4-06 | API `POST /payroll/publish`: tạo kỳ, bản chụp bất biến, công bố lại trong một giao dịch | US36 | 1 | S4-03, S4-04 | Dev A | 5 | Xong |
| S4-07 | API `GET /app/payslips`, `/app/payslips/:periodKey`: chỉ phiếu đã công bố của chính mình | US36 | 0,25 | S4-06 | Dev A | 6 | Xong |
| S4-08 | Màn A5: thẻ kỳ, tiến độ x/N, thẻ phụ, danh sách nhân viên có chip lọc | US34 | 1,5 | S4-03 | Dev B | 4–5 | Xong |
| S4-09 | Sao kê "Vì sao ra số này", phần OT chờ với thực lĩnh dự phóng | US34 | 1 | S4-08 | Dev B | 6 | Xong |
| S4-10 | Modal thưởng/phạt, xoá khoản | US35 | 0,5 | S4-05, S4-09 | Dev B | 7 | Xong |
| S4-11 | Hộp xác nhận công bố, báo "cần công bố lại" | US36 | 0,5 | S4-06, S4-08 | Dev B | 7 | Xong |
| S4-12 | Màn M4: danh sách kỳ, phiếu đã công bố; thay màn tạm | US36 | 0,75 | S4-07 | Dev B | 8 | Xong |
| S4-13 | Test API, ma trận quyền, Playwright luồng công bố; test Lương khớp Bảng công | US34–US36 | 1 | S4-07 | Dev A | 6–7 | Xong |
| S4-14 | Script tạo công ty và Quản trị viên đầu tiên, chặn đổi ngày chốt, chặn seed nhầm | — | 0,5 | S4-01 | Dev A | 7 | Chưa làm |
| S4-15 | Project Supabase production, biến môi trường, tên miền, khoá mới, sổ tay triển khai | — | 0,5 | S4-14, S4-21 | Dev A | 8 | Chưa làm |
| S4-16 | Sao lưu hằng ngày giữ 30 ngày, thử khôi phục thật một lần | — | 0,75 | S4-15 | Dev A | 8–9 | Chưa làm |
| S4-17 | Giám sát: cảnh báo `/api/v1/health`, báo khi cron lỗi | — | 0,25 | S4-15 | Dev A | 9 | Chưa làm |
| S4-18 | Chạy một kỳ tại quán, so từng phiếu với bảng tính tay, ghi từng khoản lệch | — | 2 | S4-12, S4-15 | Dev A + B | 9–10, rồi tới ngày chốt | Chưa làm |
| S4-19 | Sửa lỗi phát hiện khi so; lỗi nào cũng thêm thành ca kiểm thử | — | 1 | S4-18 | Dev A + B | Sau S4-18 | Chưa làm |
| S4-21 | Khoá 15 phút sau 5 lần sai PIN, dùng cột sẵn có, không lộ tài khoản nào tồn tại, thử ở test API | US01 | 0,5 | S4-01 | Dev A | 7 | Chưa làm |
| S4-20 | Tài liệu một trang cho quản lý và nhân viên, demo công bố kỳ đầu tiên | — | 0,25 | S4-19 | Dev A + B | Sau S4-19 | Chưa làm |

## Thứ tự làm theo ngày

Đường găng là S4-01 → S4-02 → S4-03 → S4-06 → S4-07 → S4-12 → S4-18 → S4-19 → S4-20: trễ một việc trên đường này là trễ cả sprint.

1. **Ngày 1–3 — Bộ tính lương:** Dev A chốt công thức, viết hàm thuần và API lương (S4-01 đến S4-03); Dev B làm API thưởng/phạt (S4-05).
2. **Ngày 4–6 — Công bố:** Dev A làm cờ `stale`, công bố, API phiếu (S4-04, S4-06, S4-07); Dev B làm màn A5 và sao kê (S4-08, S4-09).
3. **Ngày 7–8 — Hoàn thiện:** Dev A làm test, khoá PIN, script tạo công ty, môi trường production (S4-13 đến S4-15, S4-21); Dev B làm thưởng/phạt, hộp công bố, M4 (S4-10 đến S4-12).
4. **Ngày 9–10 — Lên production:** sao lưu, giám sát, bắt đầu chạy kỳ thật (S4-16 đến S4-18).
5. **Sau ngày chốt của kỳ — Nghiệm thu:** so phiếu, sửa lỗi, công bố kỳ đầu tiên (S4-18 đến S4-20).

## Chi tiết kỹ thuật

Không thêm bảng mới; `adjustments`, `payroll_periods`, `payslips` đã có từ Sprint 1. Bộ tính lương tách khỏi CSDL như `lib/engine/`, để so được với bảng tính tay bằng test thuần.

```
lib/
  payroll/
    compute-pay.ts       computePay(input): dòng, thực lĩnh, OT chờ
    compute-pay.test.ts  P01–P18
  services/
    payroll.ts           quỹ lương, sao kê, công bố
    adjustments.ts
    payslips.ts          phiếu của nhân viên
  validation/payroll.ts
components/
  admin/payroll/         A5
  employee/PayslipTab.tsx  M4
scripts/create-company.ts
```

**Một nguồn số liệu.** Lương đọc qua `readDayRecords`, cùng hàm với Hộp việc và Bảng công, nên lỗi của bản gốc (OT đã duyệt ở Hộp việc nhưng Lương vẫn báo chờ) không xảy ra. Tính khi đọc, không lưu tiền cho tới lúc công bố.

**Dòng sao kê.** Mỗi dòng có `key`, `name`, `amount`, `how`. OT tách một dòng mỗi ngày, vd "30/10: 90p × 51.282đ/giờ × 150% (ngày thường)". Mỗi dòng làm tròn riêng nên tổng quỹ, sao kê và phiếu luôn khớp.

**Bản chụp phiếu.** Công bố lưu vào `payslips` các dòng, thực lĩnh, tổng hợp (công, muộn, thiếu, OT, giờ làm) và cả mức lương, tên vị trí lúc đó. Schema không lưu lịch sử cấu hình, nên sửa lương sau công bố không được làm đổi phiếu cũ. M4 chỉ đọc bản chụp, không tính lại.

**Cờ `stale`.** Đây là thay đổi kiến trúc lớn nhất của sprint. Hiện `assertNotPublished` trả 409 cho duyệt, đơn, lịch và ngày lễ, nhưng `recomputeDays` từ `/app/punch` và cron thì không kiểm tra gì: ngay sau khi công bố, cron vẫn có thể ghi lại 2 ngày cuối kỳ. Hướng xử lý: bỏ 409, và để `recomputeDays` so dòng cũ với dòng mới, chỉ đặt `stale = true` trên kỳ đã công bố khi số thật sự đổi. Cron chạy lại ra cùng kết quả thì không được báo sai. `recomputeOpenPeriod` giữ nguyên, không tự sửa kỳ đã công bố khi đổi cấu hình.

**Quyền.** A5 và API lương chỉ cho Nhân sự+; Quản lý nhóm không thấy tiền (US02). `/app/payslips` lọc theo chính nhân viên, kỳ chưa công bố trả 404.

**Tạo công ty thật.** Chưa có màn tạo công ty và `db:seed` bị chặn trên production, nên hiện không có cách nào tạo công ty đầu tiên. `scripts/create-company.ts` nhận mã, tên, email Quản trị viên, sinh PIN và in đúng một lần, ghi `audit_logs`.

**Production.**

| Hạng mục | Việc cần làm |
| --- | --- |
| CSDL | Project Supabase riêng ở Singapore, chạy migration, không seed |
| Vercel | Tách biến Production khỏi Preview; Preview tiếp tục dùng staging |
| Tên miền | Trỏ tên miền thật, kiểm tra PWA và GPS trên HTTPS |
| Sao lưu | PRD yêu cầu hằng ngày, giữ 30 ngày; kiểm tra gói Supabase có đáp ứng không, nếu không thì `pg_dump` hằng đêm ra kho riêng |
| Khôi phục | Khôi phục thử sang project trống, chạy `/api/v1/health` và đối chiếu số dòng |
| Điều khoản | Kiểm tra gói Vercel đang dùng có cho phép dùng cho khách thật không |

## Định nghĩa hoàn thành và kịch bản demo

Sprint 4 cũng là mốc hoàn thành MVP; các điều kiện dưới đây gồm cả định nghĩa hoàn thành của PRD.

- [ ] 3 story US34–US36 đạt tiêu chí nghiệm thu trong PRD
- [ ] 36/36 story đạt, gồm khoá PIN của US01
- [ ] 59/59 ca engine và 18/18 ca lương xanh trong CI
- [ ] Công ca ghép (Q2) đã xác nhận bằng bảng lương của quán
- [ ] Mọi endpoint ghi mới có `audit_logs`, lọc `company_id`, và có dòng trong `MATRIX`
- [ ] Một quán thật dùng đủ 1 kỳ; chênh lệch lương so với tính tay bằng 0đ hoặc giải thích được từng dòng
- [ ] Chạy ổn trên ít nhất 1 iPhone và 1 Android của nhân viên thật
- [ ] Production có sao lưu hằng ngày, đã thử khôi phục thành công một lần
- [ ] Không còn việc dở của Sprint 2 và 3 (S2-21, S2-22, S3-20, S3-21)

**Kịch bản demo (20 phút):**

1. Mở Lương, xem quỹ lương dự kiến, "x/N người sẵn sàng", OT đã và chờ duyệt, số việc tồn.
2. Mở sao kê một người lương tháng, đọc "Vì sao ra số này", đối chiếu từng dòng với bảng tính tay.
3. Xem phần OT chờ: thực lĩnh dự phóng nếu duyệt hết.
4. Sang Hộp việc duyệt OT, quay lại Lương → số tăng đúng khoản đó.
5. Thêm thưởng 500.000đ có lý do → thực lĩnh tăng; thử số tiền 0 hoặc thiếu lý do → bị chặn.
6. Bấm Công bố → hộp xác nhận nêu số phiếu, tổng tiền, việc tồn, OT chờ.
7. Nhân viên mở M4 trên điện thoại, xem phiếu và từng dòng.
8. Sửa công một ngày → trang Lương báo "cần công bố lại"; phiếu của nhân viên chưa đổi.
9. Công bố lại → phiếu đổi theo số mới, `audit_logs` giữ số cũ.
10. Đăng nhập Quản lý nhóm → không vào được Lương, không thấy số tiền.

## Rủi ro và cách xử lý

Rủi ro lớn nhất là trả sai tiền cho người thật: sai công thức nhỏ nhân lên cả quán và làm mất niềm tin ngay kỳ đầu. Vì vậy công thức được chốt với bảng tính của quán trước khi code, và kỳ đầu chạy song song với tính tay.

| Rủi ro | Dấu hiệu | Xử lý |
| --- | --- | --- |
| Công thức khác cách quán đang tính | Lệch ngay ở nhân viên đầu tiên | Xin bảng tính tay từ ngày 1; lệch nào cũng ghi thành quyết định và ca kiểm thử |
| Chưa có quán thử | Tới ngày 9 chưa có nơi chạy | Vẫn lên production; MVP chưa được tính là xong, báo rõ thay vì coi demo nhập tay là nghiệm thu |
| Sửa `stale` làm hỏng luồng đã ổn định | Test Sprint 3 đỏ, cron báo sai | Làm riêng một việc (S4-04), giữ nguyên toàn bộ test của C8 đổi sang kiểm tra cờ |
| Phiếu đã công bố bị đổi ngầm | Nhân viên thấy số khác lúc đầu | M4 chỉ đọc bản chụp; có test sửa dữ liệu rồi kiểm tra phiếu không đổi |
| Lộ PIN bằng dò thử trên production | Nhiều lần đăng nhập sai liên tiếp | S4-21 khoá tài khoản 15 phút; S4-15 phụ thuộc việc này nên không lên production khi chưa có |
| Mất dữ liệu | Sao lưu chạy nhưng không khôi phục được | Bắt buộc thử khôi phục thật ở S4-16 |
| Kỳ đầu tiên chưa tới ngày chốt khi hết sprint | Ngày 10 chưa có kỳ trọn vẹn | Tách mốc: code xong hết sprint, nghiệm thu MVP sau ngày chốt |
| Nhân viên mở phiếu người khác | Đoán `periodKey` hoặc ID | API chỉ lọc theo phiên, không nhận ID nhân viên; có test cách ly |
| Chỉ có 1 lập trình viên | Ngày 5 chưa xong S4-03 | Kéo dài thành 3 tuần, không cắt chạy song song với tính tay |
