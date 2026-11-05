# Should Have — Danh sách công việc

Nov 2, 2026 · @Lam Cao

Danh sách này chia phần Should Have trong [lộ trình](../website-analysis/10-development-roadmap.md) thành 35 việc, không chia sprint. Mỗi lần nhờ làm chỉ cần nêu mã, ví dụ "thực hiện SH-01 đến SH-02".

**Thứ tự:** làm theo nhóm từ trên xuống. Nhóm 1–5 không đổi số tiền nên làm được trong lúc quán chạy thử. Nhóm 7 đổi công thức lương nên chờ kỳ đầu khớp bảng tính tay.

**Cỡ việc:** S là sửa vài file; M là một màn hoặc một API mới; L là có migration và đụng nhiều màn.

## Điều kiện trước khi làm

- **MVP chưa xong:** PRD dời mọi thứ ngoài Must Have tới sau khi quán đầu tiên trả lương đúng một kỳ, mà S4-15 đến S4-20 vẫn chưa làm. Nhóm 1–6 có thể làm song song, nhưng không thay thế các việc đó.
- **Đã có sẵn, không làm lại:** thưởng/phạt nhập tay (PAY-05) và bảng công một người (TS-13) đã xong ở MVP.
- **Một việc trùng tên:** "Đăng ký ca" trong EMP-12 và EMP-13 là cùng một luồng, nên gộp thành SH-17.
- **Ngoài danh sách:** "Sắp vào ca" và sparkline thuộc Nice to Have. Chế độ cọ, Xếp theo ngày, huỷ công bố và lịch sử công bố có trong Phase 2 hoặc PRD nhưng không thuộc mục Should Have.

## Nhóm 1 — Nhân sự và xuất dữ liệu

Các việc này giúp quán vào dùng nhanh hơn, không đụng engine hay công thức lương.

| Mã | Việc | Tính năng | Cỡ | Ghi chú |
| --- | --- | --- | --- | --- |
| SH-01 | Thêm hàng loạt: dán "Họ tên, email, vị trí", xem trước, khớp vị trí không dấu, báo lỗi từng dòng | STF-10 | M | Cả lô một transaction, sai một dòng thì không tạo dòng nào; PIN tự sinh chỉ hiện một lần |
| SH-02 | Gửi link cài app: QR, chép và tải QR, tin nhắn mẫu từng người | STF-11 | S | CSDL chỉ lưu PIN băm, nên tin nhắn chỉ kèm PIN ngay sau khi tạo hoặc đặt lại PIN |
| SH-03 | Xuất Excel bảng công theo kỳ | TS-09 | M | Dùng `exceljs` ở server; Quản lý nhóm chỉ xuất người mình quản lý |
| SH-04 | Xuất Excel bảng lương | PAY-09 | S | Cần SH-03; kỳ đã công bố đọc từ bản chụp `payslips`; chỉ quyền thấy lương mới xuất được |
| SH-05 | In phiếu lương hoặc lưu PDF | PAY-08 | S | Dùng CSS in và hộp in của trình duyệt, không thêm thư viện PDF |

## Nhóm 2 — Xếp ca nhanh

| Mã | Việc | Tính năng | Cỡ | Ghi chú |
| --- | --- | --- | --- | --- |
| SH-06 | Chép tuần trước vào lưới chưa lưu, có hộp xác nhận số người và số ca | SCH-09 | S | Chỉ đổi lưới phía client, lưu bằng `PUT /schedule` có sẵn |
| SH-07 | Rải lịch: chọn người, khoảng ngày, nhóm ca theo thứ, xoá ngày ngoài nhóm, bỏ qua lễ | SCH-08 | M | Ghi ngay, tối đa 3 tháng mỗi lần; gọi tính lại một lần cho cả lô |
| SH-08 | Mẫu tuần: lưu tuần đang xem thành mẫu, áp mẫu vào tuần khác | SCH-10 | M | Thêm bảng mẫu tuần; áp mẫu vào lưới chưa lưu như SH-06 |

## Nhóm 3 — Duyệt và Bảng công

