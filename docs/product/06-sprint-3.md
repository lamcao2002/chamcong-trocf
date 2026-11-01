# Sprint 3 — Duyệt, bảng công, đơn từ

Nov 1, 2026 · @Lam Cao

Sprint 3 khép vòng xử lý ngày công: sau **10 ngày làm việc**, nhân viên gửi được đơn và giải trình trên app, quản lý duyệt hết việc trong Hộp việc, và Bảng công hiện đúng cả tháng từ một tuần dữ liệu thật.

- **Phạm vi:** 11 user story US23–US33 của [PRD MVP](03-prd-mvp.md); màn A2, A3, M3 và sheet Tạo đơn.
- **Khối lượng:** 21 việc, tổng khoảng 17 ngày công.
- **Giả định đội ngũ:** 2 lập trình viên full-stack — Dev A nghiêng backend, Dev B nghiêng giao diện. Nếu chỉ 1 người, sprint kéo dài khoảng 3,5 tuần.
- **Ngoài sprint:** lương, phiếu lương M4 (Sprint 4); đơn Muộn/sớm, Đổi ca, Đăng ký ca; duyệt hàng loạt, phím tắt; Bảng công theo tuần, tự chọn kỳ, Excel (sau MVP).

## Hiện trạng đầu sprint

Code Sprint 2 đã hoàn thành và có bản Preview, nhưng sprint chưa đóng được; năm điểm dưới đây phải xử lý trước hoặc song song với ngày 1.

| Điểm | Hiện trạng | Xử lý |
| --- | --- | --- |
| Bản Preview bị khoá | Vercel Authentication chặn mọi người không đăng nhập Vercel, nên nhân viên không mở được trên điện thoại | Merge `feat/sprint2` vào `main`, hoặc tắt Deployment Protection cho Preview |
| Tốc độ thật | Bản đang công khai vẫn ở `iad1`, khoảng 212 ms mỗi truy vấn; chưa đo được `sin1` | Đo lại ngay sau khi có bản `sin1` mở được, đóng S2-01 |
| Thử tại quán | S2-21, S2-22 chưa làm: chưa thử điện thoại thật, chưa so ngày công với tính tay | Làm theo phiếu thử trong [Sprint 2](05-sprint-2.md) trước khi thu dữ liệu thật |
| Môi trường Vercel | `CRON_SECRET` chưa xác nhận đã đặt; cron chỉ chạy trên Production nên chưa có `vang`, `thieu_gio` tự động | Đặt biến và xác nhận cron chạy một đêm, Hộp việc phụ thuộc vào đây |
| Quán thử | PRD yêu cầu tìm quán trước Sprint 3, chưa có | Chốt trước ngày 1; không có quán thì demo bằng dữ liệu nhập tay |

## Quyết định đã chốt

