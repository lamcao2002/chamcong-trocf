# Sprint 2 — Lịch, chấm công, bộ tính ngày công

Nov 1, 2026 · @Lam Cao

Sprint 2 biến phần cấu hình thành ngày công thật: sau **10 ngày làm việc**, quản lý xếp được ca một tuần, 2 nhân viên chấm công bằng điện thoại ngay tại quán, và ngày công ra đúng theo đặc tả.

- **Phạm vi:** 9 user story US14–US22 của [PRD MVP](03-prd-mvp.md); màn A4, M2; bộ tính ngày công theo [đặc tả](02-dac-ta-engine-ngay-cong.md) với 53 ca kiểm thử (T01–T50 và 3 ca bổ sung).
- **Khối lượng:** 22 việc, tổng khoảng 18 ngày công.
- **Giả định đội ngũ:** 2 lập trình viên full-stack — Dev A nghiêng backend, Dev B nghiêng giao diện. Nếu chỉ 1 người, sprint kéo dài khoảng 3,5 tuần.
- **Ngoài sprint:** Hộp việc, Bảng công, M3, giao diện đơn từ và duyệt (Sprint 3); lương (Sprint 4); khoá 15 phút sau 5 lần sai PIN (đã quyết định chưa làm); chụp ảnh khi chấm, chấm offline, chép tuần, rải lịch (sau MVP).

## Hiện trạng đầu sprint

Sprint 1 đã lên `main`, CI xanh và bản Vercel kết nối được CSDL; ba điểm dưới đây còn dở và ảnh hưởng trực tiếp đến Sprint 2.

| Điểm | Hiện trạng | Xử lý |
| --- | --- | --- |
| Vùng chạy Vercel | Đang ở `iad1` (Mỹ), CSDL ở Singapore; mỗi truy vấn đo được khoảng **217 ms** | S2-01 chuyển sang `sin1`, nếu không sẽ không đạt yêu cầu VÀO CA dưới 1 giây |
| Điện thoại thật | Chưa thử cài PWA và GPS trên iPhone, Android (S1-21) | S2-21, phải xong trước demo tại quán |
| Môi trường Vercel | `APP_ENV=production` trong khi đây vẫn là bản thử | S2-01 đặt lại thành `staging` |

## Quyết định đã chốt