| Mã | Việc | Tính năng | Cỡ | Ghi chú |
| --- | --- | --- | --- | --- |
| SH-09 | API duyệt hàng loạt theo đề xuất | INB-08 | M | Dùng chung cho SH-10 và SH-12; một transaction, tính lại một lần; giữ khoá việc nhân viên × ngày × ca × cờ và luật không tự duyệt của mình |
| SH-10 | Hộp việc: chọn nhiều, "Chọn tất cả", nút "Duyệt theo đề xuất · N" | INB-08 | S | Cần SH-09; việc không có đề xuất thì không chọn được |
| SH-11 | Phím tắt J/K/A/E ở Hộp việc | INB | S | Tắt khi đang gõ trong ô nhập hoặc mở drawer |
| SH-12 | Bảng công: chế độ duyệt loạt, chọn mọi ô cần duyệt, "Duyệt N" | TS-08 | M | Cần SH-09 |
| SH-13 | Bảng công: Kỳ lệch và Tự chọn | TS-02, TS-03 | M | Chỉ đổi khoảng ngày xem, không đổi kỳ lương; khoảng ngày có giới hạn để lưới không quá nặng |
| SH-14 | Bảng công Theo tuần: chip tuần, mini-bar trong ô, cột Tuần | TS-05 | M | Dùng lại `readDayRecords`; ẩn nút duyệt loạt như bản gốc |
| SH-15 | Tìm nhanh Ctrl/⌘+K: trang, nhân viên, ngày "15/9" | GEN-01 | M | Lọc theo quyền của người đang xem, không trả nhân viên ngoài phạm vi |

## Nhóm 4 — Đơn và thông báo

Làm SH-16 trước vì các đơn mới đều cần báo kết quả cho nhân viên.

| Mã | Việc | Tính năng | Cỡ | Ghi chú |
| --- | --- | --- | --- | --- |
| SH-16 | Thông báo trong app nhân viên: đơn được duyệt hay từ chối, lịch đổi, phiếu lương mới | EMP-17 | L | Thêm bảng thông báo và số chưa đọc; chưa làm web push |
| SH-17 | App: đăng ký ca tuần sau, lưới ca × ngày, Bạn chọn/Đã gửi/Đã xếp lịch | EMP-12, EMP-13 | L | Thêm loại đơn vào enum; chỉ đăng ký được ca của vị trí mình |
| SH-18 | Xếp ca: banner chờ nhận, "Nhận tất cả", Nhận/Từ chối từng ô, chip trong Hộp việc | SCH-11, SCH-12 | M | Cần SH-17; nhận thì ghi lịch và tính lại trong cùng transaction |
| SH-19 | Đơn Muộn/sớm: loại, ngày, số phút, ca, lý do | EMP-13 | L | Thêm ca kiểm thử T60 trở đi; trước khi có SH-33 thì đơn chỉ gỡ việc khỏi Hộp việc, chưa ảnh hưởng tiền |
| SH-20 | Đơn Đổi ca: ngày nghỉ, ca nghỉ, ngày làm bù, ca làm bù | EMP-13 | L | Duyệt thì sửa lịch cả hai ngày; thêm ca kiểm thử |

## Nhóm 5 — Điều phối

Màn mới `/app/dieu-phoi`, tự làm mới mỗi 60 giây bằng polling. Quản lý nhóm chỉ thấy người mình quản lý.

| Mã | Việc | Tính năng | Cỡ | Ghi chú |
| --- | --- | --- | --- | --- |
| SH-21 | Khung trang, mục menu, API tổng hợp, 4 thẻ số, lọc địa điểm, tự làm mới | LIVE-01, 02, 03 | M | Bỏ thẻ "Sắp vào ca"; chỉ làm mới khi tab đang mở |
| SH-22 | Bản đồ chấm công: vòng địa điểm, marker theo trạng thái, gom cụm | LIVE-04 | M | Dùng lại Leaflet |
| SH-23 | Dòng thời gian ca và drawer ngày công | LIVE-07, 09 | L | Dùng lại `DayDrawer`; ca đêm liền một thanh |
| SH-24 | Cần để ý ngay và nhật ký chấm công 24 giờ | LIVE-05, 08 | S | Dùng lại dữ liệu của SH-21 |

## Nhóm 6 — Chống chấm hộ

Hai tính năng này có thể chặn nhân viên chấm công, nên đều là tuỳ chọn của công ty và mặc định tắt. Cần thử trên iPhone và Android thật trước khi bật cho quán.