Cả 13 điểm được chốt theo đề xuất dưới đây ngày 01/11/2026 và đã ghi vào [đặc tả](02-dac-ta-engine-ngay-cong.md#quyết-định-đã-chốt). Phần lớn là khoảng trống phát hiện khi đối chiếu PRD, đặc tả và code Sprint 2.

| # | Câu hỏi | Đề xuất | Ảnh hưởng |
| --- | --- | --- | --- |
| C1 | **Một ngày nhiều việc:** một dòng ngày công có thể có cả cờ GPS và OT, nhưng `approvals` chỉ cho một dòng hiệu lực mỗi nhân viên × ngày × ca | Duyệt lần sau gộp vào dòng đang có; Hoàn duyệt thu hồi cả dòng | US25, US28 |
| C2 | **14 trạng thái, 12 ký hiệu ô:** `ngoai_lich`, `chua_toi`, `dang_lam`, `nghi` chưa có ký hiệu | `ngoai_lich` dùng ô C; ba trạng thái còn lại là ô trống | US27 |
| C3 | **Ngày nhiều ca:** một ô lưới hiện gì | Ký hiệu cần xử lý nặng nhất, kèm số ca ở góc ô | US27 |
| C4 | **Trừ phép thế nào:** đặc tả ghi 1 ngày, nhưng ca ghép chỉ 0,5 công (T37) | Trừ theo công kỳ vọng của từng ngày có ca | US29 |
| C5 | **Người linh hoạt xin nghỉ ngày chưa có lịch:** engine không có ca nên không có công, mà vẫn trừ phép | Chỉ xin được ngày đã có ca, kể cả ca cố định; xếp lịch trước rồi xin | US29 |
| C6 | **Tự duyệt:** quản lý có được duyệt đơn và ngày công của chính mình không | Không, trừ khi công ty chỉ có một Quản trị viên | US33 |
| C7 | **Ai xử lý việc của người không có quản lý trực tiếp** | Quản trị viên và Nhân sự thấy toàn công ty; Quản lý nhóm chỉ thấy người của mình | US24, US33 |
| C8 | **Kỳ đã công bố:** duyệt hoặc sửa lịch trong kỳ đã công bố làm lệch phiếu lương | Trả 409 cho duyệt, đơn, lịch và ngày lễ; Sprint 4 mở lại qua "cần công bố lại" | US25, US28 |
| C9 | **Giải trình là việc riêng hay gắn vào ngày** | Gắn vào việc của ngày đó, hiện ở bằng chứng; gửi lại thì cập nhật, duyệt ngày thì giải trình đóng theo | US32 |
| C10 | **Đơn đã duyệt có sửa được không** | Không có hoàn duyệt đơn trong MVP; sai thì dùng Điều chỉnh khác ở drawer ngày | US33 |
| C11 | **"Chờ xử lý" đếm gì** | Mọi việc cần duyệt của kỳ hiện tại, gồm cả đơn chờ | US23 |
| C12 | **Kỳ của Hộp việc và Bảng công** | Một loại kỳ duy nhất theo `cutoff_day`; để trống là tròn tháng | US24, US27 |
| C13 | **Tha muộn ở đâu:** `muon` không vào Hộp việc nên không có lối vào | Tha ở drawer ngày của Bảng công | US26, US28 |

Điểm B2 của Sprint 2 (ca ghép đi làm 1 công, nghỉ phép 0,5 công) vẫn phải xác nhận bằng bảng lương thật; thử tại quán là cơ hội tốt nhất để làm việc này.

## Danh sách việc

21 việc, tổng 17,25 ngày công; cột Trạng thái cập nhật hằng ngày.

| ID | Việc | Story | Ước lượng (ngày) | Phụ thuộc | Người | Ngày | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S3-01 | Chốt 13 quyết định, cập nhật đặc tả, thêm ca kiểm thử mới | — | 0,25 | — | Dev A | 1 | Xong |
| S3-02 | Hàm kỳ công từ `cutoff_day`: kỳ chứa một ngày, kỳ trước/sau, biên cuối tháng | US24, US27 | 0,25 | S3-01 | Dev A | 1 | Chưa làm |
| S3-03 | API `POST /approvals`, `DELETE /approvals/:id`: gộp dòng duyệt, chặn tự duyệt và kỳ đã công bố, tính lại trong giao dịch | US25, US26, US28 | 1 | S3-01 | Dev A | 1–2 | Chưa làm |
| S3-04 | API `GET /inbox`: việc từ `day_records`, đơn chờ, giải trình, đếm theo loại, lọc người quản lý | US24, US33 | 1 | S3-02, S3-03 | Dev A | 2–3 | Chưa làm |
| S3-05 | API `GET /overview/today`: 4 thẻ số, tính tại chỗ theo `now` | US23 | 0,5 | S3-02 | Dev A | 3 | Chưa làm |
| S3-06 | API `POST`, `GET /app/requests`: kiểm tra từng loại đơn, tính phép còn lại, chặn vượt phép | US29–US31 | 1 | S3-01 | Dev B | 1 | Chưa làm |
| S3-07 | API `POST /app/explanations`: lý do từ 10 ký tự, gửi lại thì cập nhật | US32 | 0,25 | S3-01 | Dev B | 2 | Chưa làm |
| S3-08 | API `POST /requests/:id/decide`: duyệt, từ chối, quên chấm thêm lần chấm tổng hợp, tính lại | US30, US31, US33 | 1 | S3-03, S3-06 | Dev A | 4 | Chưa làm |
| S3-09 | Thanh dưới app nhân viên, nút "+", sheet Tạo đơn với 3 loại đơn | US29–US31 | 1,5 | S3-06 | Dev B | 2–3 | Chưa làm |
| S3-10 | Màn A2: 4 thẻ số, danh sách việc, chip lọc có đếm, chi tiết có thanh giờ và "Vì sao hệ thống đề xuất" | US23–US25 | 1,5 | S3-04, S3-05 | Dev B | 4–5 | Chưa làm |
| S3-11 | Duyệt theo đề xuất, tự sang việc kế, drawer Điều chỉnh khác, duyệt/từ chối đơn | US25, US26, US33 | 1 | S3-08, S3-10 | Dev B | 6 | Chưa làm |
| S3-12 | API `GET /timesheet`, `/timesheet/:employeeId`: lưới kỳ, cột tổng, ghép dữ liệu đã chốt với tính tại chỗ | US27, US28 | 1 | S3-02 | Dev A | 5 | Chưa làm |
| S3-13 | Màn A3: lưới tháng, 12 ký hiệu, cột tổng, tháng trước/sau, tìm tên, lọc vị trí; thay màn tạm | US27 | 1,5 | S3-12 | Dev A | 6–7 | Chưa làm |
| S3-14 | Drawer ngày (hệ thống tính, điều chỉnh, Hoàn duyệt) và bảng công một người | US28 | 1 | S3-03, S3-13 | Dev A | 8 | Chưa làm |
| S3-15 | API `GET /app/schedule`, `/app/timesheet` | M3 | 0,5 | S3-12 | Dev A | 6 | Chưa làm |
| S3-16 | Màn M3: lịch tuần này/tuần sau, lịch tháng có chấm màu, chi tiết ngày, gửi giải trình | US32 | 1,5 | S3-07, S3-15 | Dev B | 7–8 | Chưa làm |
| S3-17 | Đơn của tôi, trạng thái đơn, nháp giải trình lưu trên máy | US32, US33 | 0,5 | S3-16 | Dev B | 8 | Chưa làm |
| S3-18 | Đo và tối ưu lưới 120 nhân viên × 31 ngày trên staging | US27 | 0,25 | S3-13 | Dev A | 9 | Chưa làm |
| S3-19 | Test API, ma trận quyền, Playwright cho 3 luồng chính trong CI | US23–US33 | 1 | S3-14, S3-17 | Dev A | 9 | Chưa làm |
| S3-20 | Thu một tuần dữ liệu thật hoặc nhập tay, xử lý hết Hộp việc | — | 0,5 | S3-11, S3-17 | Dev B | 9 | Chưa làm |
| S3-21 | Triển khai staging, demo cuối sprint | — | 0,25 | S3-18, S3-19, S3-20 | Dev A + B | 10 | Chưa làm |

## Thứ tự làm theo ngày

Đường găng là S3-01 → S3-03 → S3-04 → S3-10 → S3-11 → S3-20 → S3-21: trễ một việc trên đường này là trễ cả sprint.

1. **Ngày 1–3 — Lõi dữ liệu:** Dev A làm kỳ công, API duyệt, Hộp việc, 4 thẻ số (S3-01 đến S3-05); Dev B làm API đơn, giải trình và sheet Tạo đơn (S3-06, S3-07, S3-09).
2. **Ngày 4–6 — Hộp việc:** Dev A làm quyết định đơn và API bảng công (S3-08, S3-12, S3-15); Dev B làm màn A2 và thao tác duyệt (S3-10, S3-11).
3. **Ngày 6–8 — Bảng công và M3:** Dev A làm lưới và các drawer (S3-13, S3-14); Dev B làm M3 và Đơn của tôi (S3-16, S3-17).
4. **Ngày 9 — Kiểm thử:** đo lưới, test API, Playwright, xử lý dữ liệu thật (S3-18 đến S3-20).
5. **Ngày 10 — Demo:** triển khai, demo, họp rút kinh nghiệm, nhận việc Sprint 4 (S3-21).

## Chi tiết kỹ thuật

Không thêm bảng mới; `approvals`, `requests`, `explanations` đã có từ Sprint 1 và engine đã áp đơn, duyệt từ Sprint 2. Sprint này chủ yếu làm phần ghi và phần đọc.

```
lib/
  domain/period.ts       kỳ công từ cutoff_day
  services/
    approvals.ts         gộp dòng duyệt, hoàn duyệt
    inbox.ts             danh sách việc, đếm chip, 4 thẻ số
    requests.ts          đơn, phép còn lại, quyết định đơn
    explanations.ts
    timesheet.ts         lưới kỳ, bảng công một người
  validation/
    approval.ts, request.ts, explanation.ts
components/
  admin/inbox/           A2
  admin/timesheet/       A3, thay DayCheckPanel
  employee/              thanh dưới, sheet Tạo đơn, M3
e2e/                     Playwright
```

**Khoá của một việc.** `recomputeDays` xoá rồi ghi nên `day_records.id` đổi sau mỗi lần tính lại. Hộp việc phải định danh việc bằng nhân viên × ngày × ca × loại cờ; dùng `id` thì quản lý đang mở việc sẽ duyệt vào dòng không còn tồn tại. Một dòng ngày công có thể sinh nhiều việc, mỗi đề xuất trong cột `suggestion` (mảng) là một việc; `vang` không có đề xuất nhưng vẫn là việc.

**Luồng duyệt.** Một giao dịch: khoá dòng `approvals` đang hiệu lực, gộp quyết định mới vào, `writeAudit`, gọi `recomputeDays` cho đúng ngày đó. Bảng dưới là cách quy mỗi hành động trong giao diện về trường của `approvals`.

| Hành động | Trường |
| --- | --- |
| Duyệt N phút / Không tính OT | `ot_minutes` = N / 0 |
| Duyệt vị trí | `approve_gps` |
| Xác nhận ca, Duyệt ca | `confirm_shift_id` |
| Duyệt 1 công (thiếu giờ) | `approve_missing` |
| Số công 1 / 0,5 / 0 | `cong_override`; "Theo hệ thống" là NULL |
| Tha muộn, tha sớm | `waive_late`, `waive_early` |

**Quyết định đơn.** `POST /requests/:id/decide` chỉ nhận đơn đang chờ, tính lại mọi ngày trong khoảng đơn. Payload phải khớp thứ engine đang đọc: nghỉ phép `{ leaveType }`, làm thêm `{ from, to }`; thêm cho quên chấm `{ shiftId, inTime, outTime }`, khi duyệt ghi lần chấm với `synthetic = true`, `source_request_id`, `in_zone = NULL`. Sprint 2 đọc mọi giải trình, nên phải bỏ giải trình đã từ chối khi nạp đầu vào.

**Dữ liệu đọc.** Hộp việc và Bảng công dùng cùng quy tắc với màn tạm: ngày cron đã chốt đọc `day_records`, 3 ngày gần nhất tính tại chỗ vì `chua_toi`, `dang_lam` đổi theo đồng hồ. Hiện `computeDayLive` chỉ nhận một ngày, cần mở rộng thành khoảng ngày để không truy vấn lặp. Cột tổng Công, Muộn, Thiếu, OT phải tính từ chính dòng hiện trong ô, để lưới và tổng không lệch nhau.

**4 thẻ số.** Đang trong ca x/y, Đi muộn hôm nay, Chưa chấm công, Chờ xử lý. "Chưa chấm công" là có ca, chưa có lần chấm, và đã quá giờ vào 15 phút; `chua_toi` không đủ để nhận ra vì giữ nguyên tới hết ca, nên phải so với giờ vào của ca.

**App nhân viên.**

- M3 dùng hash `/m#/lich` theo PRD, chuyển màn phía client nên không tải lại trang và không mất GPS.
- `apiRequest` hiện chưa có GET, thêm để M3 tải dữ liệu theo tháng.
- Thanh dưới có Chấm công, Lịch & công, nút "+", Lương; mục Lương là màn tạm tới Sprint 4.
- Nháp giải trình nằm trong `localStorage`, bọc try/catch vì Safari có thể chặn.

**Test.** Sprint 1 để dành Playwright cho sprint này. Đưa 3 luồng vào `e2e/` và chạy trong CI: quản lý xếp ca và nhân viên chấm công; duyệt hết một việc trong Hộp việc; gửi đơn quên chấm rồi duyệt. Script đã dùng để thử Sprint 2 có thể chuyển sang, gồm giả lập GPS.

## Định nghĩa hoàn thành và kịch bản demo

Sprint 3 chỉ đóng khi cả tám điều kiện dưới đây đều đạt.

- [ ] 11 story US23–US33 đạt tiêu chí nghiệm thu trong PRD
- [ ] 59/59 ca kiểm thử engine xanh trong CI
- [ ] CI xanh: lint, kiểm kiểu, test unit, test API, Playwright, migration chạy sạch trên CSDL trống
- [ ] Mọi endpoint ghi mới có `audit_logs`, lọc `company_id`, và có dòng trong `MATRIX`
- [ ] Hộp việc, Bảng công và màn M3 ra cùng con số cho cùng một ngày
- [ ] Lưới 120 nhân viên × 31 ngày tải dưới 1,5 giây trên staging
- [ ] Dùng được ở 375 px và 1440 px, nhân viên thao tác được trên iPhone và Android thật
- [ ] Một tuần dữ liệu được xử lý hết, Hộp việc về 0 việc

**Kịch bản demo (20 phút):**

1. Mở Hộp việc, xem 4 thẻ số hôm nay và các chip có đếm.
2. Chọn việc OT, đọc "Vì sao hệ thống đề xuất", bấm Duyệt → toast, việc biến mất, tự sang việc kế, số đếm giảm.
3. Mở việc thiếu giờ có giải trình, chọn Điều chỉnh khác, đặt 0,5 công, Lưu duyệt.
4. Nhân viên mở M3, thấy ngày công vừa đổi, gửi giải trình cho một ngày vắng; việc đó hiện lời giải trình ngay ở Hộp việc.
5. Nhân viên gửi đơn nghỉ phép vượt phép còn lại → không gửi được; giảm số ngày → gửi được.
6. Nhân viên gửi đơn quên chấm; quản lý duyệt → Bảng công đổi từ ô ! sang ô đủ công.
7. Nhân viên gửi đơn làm thêm; quản lý duyệt; ra ca muộn hơn khung đơn → phần trong đơn được duyệt sẵn, phần vượt chờ duyệt.
8. Từ chối một đơn kèm lý do → nhân viên thấy trạng thái trong app.
9. Mở Bảng công, tìm tên, lọc vị trí, bấm ô → drawer ngày, Hoàn duyệt → ngày trở về kết quả hệ thống.
10. Bấm tên → bảng công cả kỳ của người đó; đăng nhập Quản lý nhóm → chỉ thấy người của mình.
11. Xử lý nốt các việc cuối, Hộp việc về 0.

## Rủi ro và cách xử lý

Rủi ro lớn nhất là số trên ba màn lệch nhau khi có màn đọc `day_records`, có màn tính tại chỗ; vì vậy quy tắc đọc được gom về một service và có điều kiện riêng trong định nghĩa hoàn thành.

| Rủi ro | Dấu hiệu | Xử lý |
| --- | --- | --- |
| Hộp việc lệch Bảng công | Cùng ngày, hai màn báo khác trạng thái | Cả hai đọc qua một hàm; test API so trực tiếp hai endpoint |
| Lưới chậm vì tính tại chỗ | Tải quá 1,5 giây với 120 nhân viên | Chỉ tính tại chỗ 3 ngày gần nhất; cần thì đọc `day_records` rồi tính nền |
| Duyệt trùng khi hai quản lý cùng mở một việc | Quyết định sau ghi đè quyết định trước | Khoá dòng `approvals` trong giao dịch; việc đã đóng thì trả 409 và làm mới danh sách |
| Thiếu dữ liệu thật vì chưa có quán | Ngày 5 chưa có tuần dữ liệu nào | Nhập tay bằng đơn quên chấm và SQL trên staging; ghi rõ trong báo cáo demo |
| S2-21 phát hiện lỗi điện thoại | Sửa M2 chen vào tuần đầu | Ưu tiên lỗi chấm công trước, lùi S3-17 và phần tìm tên ở Bảng công |
| Phép còn lại tính sai | Số trên app khác sổ của quán | Thêm test phép cho ca ghép và đơn đang chờ; đối chiếu với quán trước demo |
| Nhiều thao tác ghi làm chậm thời gian phản hồi | Bấm Duyệt quá 1 giây | Chỉ tính lại đúng ngày liên quan; mỗi lần duyệt tốn khoảng 50 lượt đi về như lần chấm, nên cần `sin1` |
| Chỉ có 1 lập trình viên | Ngày 5 chưa xong S3-08 | Kéo dài sprint thành 3,5 tuần, cắt bảng công một người trước, không cắt story duyệt |