Cả 17 điểm được chốt theo đề xuất dưới đây ngày 01/11/2026 và đã ghi vào [đặc tả](02-dac-ta-engine-ngay-cong.md#quyết-định-đã-chốt); riêng B2 cần xác nhận bằng bảng lương thật của quán trước Sprint 4. Nhóm A là 9 câu hỏi mở của đặc tả, nhóm B là mâu thuẫn và khoảng trống phát hiện khi đối chiếu đặc tả với PRD và schema.

| # | Câu hỏi | Đề xuất | Ảnh hưởng |
| --- | --- | --- | --- |
| A1 | Cửa sổ ghép lần chấm | Vào sớm tối đa 120 phút, ra muộn tối đa 6 giờ | T32, `dang_lam` |
| A2 | Ca dưới bao nhiêu giờ thì công kỳ vọng là 0,5? | Chỉ ca bật `is_part`; Tạp vụ 2 giờ bật cờ này | Phép, lễ |
| A3 | Công theo giờ thực tế | Làm tròn 2 chữ số, trần 1 công | T42–T44 |
| A4 | Nghỉ ốm, không lương | 0 công, không trừ phép | T38 |
| A5 | Người linh hoạt làm ngày lễ | Chỉ OT hệ số 300%, không thêm công lễ | Lương |
| A6 | OT ngày nghỉ tuần, ngày lễ | Tính trên toàn bộ phút làm | T34, T35 |
| A7 | Muộn/sớm có bắt duyệt không? | Không, chỉ hiện ô M | Hộp việc |
| A8 | Ca 0 công vì về quá sớm (T07) | Không vào Hộp việc | Hộp việc |
| A9 | Phần vượt khung đơn làm thêm | Để chờ duyệt | T15 |
| B1 | **T30 trái Bước B mục 1:** lần ra 12:02 sau giờ vào CHIEU nên không thuộc SANG, trong khi T30 đòi cả hai ca `du` | Thêm luật: ca liền nhau, lần ra trong 15 phút sau mốc giao và ca trước chưa có lần ra thì thuộc ca trước | T30 |
| B2 | **Ca ghép:** đi làm được 1 công (T24, T29, T30) nhưng nghỉ phép chỉ 0,5 công (T37), hai ca ghép trong ngày ra 2 công | Giữ đúng đặc tả; xác nhận lại bằng bảng tính lương thật của quán | Lương tháng, lương công |
| B3 | **T49 tính tiền phạt** trong khi phạt nằm ngoài MVP và schema không có cột mức phạt | Engine nhận `penaltyPerMin` và trả tiền phạt để đạt 50/50; không lưu, không có giao diện, service truyền 0 | T49, US21 |
| B4 | **Ngày lễ có đi làm:** T34 có OT chờ duyệt, nhưng trạng thái `le` lại thay mọi trạng thái khác | `le`, `nghi_phep`, `nghi` chỉ dùng khi không có lần chấm; có chấm thì theo bảng ở Bước F | T34 |
| B5 | **Ngày nghỉ tuần:** T35 không ghi trạng thái và ca của dòng ngày công | `shift_id` để trống, trạng thái `ot_cho` | T35 |
| B6 | **Nhân viên Đã nghỉ:** Bước A coi là không có ca, nhưng `employees` không có ngày nghỉ, nên tính lại sẽ xoá công cũ, trái US13 | Thêm cột `left_date`; Bước A chỉ bỏ ca từ sau ngày đó (S2-03) | US13, US22 |
| B7 | **Chấm công khi GPS bị chặn** | Không cho chấm, hiện hướng dẫn bật quyền | US17 |
| B8 | **Tính trong vùng** | Khoảng cách ≤ bán kính, không cộng thêm sai số; lưu `accuracy_m` | US18 |

## Danh sách việc

22 việc, tổng 17,75 ngày công; cột Trạng thái cập nhật hằng ngày.

| ID | Việc | Story | Ước lượng (ngày) | Phụ thuộc | Người | Ngày | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S2-01 | Hạ tầng: `vercel.json` vùng `sin1`, `APP_ENV=staging`, `loading.tsx` cho `(shell)` và `/m`, đo lại tốc độ | — | 0,5 | — | Dev A | 1 | Xong |
| S2-02 | Chốt 17 quyết định, cập nhật đặc tả, thêm luật mới vào bộ ca kiểm thử | US21 | 0,25 | — | Dev A | 1 | Xong |
| S2-03 | Migration `employees.left_date`, đặt ngày khi chuyển Đã nghỉ, cho dữ liệu cũ một giá trị mặc định | US13, US22 | 0,25 | S2-02 | Dev A | 1 | Xong |
| S2-04 | Kiểu đầu vào/đầu ra của engine, dữ liệu mẫu, khung test T01–T53 (đang đỏ) | US21 | 0,5 | S2-02 | Dev A | 2 | Xong |
| S2-05 | Bước A + B: ca kỳ vọng, ghép lần chấm, chấm trùng, ca liền nhau, ca đêm, ngoài lịch | US21 | 1,5 | S2-04 | Dev A | 2–3 | Xong |
| S2-06 | Bước C + D: phút làm, công theo 3 cách tính, muộn, về sớm | US21 | 1 | S2-05 | Dev A | 4 | Xong |
| S2-07 | Bước E + F: OT, trạng thái, cờ, đề xuất, câu "Vì sao hệ thống đề xuất" | US21 | 1 | S2-06 | Dev A | 5 | Xong |
| S2-08 | Áp đơn và duyệt: phép, quên chấm, làm thêm, tha muộn, công ghi đè, hoàn duyệt | US21 | 0,75 | S2-07 | Dev A | 6 | Xong |
| S2-09 | Service tính lại: đọc đầu vào, khoá theo nhân viên, xoá rồi ghi `day_records` trong một giao dịch | US22 | 1,5 | S2-08 | Dev A | 6–7 | Xong |
| S2-10 | Gắn tính lại vào `/app/punch`, `PUT /schedule` và mọi nơi sửa ca, vị trí, nhân viên, ngày lễ, cài đặt | US22 | 0,75 | S2-09, S2-12, S2-16 | Dev A | 8 | Xong |
| S2-11 | Cron hằng ngày chốt các ngày đã qua để có `vang`, `thieu_gio` | US22 | 0,5 | S2-09 | Dev A | 8 | Xong |
| S2-12 | API `GET /schedule?week=`, `PUT /schedule`: lọc người được quản lý, kiểm tra ca thuộc công ty, ẩn người Đã nghỉ | US14–US16 | 1 | S2-02 | Dev B | 1–2 | Xong |
| S2-13 | Màn A4: điều hướng tuần, dải 7 ô, ca cố định viền đứt, drawer chọn ca theo ngày | US14 | 1,5 | S2-12 | Dev B | 2–3 | Xong |
| S2-14 | Ô đổi chấm cam, thanh "N ô chưa lưu · ↶ · Lưu", Cho nghỉ | US15, US16 | 0,5 | S2-13 | Dev B | 4 | Xong |
| S2-15 | API `GET /app/home`: ca hôm nay, ca được chọn, địa điểm, trạng thái đang trong ca | US17, US20 | 0,75 | S2-05 | Dev B | 4–5 | Xong |
| S2-16 | API `POST /app/punch`: giờ server, tính trong vùng, chọn địa điểm gần nhất, ghi `attendance_logs` | US18, US19 | 1 | S2-15 | Dev B | 5–6 | Xong |
| S2-17 | Màn M2: ca hôm nay, trạng thái GPS, nút VÀO/RA CA, thẻ kết quả | US17–US19 | 1,5 | S2-16 | Dev B | 6–7 | Xong |
| S2-18 | Chip chọn ca, dòng thời gian hôm nay, hướng dẫn bật quyền cho iPhone/Android | US17, US20 | 0,5 | S2-17 | Dev B | 8 | Xong |
| S2-19 | `GET /day/:employeeId/:date` và màn tạm tại `/app/bang-cong`: bảng `day_records` theo ngày, chỉ đọc | US22 | 0,5 | S2-09 | Dev B | 8 | Xong |
| S2-20 | Test API: lịch, chấm công, tính lại, ma trận quyền; thêm endpoint mới vào `MATRIX` | US14–US22 | 1 | S2-10, S2-11 | Dev A | 9 | Xong |
| S2-21 | Thử M2 trên iPhone và Android thật tại quán: cài PWA, GPS trong nhà, chặn quyền | US17–US20 | 0,5 | S2-18 | Dev B | 9 | Đang làm |
| S2-22 | Triển khai staging, so ngày công với tính tay, demo cuối sprint | — | 0,5 | S2-19, S2-20, S2-21 | Dev A + B | 10 | Đang làm |

## Thứ tự làm theo ngày

Đường găng là S2-02 → S2-04 → S2-05 → S2-06 → S2-07 → S2-08 → S2-09 → S2-10 → S2-20: trễ một việc trên đường này là trễ cả sprint.

1. **Ngày 1 — Dọn đường:** chốt quyết định, sửa hạ tầng, thêm `left_date` (S2-01 đến S2-03); Dev B bắt đầu API lịch (S2-12).
2. **Ngày 2–5 — Engine và màn lịch:** Dev A viết engine theo từng nhóm test (S2-04 đến S2-07); Dev B hoàn thành A4 rồi làm API `/app/home` (S2-13 đến S2-15).
3. **Ngày 6–7 — Nối dữ liệu:** Dev A làm phần áp đơn, duyệt và service tính lại (S2-08, S2-09); Dev B làm API chấm và M2 (S2-16, S2-17). Lúc này chấm công mới ghi log; thẻ kết quả hoàn chỉnh sau S2-10.
4. **Ngày 8 — Khép vòng:** gắn tính lại vào mọi đường ghi, thêm cron, hoàn thiện M2 và màn kiểm tra (S2-10, S2-11, S2-18, S2-19).
5. **Ngày 9 — Kiểm thử:** test API, thử điện thoại thật tại quán (S2-20, S2-21).
6. **Ngày 10 — Demo:** so số với tính tay, demo, họp rút kinh nghiệm, nhận việc Sprint 3 (S2-22).

## Chi tiết kỹ thuật

Engine là hàm thuần trong `lib/engine/`, không import CSDL và không đọc đồng hồ; mọi phần chạm CSDL nằm ở `lib/services/`.

```
lib/
  engine/
    types.ts             đầu vào, DayRecord
    expected-shifts.ts   Bước A, dùng chung với /app/home và A4
    match-punches.ts     Bước B
    compute-day.ts       Bước C–F và áp duyệt, hàm computeDay(input, now)
    cases.test.ts        T01–T53, mỗi dòng một test
  domain/geo.ts          thêm khoảng cách và kiểm tra trong vùng
  services/
    recompute.ts         recomputeDays(tx, employeeIds, dateRange)
    schedule.ts
    attendance.ts
app/
  (admin)/app/(shell)/xep-ca/page.tsx
  (employee)/m/page.tsx
  api/v1/schedule, app/home, app/punch, day/[employeeId]/[date]
  api/internal/recompute  cron, kiểm tra CRON_SECRET
```

**Luồng ghi.** Mỗi thao tác là một giao dịch: ghi dữ liệu gốc, `writeAudit`, gọi `recomputeDays`. Service giữ `pg_advisory_xact_lock` theo nhân viên để hai lần bấm gần nhau không ghi đè kết quả; khoá này chạy được qua Transaction pooler. Tính lại phải **xoá rồi ghi** dòng của cặp nhân viên × ngày thay vì upsert, nếu không dòng của ca vừa gỡ khỏi lịch vẫn còn. `approvals` nằm ở bảng riêng nên không mất.

| Sự kiện | Ngày cần tính lại | Người |
| --- | --- | --- |
| Lần chấm lúc t | Ngày của t và ngày trước đó (ca đêm) | Người chấm |
| Lưu ô lịch ngày D | D và D+1 (lần ra sáng hôm sau của ca đêm) | Người trong ô |
| Sửa ca | Từ đầu kỳ chưa công bố đến hôm nay | Người có ca đó |
| Sửa vị trí, ghi đè | Từ đầu kỳ chưa công bố đến hôm nay | Người giữ vị trí |
| Thêm/xoá ngày lễ | Ngày đó, nếu đã qua | Toàn công ty |
| Sửa cài đặt công ty | Từ đầu kỳ chưa công bố đến hôm nay | Toàn công ty |
| Cron 00:30 giờ Việt Nam | 2 ngày gần nhất (ca đêm cộng cửa sổ 6 giờ) | Toàn công ty |

**Vì sao cần cron.** Tính lại theo sự kiện không đủ: người không chấm thì không có sự kiện nào, nên `vang` không bao giờ xuất hiện, và người quên RA CA sẽ mãi ở `dang_lam`. Cron phải duyệt mọi nhân viên đang làm, kể cả người chưa có dòng ngày công. Trong ngày, dữ liệu trên màn đọc tính lại tại chỗ; Sprint 3 dùng cùng cách này cho Hộp việc.

**Dữ liệu chưa có giao diện.** `requests` và `approvals` đến Sprint 3 mới có màn nhập, nhưng engine vẫn nhận chúng làm đầu vào: T14–T16, T20, T21, T36–T38, T47, T48, T50 test bằng dữ liệu mẫu, còn service đọc hai bảng này ngay từ Sprint 2. Việc gắn tính lại vào duyệt và đơn làm ở Sprint 3.

**Test engine.**

- Mỗi dòng T01–T53 là một `it` riêng, có bước kiểm tra đủ 53 mã để không dòng nào bị bỏ sót.
- Bộ test đặt `now` mặc định sau cửa sổ 6 giờ; T17 chẳng hạn sẽ thành `dang_lam` nếu `now` quá sớm. Riêng T22, T23 truyền `now` theo đặc tả.
- Thêm test chạy hai lần cho cùng kết quả để giữ tính thuần.

**Chấm công.**

- `/app/punch` chỉ nhận loại, ca chọn, `lat`, `lng`, `accuracy`; giờ lấy từ server, không nhận từ client.
- Dùng địa điểm gần nhất trong số được phép, theo thứ tự ghi đè nhân viên rồi đến vị trí; `any_location` luôn tính là trong vùng.
- Bấm lặp vẫn ghi log, engine lấy lần vào sớm nhất và lần ra muộn nhất; nút khoá lại trong lúc gửi.
- GPS chỉ chạy trên HTTPS, nên thử điện thoại phải dùng bản staging.

**Hiệu năng.** Yêu cầu VÀO CA dưới 1 giây phụ thuộc vào việc server nằm cùng vùng với CSDL. Với `prepare: false` (bắt buộc cho Transaction pooler), mỗi truy vấn có tham số tốn 2 lượt đi về và không ghép được, nên một lần chấm mất khoảng 50 lượt: đo được 2,6 giây ở độ trễ 49 ms, và chỉ khoảng 20 ms khi CSDL không có độ trễ. Vì vậy phải chạy `sin1`, và chạy `npm run dev` nối Supabase từ Việt Nam sẽ luôn chậm. Mở kết nối mới tới Supabase mất thêm 0,5–1,5 giây, nên đo cả lần chấm đầu tiên sau khi rảnh.

Sửa cài đặt công ty với 120 nhân viên × 62 ngày mất khoảng 3,5 giây khi CSDL không có độ trễ; với quán 10 nhân viên thì khoảng một phần mười. Khi lên quy mô lớn hơn mới cần chuyển sang tính lại ở nền.

## Định nghĩa hoàn thành và kịch bản demo

Sprint 2 chỉ đóng khi cả bảy điều kiện dưới đây đều đạt.

- [ ] 9 story US14–US22 đạt tiêu chí nghiệm thu trong PRD
- [ ] 53/53 ca kiểm thử xanh trong CI: T01–T50 của US21 và T51–T53 của quyết định B1, B6
- [ ] CI xanh: lint, kiểm kiểu, test unit, test API, migration chạy sạch trên CSDL trống
- [ ] Mọi endpoint ghi mới có `audit_logs`, lọc `company_id` và có dòng trong `MATRIX`
- [ ] Bấm VÀO CA dưới 1 giây trên 4G, đo trên staging bằng điện thoại thật
- [ ] Chấm được trên ít nhất 1 iPhone và 1 Android tại quán
- [ ] Ngày công của 2 người trong demo khớp tính tay

**Kịch bản demo tại quán (20 phút):**

1. Mở Xếp ca, xếp tuần này cho Lê Ngọc Ánh, có một ngày hai ca liền nhau; ô đổi có chấm cam.
2. Thử rời trang khi chưa lưu → hệ thống hỏi xác nhận; bấm Lưu.
3. Người Tạp vụ hiện ca cố định viền đứt; bấm Cho nghỉ một ngày → ô thành "Nghỉ".
4. Ánh đứng ngoài quán mở app → thấy "Ngoài vùng · X m"; bước vào → "Trong vùng · X m".
5. Ánh bấm VÀO CA → thẻ kết quả đúng giờ hoặc muộn X phút; bấm lại lần nữa → công không đổi.
6. Người thứ hai chọn một ca ngoài lịch → có cờ ngoài lịch.
7. Tắt quyền vị trí trên điện thoại → app hiện hướng dẫn bật lại, không chấm được.
8. Một người ra ca sau giờ hết ca từ 30 phút trở lên → thấy "đã gửi đề xuất OT".
9. Quản lý mở màn kiểm tra ngày công, so từng dòng với bảng tính tay.
10. Sửa lịch của một ngày đã chấm → ngày công đổi ngay trên màn kiểm tra.
11. Mở CI, chỉ 53 test T01–T53 đều xanh.

## Phiếu thử tại quán (S2-21, S2-22)

Dùng bản staging có HTTPS, vì GPS không chạy trên HTTP. Ghi Đạt/Không đạt và tên máy vào từng dòng.

| # | Việc | iPhone (Safari iOS 16+) | Android (Chrome 10+) |
| --- | --- | --- | --- |
| 1 | Mở `/m?ma=PHONHO`, mã công ty tự điền, đăng nhập | | |
| 2 | Cài lên màn hình chính, mở từ biểu tượng, phiên còn giữ | | |
| 3 | Lần đầu mở, trình duyệt hỏi quyền vị trí | | |
| 4 | Đứng trong quán: "Trong vùng · X m", X có hợp lý không | | |
| 5 | Đứng ngoài bán kính: "Ngoài vùng · X m" | | |
| 6 | Từ chối quyền: hiện hướng dẫn, nút bị khoá, làm theo hướng dẫn bật lại được | | |
| 7 | Bấm VÀO CA trên 4G: có kết quả dưới 1 giây, kể cả lần đầu trong ngày | | |
| 8 | Bấm lại, tắt mở app, nút vẫn đúng trạng thái | | |
| 9 | RA CA sau giờ hết ca từ 30 phút: thấy "Đã gửi đề xuất OT" | | |

**So với tính tay:** với mỗi người, ghi giờ vào, giờ ra, ca, rồi tự tính phút làm, công, muộn, về sớm, OT theo đặc tả; mở `/app/bang-cong`, bấm ô của ngày đó và so từng số. Lệch ở đâu ghi lại nguyên dữ liệu đầu vào để thành ca kiểm thử mới.

## Rủi ro và cách xử lý

Rủi ro lớn nhất là engine: mọi màn của Sprint 3 và 4 đọc `day_records`, nên sai ở đây là sai lương. Vì vậy engine được ưu tiên trước, và các việc khác có thể cắt nếu trễ.

| Rủi ro | Dấu hiệu | Xử lý |
| --- | --- | --- |
| Bước B (ghép lần chấm) khó hơn dự kiến | S2-05 chưa xong cuối ngày 4 | Lùi màn tạm S2-19, Dev B hỗ trợ viết test; không cắt ca kiểm thử |
| Sửa cấu hình làm đổi công đã qua | Sửa giờ ca, các ngày đầu kỳ đổi theo | Schema không lưu lịch sử cấu hình nên chỉ tính lại trong kỳ chưa công bố; drawer ca và vị trí cảnh báo trước khi lưu |
| Tính lại nhiều ngày làm chậm thao tác lưu | Lưu ca hoặc cài đặt quá 3 giây | Đọc gộp theo khoảng ngày; nếu vẫn chậm thì lưu xong rồi tính lại ở nền |
| GPS trong nhà kém | Đứng trong quán vẫn báo ngoài vùng | Tăng bán kính địa điểm; lần chấm ngoài vùng vẫn được ghi và được tính công (Bước B mục 7) |
| Cron Vercel chạy trễ hoặc lỗi | Sáng hôm sau chưa có `vang` | Màn đọc tính lại các ngày có `computed_at` cũ, không phụ thuộc hoàn toàn vào cron |
| Quản lý sửa lịch trong lúc nhân viên đang chấm | Kết quả ghi đè lẫn nhau | Khoá theo nhân viên trong service tính lại; test API chạy song song hai yêu cầu |
| Chưa có quán thử để demo | Ngày 8 chưa hẹn được quán | Demo ở văn phòng với địa điểm đặt tại đó; thử tại quán trước khi vào Sprint 3 |
| Chỉ có 1 lập trình viên | Ngày 5 chưa xong S2-06 | Kéo dài sprint thành 3,5 tuần, không cắt US21 và US22 |