| Mã | Việc | Tính năng | Cỡ | Ghi chú |
| --- | --- | --- | --- | --- |
| SH-25 | Kho ảnh: bucket riêng tư, URL ký có hạn, tự xoá theo thời hạn | SET-08 | M | Không để công khai; bản sao lưu ở S4-16 chưa gồm Storage, phải tính riêng |
| SH-26 | Chụp ảnh khi chấm, nén ở máy, xem ảnh trong drawer ngày, bật/tắt theo công ty, vị trí, người | EMP-05, SET-08 | L | Cần SH-25; thêm màn hướng dẫn khi camera bị chặn |
| SH-27 | Gắn thiết bị: mỗi tài khoản một máy, máy khác bị chặn | AUTH-05 | L | Dùng cookie httpOnly do server cấp, không dùng localStorage; Safari và PWA trên iPhone tách kho lưu trữ nên phải gắn trong PWA |
| SH-28 | Mở khoá máy cho một người ở Nhân sự | AUTH-06 | S | Cần SH-27; ghi `audit_logs` |

## Nhóm 7 — Lương nâng cao

Đổi công thức trong lúc đang đối chiếu sẽ làm S4-18 mất ý nghĩa, nên nhóm này chờ kỳ đầu khớp. Mọi khoản tính trong `lib/payroll/compute-pay.ts`; phiếu đã công bố không đổi vì đọc bản chụp.

| Mã | Việc | Tính năng | Cỡ | Ghi chú |
| --- | --- | --- | --- | --- |
| SH-29 | Chốt công thức với bảng lương của quán, viết ca P22 trở đi trước khi code (P19–P21 đã dùng cho SH-36) | POS-03 | S | Làm trước các việc còn lại trong nhóm |
| SH-30 | Bậc lương: danh sách bậc theo vị trí, gán cho nhân viên | POS-03 | L | Thêm bảng bậc; thứ tự ưu tiên: lương riêng → bậc → mức vị trí |
| SH-31 | Phụ cấp 3 kiểu: theo công, cố định tháng, theo tháng chia công | POS-03 | L | Lưu theo vị trí, ghi đè được theo người |
| SH-32 | Thưởng cố định hằng tháng | POS-03 | S | Cần SH-31; chỉ cộng ở kỳ tròn tháng |
| SH-33 | Phạt muộn/sớm theo phút, phạt quên chấm theo lần | POS-03 | M | Phút có đơn SH-19 đã duyệt không bị trừ; xem quyết định về phạt tiền bên dưới |
| SH-34 | BHXH: lương đóng × tỷ lệ, mặc định 10,5% | POS-03 | M | Chỉ áp ở kỳ tròn tháng; có công tắc tắt |
| SH-35 | Hiện khoản mới ở sao kê, "Vì sao ra số này", M4, Excel và phiếu in | POS-03, PAY-04 | M | Cần SH-30 đến SH-34, cùng SH-04 và SH-05 nếu đã làm |

## Nhóm 8 — Nhiều vị trí, xếp theo ca, lịch nháp

Yêu cầu thêm ngày 03/11/2026: một người làm được nhiều vị trí (ví dụ Phục vụ và Pha chế), quản lý chọn vị trí cho từng ca khi xếp, xem lịch theo ca, và lịch tuần sau chỉ tới tay nhân viên khi bấm Công bố.

| Mã | Việc | Cỡ | Ghi chú |
| --- | --- | --- | --- |
| SH-36 | Vị trí phụ của nhân viên, vị trí của từng ca, lương theo vị trí của ca | L | Bảng `employee_positions`, cột `schedule_cells.positions`; ca P19–P21 |
| SH-37 | Lịch nháp: lưu từ ngày mai trở đi vào `schedule_drafts`, Công bố và Bỏ nháp theo tuần | L | Nhận đăng ký ca cũng vào nháp |
| SH-38 | Màn Xếp ca kiểu Theo ca: hàng là ca, ô là người đã xếp và đăng ký chờ nhận | M | Dùng chung ô đang sửa và nút Lưu với kiểu Theo nhân viên |

Quyết định đã chốt:

| Điểm | Quyết định |
| --- | --- |
| Vị trí mặc định khi xếp | Vị trí chính của nhân viên (`employees.position_id`); người chỉ có một vị trí thì không phải chọn |
| Nhân viên đăng ký ca | Như cũ, chỉ chọn ngày × ca, không chọn vị trí |
| Ca được làm, địa điểm chấm | Gộp mọi vị trí của người đó (Ca riêng, Địa điểm riêng vẫn thắng) |
| Lương | Ca nào tính theo mức của vị trí đã xếp cho ca đó, chỉ khi vị trí đó trả theo giờ hoặc theo công. Vị trí chính trả theo tháng thì một mức chung. Lương riêng đặt được cho từng vị trí (`employee_positions.pay_amount`), để trống là theo mức của vị trí |
| % tăng ca | Theo vị trí của ca. Công chuẩn và ngày phép theo vị trí chính |
| Nháp ảnh hưởng tới ai | Chỉ quản lý thấy. Nhân viên, Bảng công, Lương dùng lịch đã công bố. Sửa ô đã công bố cũng thành nháp, lịch cũ giữ hiệu lực tới khi công bố lại |
| Phạm vi Công bố | Tuần đang xem, chỉ người mình quản lý. Mỗi người một thông báo gộp |
| Ô ở kiểu Theo ca | Hiện tên người đã xếp và tên người đăng ký chờ nhận (viền đứt); điện thoại chỉ hiện tên gọi |
| Hôm nay và ngày đã qua | Có hiệu lực ngay, không qua nháp. Đơn Đổi ca đã duyệt ghi thẳng vào lịch thật và bỏ nháp của ô đó |
| Nhận đăng ký ca | Vào nháp, đơn vẫn Chờ (nhân viên thấy "Chờ xếp"), Công bố mới chuyển Đã nhận. Bỏ nháp hoặc gỡ ca khỏi nháp thì đơn quay về chờ nhận. Hộp việc ẩn đơn đã nằm trong nháp |
| Đổi vị trí của ca ngày đã qua | Kỳ lương đã công bố phủ ngày đó chuyển sang "cần công bố lại" |

## Nhóm 9 — Sửa, xoá đơn và giờ mở đăng ký ca

Yêu cầu ngày 04/11/2026. Hằng số ở `lib/domain/request-window.ts`.

| Điểm | Quyết định |
| --- | --- |
| Giờ mở đăng ký ca | 07:00 Thứ Năm tới 07:00 Thứ Bảy hằng tuần, cho tuần kế tiếp; cố định cho mọi quán. Ngoài giờ chỉ xem lưới, không gửi được |
| Sửa, xoá đơn thường | Trong 10 phút từ lúc gửi (sửa không gia hạn), chỉ khi đơn còn Chờ; đã duyệt hoặc từ chối thì khoá ngay. Không đổi được loại đơn |
| Sửa, xoá đăng ký ca | Trong giờ mở đăng ký: bấm ô Chờ để bỏ, chọn ô khác để gửi thêm. Đơn đã được nhận vào nháp vẫn bỏ được, ca đó được gỡ khỏi nháp |
| Xoá | Xoá hẳn khỏi danh sách và Hộp việc; `audit_logs` giữ bản đơn đã xoá |
| Đơn của tôi | Ở tab Tôi |
| Test | `REGISTRATION_ALWAYS_OPEN=1` (chỉ khi `APP_ENV=local`) cho đợt luôn mở, vì test chạy ở giờ bất kỳ |

## Nhóm 10 — Lịch sử đơn cho quản lý

Màn **Đơn từ** (`/app/don-tu`, Quản lý nhóm trở lên): mọi đơn của kỳ lương đang xem, có ngày nằm trong kỳ, của người mình quản lý. Lọc trạng thái, loại đơn, tên. Chi tiết ghi ai gửi lúc nào, ai duyệt hoặc từ chối lúc nào, lý do từ chối; đơn còn chờ duyệt được ngay trong chi tiết. Đơn nhân viên đã xoá không hiện. Quản lý chưa xoá hay huỷ được đơn.

## Nhóm 11 — Pass ca

Thay form Đổi ca (đơn `shift_swap` cũ vẫn giữ trong lịch sử). Loại đơn `shift_pass`, người nhận ở `requests.target_employee_id`; logic ở `lib/services/shift-pass.ts`.

| Điểm | Quyết định |
| --- | --- |
| Ca pass được | Ca của mình trong lịch đã công bố (cả ca cố định), 14 ngày tới, chưa bắt đầu; mỗi ca một đơn đang chờ |
| Người nhận được | Nhân viên đang làm, không phải mình, giờ đó không có ca trùng (kể cả ca đêm hôm trước), làm được vị trí của ca: vị trí chính, vị trí phụ, hoặc vị trí họ "làm thay được" (Vị trí & ca, bảng `position_covers`). Không xét ca được làm của người nhận |
| Duyệt | Người nhận đồng ý là lịch đổi ngay, quản lý không duyệt; giờ người gửi và quản lý của hai người nhận thông báo |
| Vị trí, lương | Ca giữ vị trí cũ; người nhận được trả theo mức của vị trí đó (lương riêng ở vị trí phụ nếu có), trừ khi vị trí chính của họ trả theo tháng |
| Hết hạn | Tới giờ vào ca mà chưa trả lời thì đơn hết hạn (tính lúc đọc), ca vẫn của người gửi |
| Sửa, xoá | Không sửa; xoá trong 10 phút khi còn chờ |
| Sửa ô sau đó | Ca và vị trí đã có sẵn trong ô được giữ khi quản lý sửa ô ở Xếp ca, dù người đó vốn không được xếp ca hay vị trí ấy |

## Quyết định đang để mặc định

Các điểm dưới đây chưa chốt. Việc liên quan sẽ làm theo mặc định, trừ khi bạn đổi lại.

| Điểm | Mặc định | Việc liên quan |
| --- | --- | --- |
| Phạt tiền đi muộn | Mặc định tắt và phải hỏi người am hiểu luật lao động trước khi bật: Điều 127 Bộ luật Lao động 2019 cấm phạt tiền, cắt lương thay cho kỷ luật lao động. Trừ theo thời gian không làm là chuyện khác với phạt | SH-33 |
| "Kỳ tròn tháng" của BHXH và thưởng cố định | Người làm đủ cả kỳ lương; vào hoặc nghỉ giữa kỳ thì không áp | SH-32, SH-34 |
| Thời hạn lưu ảnh chấm công | 90 ngày, báo trước cho nhân viên vì đây là ảnh khuôn mặt | SH-25, SH-26 |
| Đổi ca khi ngày đó đã có lần chấm | Chặn duyệt, quản lý sửa tay | SH-20 |
| Duyệt đơn Muộn/sớm | Ngày đó không còn cờ muộn/sớm, phần vượt quá số phút xin vẫn tính | SH-19 |
| Thuế TNCN | Ngoài phạm vi | SH-34 |

## Quy tắc chung cho mọi việc

- Endpoint ghi mới có `audit_logs`, lọc `company_id`, và có dòng trong `MATRIX` của test quyền.
- Thao tác đổi ngày công gọi tính lại trong cùng transaction; màn đọc ngày công đi qua `readDayRecords`.
- Sửa `schema.ts` thì chạy `npm run db:generate`; migration chỉ thêm.
- Đổi engine hay lương thì thêm ca kiểm thử trước khi code.
- Xong mỗi việc chạy `npm run check`, test API trên build thật, và đánh dấu tiến độ vào `CLAUDE.md`.

## Nhóm 12 — Duyệt loạt ở Bảng công Theo tuần, gồm ca Vắng

Quyết định đã chốt:

- Nút **Duyệt loạt** ở kiểu xem Theo tuần chỉ dành cho **Quản trị viên**; Nhân sự và Quản lý nhóm không thấy nút, gửi ca Vắng qua API bị 403.
- Theo tuần duyệt được mọi việc có đề xuất như Lưới cả kỳ, **thêm ca Vắng**. Lưới cả kỳ giữ như cũ, không duyệt loạt ca Vắng.
- Khi lô có ca Vắng, hộp xác nhận hỏi một lựa chọn áp cho mọi ca Vắng đã chọn:
  - **Xác nhận vắng, 0 công**: ô vẫn là Vắng, hết cần duyệt.
  - **Cho đủ công**: 1 công mỗi ca, như ca đi làm đủ, kể cả ca ghép (T24). Không dùng công kỳ vọng 0,5 của ca ghép: số đó chỉ dành cho phép và lễ.
- Không gửi lựa chọn thì ca Vắng trong lô bị bỏ qua (`skipped`). Duyệt nhầm thì hoàn duyệt ở từng ngày.

Code: `absenceDecision` (`lib/domain/approval.ts`), `approvableItems(row, { absence })`, `bulkApprovalSchema.absence`, `TimesheetView.canBulk`.

## Nhóm 13 — Giao diện Lương mới, Huỷ công bố

Quyết định đã chốt:

- Màn Lương chỉ có kỳ **Tháng** (theo ngày chốt). Không có Kỳ lệch, Tự chọn: Lương, phiếu và công bố luôn theo `companies.cutoff_day`.
- Thanh kỳ (‹ Tháng MM/YYYY ›, Kỳ này), In phiếu cả kỳ và Xuất Excel nằm trên dải header.
- Thẻ kỳ lương ghi giờ và người công bố. Đã công bố thì nút **Công bố lại** luôn hiện; chỉ tô đậm khi số liệu đã đổi.
- **Huỷ công bố** chỉ dành cho Quản trị viên: xoá bản chụp phiếu của kỳ, kỳ về Chưa công bố, nhân viên hết thấy phiếu và nhận thông báo "Phiếu lương đã thu hồi". `audit_logs` (`payroll.unpublish`) giữ số các phiếu vừa xoá. Công bố sau đó là lần công bố mới.
- Danh sách: tìm theo tên hoặc email, lọc vị trí và kiểu lương, sắp xếp theo tên, thực lĩnh, cần xử lý.
- Sao kê có bảng **Từng ngày**. Tắt "Hiện đủ từng ngày" thì chỉ còn ngày có việc: muộn/sớm, OT, cần duyệt, hoặc khác Đủ công, Lễ.

Code: `PayrollBar`, `unpublishPayroll` (`lib/services/payroll.ts`), `getPayStatement().days`.

## Nhóm 14 — Lương giờ tính theo ca, hệ số ca

Quyết định đã chốt (04/11/2026):

- Lương giờ của một ca = **đơn giá giờ × (giờ chuẩn ca × công + giờ OT đã duyệt) × hệ số**. Thực lĩnh = tổng các ca + thưởng − phạt.
- Giờ ca theo giờ chuẩn của ca, không theo phút chấm. OT của lương giờ không nhân % theo loại ngày.
- Hệ số đặt ở **Điều chỉnh khác** khi duyệt công, mặc định 1, từ 0 tới 10, tối đa 2 chữ số thập phân. Hệ số tách riêng với công, không đóng việc cần duyệt.
- Chỉ áp cho ca trả theo giờ; lương tháng, lương công giữ như cũ.
- Ca P04, P08, P10, P11, P15, P19, P20 đổi theo; thêm P22–P24 (`07-sprint-4.md`).

Code: `shiftHours`, `shiftBase`, `PayResult.dayAmounts` (`lib/payroll/compute-pay.ts`), `approvals.pay_factor`, `day_records.pay_factor`, migration `0008_pay_factor`.

## Nhóm 15 — Chi tiết ngày công trên phiếu nhân viên

- Phiếu lương ở app nhân viên có nút **Xem chi tiết N ngày công**: mở bảng giống bảng Từng ngày của sao kê quản trị, mỗi ca một dòng, **bỏ cột Công và Sau ca**: Ngày, Ca, Vào, Ra, Trong ca, Muộn / sớm, Hệ số, Tiền ca (chỉ khi lương giờ), Ghi nhận. Trên điện thoại bảng cuộn ngang trong khung.
- Số liệu là **bản chụp lúc công bố** (`payslips.summary.days`), không tính lại, nên khớp tổng phiếu. Phiếu công bố trước khi có tính năng này không có chi tiết, nút ẩn; công bố lại kỳ đó thì có.
- N là số ngày có dòng ngày công trong kỳ, gồm cả ngày Vắng.

Code: `statementDays` (`lib/services/payroll.ts`), `DayTable` dùng chung (`components/admin/payroll/DayTable.tsx`, `compact` cho phiếu), `SlipDays` (`components/employee/PayslipTab.tsx`).
