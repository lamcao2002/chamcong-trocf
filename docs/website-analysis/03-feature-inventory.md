# 03. Danh sách chức năng (Feature Inventory)

Ưu tiên: **P0** = lõi (không có thì sản phẩm không chạy) · **P1** = quan trọng · **P2** = bổ trợ / tiện ích.
Kiểm chứng: CONFIRMED / INFERRED / UNKNOWN (định nghĩa tại `01-overview.md`).

## A. Xác thực, dùng thử, thương mại

| ID | Nhóm | Tên chức năng | Mô tả | Trang | Ưu tiên | Kiểm chứng |
|---|---|---|---|---|---|---|
| AUTH-01 | Xác thực | Đăng nhập quản trị | Mã công ty + Email + Mã PIN (ẩn/hiện PIN) | /app | P0 | CONFIRMED (form); phiên 14 ngày INFERRED (hướng dẫn) |
| AUTH-02 | Xác thực | Đăng xuất | Từ menu avatar | toàn app | P0 | CONFIRMED (hiển thị) |
| AUTH-03 | Xác thực | Menu tài khoản | Tên, email · vai trò, Đăng xuất | header | P1 | CONFIRMED |
| AUTH-04 | Xác thực | Đăng nhập nhân viên | Email + PIN; link mời có sẵn mã công ty | /m | P0 | CONFIRMED |
| AUTH-05 | Bảo mật | Gắn thiết bị (device binding) | Mỗi tài khoản 1 điện thoại; máy khác bị chặn | /m | P1 | INFERRED (hướng dẫn + key `ehr_device_uid`) |
| AUTH-06 | Bảo mật | Mở khoá máy (1 người) | Gỡ gắn thiết bị của nhân viên | Nhân sự | P1 | CONFIRMED (nút) |
| AUTH-07 | Bảo mật | Mở khoá máy cả công ty | Gỡ gắn thiết bị toàn bộ | Nhân sự "…" | P2 | CONFIRMED (menu, chưa bấm) |
| DEMO-01 | Dùng thử | Chọn ngành dữ liệu mẫu | 7 ngành, mỗi ngành 1 công ty mẫu | /app?demo=1 | P2 | CONFIRMED |
| DEMO-02 | Dùng thử | Công ty mẫu tạm | Mã DEMO-xxx riêng mỗi phiên, 45 ngày dữ liệu, làm mới sau 6 giờ | toàn app | P2 | CONFIRMED |
| DEMO-03 | Dùng thử | Tài khoản NV mẫu | Chip "Thử nhanh tài khoản khác (PIN 1234)", chip đổi ngành | /m | P2 | CONFIRMED |
| DEMO-04 | Dùng thử | Thử công ty mới | Tạo công ty trắng + thiết lập 2 phút | /app | P1 | UNKNOWN |
| SHOP-01 | Thương mại | Upsell bottom sheet | "Thấy hợp với công ty bạn?" + Chọn gói / Để sau | toàn app | P2 | CONFIRMED |
| SHOP-02 | Thương mại | Chọn gói | Theo năm / Vĩnh viễn; 3 mức quy mô; form nhận kích hoạt | modal | P1 | CONFIRMED |
| SHOP-03 | Thương mại | Thanh toán QR + email kích hoạt | Chuyển khoản, không lưu thẻ, không tự gia hạn | modal | P1 | UNKNOWN (bước QR) |

## B. Hộp việc (`/app/`)

| ID | Nhóm | Tên chức năng | Mô tả | Trang | Ưu tiên | Kiểm chứng |
|---|---|---|---|---|---|---|
| INB-01 | Tổng quan | Lời chào + ngữ cảnh | "Chào buổi sáng, Hà" + ngày + số người có ca lúc này | Hộp việc | P2 | CONFIRMED |
| INB-02 | Tổng quan | 4 thẻ KPI hôm nay | Đang trong ca x/y, Đi muộn hôm nay, Chưa chấm công (quá giờ vào 15'), Chờ bạn xử lý | Hộp việc | P1 | CONFIRMED |
| INB-03 | Tổng quan | Sparkline xu hướng 7 ngày | Trên thẻ KPI (desktop) | Hộp việc | P2 | CONFIRMED (desktop) |
| INB-04 | Danh sách | Danh sách việc cần xử lý trong kỳ | Mỗi dòng: tên, ngày, tag loại, ca, mô tả, đề xuất | Hộp việc | P0 | CONFIRMED |
| INB-05 | Danh sách | Lọc theo loại (chip có đếm) | Tất cả, OT đề xuất, Thiếu giờ, Vắng, Ngoài vùng, Sai ca, Đơn nghỉ, Đăng ký ca | Hộp việc | P1 | CONFIRMED |
| INB-06 | Danh sách | Làm mới | Nút refresh | Hộp việc | P2 | CONFIRMED |
| INB-07 | Duyệt | Duyệt nhanh trên dòng | Nút "Duyệt" (ẩn khi không có đề xuất, vd Vắng) | Hộp việc | P0 | CONFIRMED |
| INB-08 | Duyệt | Chọn nhiều + Duyệt theo đề xuất | Checkbox tròn; nút "Duyệt theo đề xuất · N"; "Chọn tất cả" (desktop) | Hộp việc | P1 | CONFIRMED (hiển thị; chưa bấm duyệt hàng loạt) |
| INB-09 | Chi tiết | Panel chi tiết việc | Master–detail (desktop) / drawer (mobile) | Hộp việc | P0 | CONFIRMED |
| INB-10 | Chi tiết | Thanh thời gian ca vs có mặt | Sọc = khung ca, nâu = có mặt, tím = sau ca | Hộp việc | P1 | CONFIRMED |
| INB-11 | Chi tiết | Ảnh chấm công | Thumbnail vào/ra | Hộp việc | P1 | CONFIRMED |
| INB-12 | Chi tiết | "Vì sao hệ thống đề xuất" | Giải thích bằng ngôn ngữ tự nhiên | Hộp việc | P1 | CONFIRMED |
| INB-13 | Chi tiết | Bản đồ nơi chấm | Leaflet/OSM, địa điểm + điểm chấm | Hộp việc | P1 | CONFIRMED |
| INB-14 | Duyệt | Duyệt theo đề xuất | Nút chính (vd "Duyệt 96 phút"), phím A | Hộp việc | P0 | CONFIRMED (đã thử) |
| INB-15 | Duyệt | Phương án thay thế | Vd "Không tính OT" | Hộp việc | P1 | CONFIRMED (hiển thị) |
| INB-16 | Duyệt | Điều chỉnh khác… | Số công (Theo hệ thống/1/0,5/0), phút OT, Duyệt thiếu giờ, ghi chú, Lưu duyệt/Quay lại | Hộp việc | P0 | CONFIRMED |
| INB-17 | Duyệt | Để sau | Bỏ qua, sang việc khác | Hộp việc | P2 | CONFIRMED (hiển thị) |
| INB-18 | Duyệt | Tự chuyển việc kế tiếp sau khi duyệt | + toast "Đã duyệt 1 ô." | Hộp việc | P1 | CONFIRMED |
| INB-19 | Đơn từ | Duyệt / Từ chối đơn | Đơn nghỉ, đăng ký ca: Duyệt · Từ chối · Để sau | Hộp việc | P0 | CONFIRMED (đã từ chối 1 đơn demo) |
| INB-20 | Đơn từ | Xem trên lưới xếp ca | Link từ đơn đăng ký ca | Hộp việc | P2 | CONFIRMED (hiển thị) |
| INB-21 | Phím tắt | J/K/A/E | Chuyển việc, duyệt, mở bảng công ngày | Hộp việc | P2 | CONFIRMED (gợi ý hiển thị) |

## C. Điều phối (`/app/dieu-phoi`)

| ID | Nhóm | Tên chức năng | Mô tả | Trang | Ưu tiên | Kiểm chứng |
|---|---|---|---|---|---|---|
| LIVE-01 | Real-time | Lọc theo địa điểm | Chip Mọi địa điểm / từng địa điểm | Điều phối | P1 | CONFIRMED |
| LIVE-02 | Real-time | Tự làm mới mỗi phút | "cập nhật HH:MM · tự làm mới mỗi phút" | Điều phối | P1 | CONFIRMED (nhãn) |
| LIVE-03 | KPI | 5 thẻ số | Đang làm, Chưa vào ca, Sắp vào ca (12h), Vào muộn, Chấm ngoài vùng | Điều phối | P1 | CONFIRMED |
| LIVE-04 | Bản đồ | Bản đồ chấm công | Vòng địa điểm, marker theo trạng thái, gom cụm có số | Điều phối | P1 | CONFIRMED |
| LIVE-05 | Cảnh báo | Cần để ý ngay | Trễ vào ca, ngoài vùng, quá giờ ra; empty "Mọi thứ ổn" | Điều phối | P1 | CONFIRMED (empty state) |
| LIVE-06 | Lịch | Sắp vào ca (6 giờ tới) | Danh sách người + giờ vào | Điều phối | P2 | CONFIRMED |
| LIVE-07 | Timeline | Dòng thời gian ca | Từ 21:00 hôm qua → hết hôm nay, vạch "bây giờ", lọc trạng thái, ca đêm liền thanh | Điều phối | P1 | CONFIRMED |
| LIVE-08 | Nhật ký | Chấm công 24 giờ qua | Feed vào/ra, địa điểm, giờ, "x giờ y phút trước" | Điều phối | P2 | CONFIRMED |
| LIVE-09 | Chi tiết | Drawer ngày công từ timeline | "Hệ thống tính", điều chỉnh, "Mở bảng công của X" | Điều phối | P1 | CONFIRMED |

## D. Bảng công (`/app/bang-cong`)

| ID | Nhóm | Tên chức năng | Mô tả | Trang | Ưu tiên | Kiểm chứng |
|---|---|---|---|---|---|---|
| TS-01 | Kỳ | Chọn kỳ: Tháng | ‹ › chuyển tháng | Bảng công | P0 | CONFIRMED |
| TS-02 | Kỳ | Kỳ lệch | "Bắt đầu từ ngày" (select) + "Kỳ này" | Bảng công | P1 | CONFIRMED |
| TS-03 | Kỳ | Tự chọn | Date range picker | Bảng công | P2 | CONFIRMED |
| TS-04 | Xem | Lưới cả kỳ | Hàng = NV, cột = ngày, ô màu ký hiệu, cột tổng Công/Muộn/Thiếu/OT | Bảng công | P0 | CONFIRMED |
| TS-05 | Xem | Theo tuần | Chip tuần, ô có mini-bar + giờ vào–ra, cột Tuần (công + trạng thái) | Bảng công | P1 | CONFIRMED |
| TS-06 | Lọc | Tìm tên + lọc vị trí | Input + select | Bảng công | P1 | CONFIRMED |
| TS-07 | Lọc | Cần duyệt · N | Chỉ hiện người còn việc | Bảng công | P1 | CONFIRMED (hiển thị) |
| TS-08 | Duyệt | Duyệt loạt | Chế độ chọn ô viền đứt; "Chọn mọi ô cần duyệt"; "Duyệt N" | Bảng công | P1 | CONFIRMED (chưa bấm Duyệt N) |
| TS-09 | Xuất | Excel | Xuất bảng công kỳ | Bảng công | P1 | INFERRED (không tải) |
| TS-10 | Chú thích | Xem chú thích màu | 12 ký hiệu | Bảng công | P2 | CONFIRMED |
| TS-11 | Chi tiết | Drawer ngày công | Giờ vào/ra, ảnh, nơi chấm, hệ thống tính, điều chỉnh, Lưu duyệt | Bảng công | P0 | CONFIRMED |
| TS-12 | Chi tiết | Hoàn duyệt | Gỡ duyệt nhầm | Bảng công | P1 | INFERRED (hướng dẫn) |
| TS-13 | Chi tiết | Bảng công một người | KPI kỳ, tab Ngày có ca/Mọi ngày/Cần duyệt, Excel, Lương | Bảng công | P1 | CONFIRMED |
| TS-14 | Deep link | `?ngay=&nv=` | Mở thẳng drawer ngày + lọc tên | Bảng công | P2 | CONFIRMED |
| TS-15 | Hiển thị | Nhiều ca/ngày | Badge số "2" trên ô | Bảng công | P1 | CONFIRMED |

## E. Xếp ca (`/app/xep-ca`)

| ID | Nhóm | Tên chức năng | Mô tả | Trang | Ưu tiên | Kiểm chứng |
|---|---|---|---|---|---|---|
| SCH-01 | Tuần | Điều hướng tuần + "Tuần này" | ‹ › và nút quay về tuần hiện tại | Xếp ca | P0 | CONFIRMED |
| SCH-02 | Xếp | Xếp theo người | Nhóm theo vị trí (thu gọn được), dải 7 ô/người | Xếp ca | P0 | CONFIRMED |
| SCH-03 | Xếp | Drawer xếp tuần 1 người | Chip ca theo ngày (bật/tắt), nút xoá ngày, "Hiện thêm N ca khác", hiển thị đăng ký app | Xếp ca | P0 | CONFIRMED |
| SCH-04 | Xếp | Xếp theo ngày / chế độ cọ | Chọn ca ở palette rồi bấm người/ô; Cho nghỉ (bỏ ca cố định); Xoá ca | Xếp ca | P0 | CONFIRMED |
| SCH-05 | Xếp | Kéo chuột tô nhiều ô | Desktop | Xếp ca | P2 | INFERRED (hướng dẫn) |
| SCH-06 | Lưu | Thanh lưu thay đổi | "N ô chưa lưu · ↶ · Lưu (N)"; chấm cam trên ô | Xếp ca | P0 | CONFIRMED |
| SCH-07 | Lưu | Bỏ thay đổi có xác nhận | "Bỏ N thay đổi chưa lưu?" Giữ lại / Bỏ thay đổi | Xếp ca | P1 | CONFIRMED |
| SCH-08 | Công cụ | Rải lịch nhiều ngày | NV + khoảng ngày + nhóm (ca × thứ), tuỳ chọn xoá/ bỏ qua lễ; ghi ngay | Xếp ca | P1 | CONFIRMED (form); ghi ngay INFERRED |
| SCH-09 | Công cụ | Chép tuần trước | Xác nhận (N người, M ca), chép vào lưới chưa lưu | Xếp ca | P1 | CONFIRMED (đã thử, đã huỷ) |
| SCH-10 | Công cụ | Mẫu tuần | Áp mẫu / Lưu tuần đang xem thành mẫu (đặt tên) | Xếp ca | P2 | CONFIRMED (form) |
| SCH-11 | Đăng ký | Banner đăng ký chờ nhận | "Tuần sau có N đăng ký…" + Xem tuần sau | Xếp ca | P1 | CONFIRMED |
| SCH-12 | Đăng ký | Nhận tất cả N / Nhận ✓ – Từ chối ✗ từng ô | Ghi luôn vào lịch; ✓✗ từng ô chỉ hiển thị trên lưới desktop | Xếp ca | P1 | CONFIRMED (hiển thị; chưa bấm) |
| SCH-16 | Độ phủ | Bảng "Số người mỗi ca" | Desktop: dưới lưới, hàng = ca, cột = ngày, số người, "+1 chờ" (đăng ký chờ), ô đỏ khi ngày đó không có ai cho ca mà ngày khác có; hàng "Tổng người có ca" | Xếp ca | P2 | CONFIRMED |
| SCH-13 | Hiển thị | Ca cố định mặc định | Ô viền đứt; "Cố định TV2 · tuần 12 giờ" | Xếp ca | P1 | CONFIRMED |
| SCH-14 | Hiển thị | Tổng giờ tuần / người | "Linh hoạt · tuần 45 giờ" | Xếp ca | P2 | CONFIRMED |
| SCH-15 | Hiển thị | Số người / ngày, số người / ca | Chip ngày "6 người"; "CA1 1 người" | Xếp ca | P2 | CONFIRMED |

## F. Lương (`/app/luong`)

| ID | Nhóm | Tên chức năng | Mô tả | Trang | Ưu tiên | Kiểm chứng |
|---|---|---|---|---|---|---|
| PAY-01 | Tổng quan | Thẻ kỳ lương | Quỹ lương dự kiến, trạng thái công bố, tiến độ x/N người sẵn sàng | Lương | P0 | CONFIRMED |
| PAY-02 | Tổng quan | 4 thẻ phụ | OT đã duyệt, OT chờ duyệt, Ngày công cần xử lý (Mở Hộp việc), Thưởng/phạt nhập tay | Lương | P1 | CONFIRMED |
| PAY-03 | Danh sách | Danh sách NV + lọc/sắp xếp | Tìm, chip trạng thái, vị trí, kiểu lương, sắp xếp | Lương | P1 | CONFIRMED |
| PAY-04 | Sao kê | Sao kê một người | KPI, "Vì sao ra số này", OT chờ (dự phóng), Thưởng/phạt, Từng ngày | Lương | P0 | CONFIRMED |
| PAY-05 | Điều chỉnh | Thêm thưởng/phạt | NV, loại, số tiền (nút nhanh), lý do; validation | Lương | P1 | CONFIRMED (validation) |
| PAY-06 | Công bố | Công bố phiếu lương | Hộp xác nhận cảnh báo việc tồn; đóng băng | Lương | P0 | CONFIRMED (đã mở, đã huỷ) |
| PAY-07 | Công bố | Công bố lại / Huỷ công bố | Sau khi sửa | Lương | P1 | INFERRED (hướng dẫn) |
| PAY-08 | Xuất | In phiếu (PDF) | In / lưu PDF | Lương | P1 | INFERRED |
| PAY-09 | Xuất | Xuất Excel bảng lương | | Lương | P1 | INFERRED |
| PAY-10 | Cấu hình | Bật/tắt tính lương | Ở Cài đặt; tắt thì ẩn mục Lương | Cài đặt | P2 | CONFIRMED (công tắc) |

## G. Nhân sự (`/app/nhan-su`)

| ID | Nhóm | Tên chức năng | Mô tả | Trang | Ưu tiên | Kiểm chứng |
|---|---|---|---|---|---|---|
| STF-01 | Danh sách | Danh sách NV | Avatar chữ cái, tên, badge quyền, vị trí·bậc, kiểu ca, ca | Nhân sự | P0 | CONFIRMED |
| STF-02 | Lọc | Tìm + vị trí + trạng thái | Đang làm / Đã nghỉ / Tất cả (có đếm) | Nhân sự | P1 | CONFIRMED |
| STF-03 | CRUD | Thêm nhân viên | Drawer form đầy đủ | Nhân sự | P0 | CONFIRMED (validation) |
| STF-04 | CRUD | Sửa hồ sơ | Cùng form + Mở khoá máy, Xoá | Nhân sự | P0 | CONFIRMED |
| STF-05 | CRUD | Xoá nhân viên | Xác nhận kèm số liệu, gợi ý chuyển "Đã nghỉ" | Nhân sự | P1 | CONFIRMED (đã huỷ) |
| STF-06 | Mã PIN | Tạo mã PIN | 4–8 chữ số, nút Tạo mã, ẩn/hiện | Nhân sự | P0 | CONFIRMED |
| STF-07 | Ghi đè | Lương riêng / Ca riêng / Địa điểm riêng | Công tắc ghi đè cấu hình vị trí | Nhân sự | P1 | CONFIRMED |
| STF-08 | Quyền | Quản lý trực tiếp + 4 cấp quyền | | Nhân sự | P0 | CONFIRMED |
| STF-09 | Ảnh | Chụp ảnh khi chấm (Theo công ty/Bắt buộc/Miễn) | | Nhân sự | P2 | CONFIRMED |
| STF-10 | Hàng loạt | Thêm hàng loạt | Dán "Họ tên, email, vị trí"; preview, khớp vị trí không dấu, báo lỗi dòng | Nhân sự | P1 | CONFIRMED |
| STF-11 | Mời | Gửi link cài app | QR, link có mã công ty, chép/tải QR, tin nhắn mẫu từng người (kèm PIN), chép cho cả N người | Nhân sự | P1 | CONFIRMED |
| STF-12 | Mời | Chép tin mời 1 người | Trong drawer hồ sơ | Nhân sự | P2 | CONFIRMED |

## H. Vị trí & ca (`/app/vi-tri`)

| ID | Nhóm | Tên chức năng | Mô tả | Trang | Ưu tiên | Kiểm chứng |
|---|---|---|---|---|---|---|
| POS-01 | Vị trí | Thẻ vị trí | Tên, kiểu lương·kiểu ca, số người, mức lương, ca, ngày, địa điểm | Vị trí | P0 | CONFIRMED |
| POS-02 | Vị trí | Thêm vị trí trống / từ mẫu ngành | Dropdown + modal mẫu (đánh dấu "Đã có") | Vị trí | P1 | CONFIRMED |
| POS-03 | Vị trí | Sửa vị trí | Drawer: ca & ngày, địa điểm, lương, bậc, phụ cấp, thưởng cố định, phạt & BHXH, hệ số OT, miễn chụp ảnh, ghi chú | Vị trí | P0 | CONFIRMED |
| POS-04 | Vị trí | Nhân bản / Xem người giữ / Xoá | Menu "…" | Vị trí | P2 | CONFIRMED (menu) |
| SHF-01 | Ca | Thư viện ca | Thẻ ca: mã, tên, giờ, cách tính, ngưỡng, vị trí dùng | Ca & ngày lễ | P0 | CONFIRMED |
| SHF-02 | Ca | Thêm/sửa/xoá ca | Form ca đầy đủ; mã không sửa được | Ca & ngày lễ | P0 | CONFIRMED |
| SHF-03 | Ca | Thêm từ thư viện mẫu | HC, HC8, DEM (qua đêm), LH, DAY_S/C/T | Ca & ngày lễ | P2 | CONFIRMED |
| HOL-01 | Ngày lễ | Danh sách ngày lễ | Ngày, thứ, năm, tên, "đã qua" | Ca & ngày lễ | P1 | CONFIRMED |
| HOL-02 | Ngày lễ | Thêm ngày lễ VN năm sau / Thêm tay | | Ca & ngày lễ | P1 | CONFIRMED (nút) |

## I. Địa điểm (`/app/dia-diem`)

| ID | Nhóm | Tên chức năng | Mô tả | Trang | Ưu tiên | Kiểm chứng |
|---|---|---|---|---|---|---|
| LOC-01 | Bản đồ | Bản đồ vùng chấm công | Tất cả vòng địa điểm | Địa điểm | P1 | CONFIRMED |
| LOC-02 | CRUD | Danh sách địa điểm | Tên, địa chỉ, bán kính, số người, vị trí; Xem/Sửa/Xoá | Địa điểm | P0 | CONFIRMED |
| LOC-03 | CRUD | Thêm/sửa địa điểm | Lấy vị trí hiện tại (5 lần lấy trung bình), dán link Google Maps / địa chỉ + Tìm, ghim kéo, bán kính 30–500m, toạ độ tự điền, vị trí được chấm | Địa điểm | P0 | CONFIRMED (form) |
| LOC-04 | Gợi ý | Gợi ý từ lần chấm thật | So 30 ngày, ≥5 lần chấm lệch/sát mép → đề xuất dời ghim/nới bán kính | Địa điểm | P2 | CONFIRMED (empty state) |

## J. Cài đặt (`/app/cai-dat`)

| ID | Nhóm | Tên chức năng | Mô tả | Trang | Ưu tiên | Kiểm chứng |
|---|---|---|---|---|---|---|
| SET-01 | Công ty | Thông tin công ty | Tên, địa chỉ, tên app, logo (tải lên / link), mã công ty + chép link | Cài đặt | P0 | CONFIRMED |
| SET-02 | Tích hợp | Google Sheet dữ liệu | Hiển thị (gắn khi kích hoạt; muốn đổi phải nhắn WORKSHEET) | Cài đặt | P0 | CONFIRMED (demo: không dùng Sheet thật) |
| SET-03 | Tích hợp | Thư mục Google Drive ảnh | Dán link + Kiểm tra | Cài đặt | P1 | CONFIRMED (form) |
| SET-04 | Thương hiệu | Màu chủ đạo | 9 màu + màu khác (hex), xem trước toàn hệ thống + preview app NV | Cài đặt | P2 | CONFIRMED |
| SET-05 | Quy tắc | Ngày làm việc trong tuần | | Cài đặt | P0 | CONFIRMED |
| SET-06 | Quy tắc | Cách tính muộn | Tính cả số phút muộn / Chỉ tính phần vượt | Cài đặt | P0 | CONFIRMED |
| SET-07 | Quy tắc | OT | Tính OT khi đến sớm; Tự xác nhận OT theo đơn; phút tối thiểu | Cài đặt | P0 | CONFIRMED |
| SET-08 | Quy tắc | Bắt buộc chụp ảnh | | Cài đặt | P1 | CONFIRMED |
| SET-09 | Quy tắc | Ngày chốt kỳ lương | Trống = tròn tháng | Cài đặt | P1 | CONFIRMED |
| SET-10 | Dữ liệu | Nhập hàng loạt từ Excel/JSON | | Cài đặt | P2 | INFERRED |
| SET-11 | Dữ liệu | Kiểm tra dữ liệu (health check Sheet) | Quét, có nút Sửa tự động | Cài đặt | P2 | INFERRED |
| SET-12 | Lưu | Thanh lưu cài đặt | "N thay đổi chưa lưu · Huỷ · Lưu cài đặt" | Cài đặt | P0 | CONFIRMED |
| SET-13 | Bật tắt | Tính lương | Đang dùng chấm công + tính lương | Cài đặt | P1 | CONFIRMED |

## K. Tiện ích chung

| ID | Nhóm | Tên chức năng | Mô tả | Trang | Ưu tiên | Kiểm chứng |
|---|---|---|---|---|---|---|
| GEN-01 | Tìm kiếm | Tìm nhanh (Ctrl/⌘+K) | Trang, NV (bảng công/hồ sơ), ngày "15/9"; empty state | toàn app | P1 | CONFIRMED |
| GEN-02 | Onboarding | Thiết lập nhanh 4 bước | Ngành → Vị trí & ca → Địa điểm → Nhân viên | modal | P1 | CONFIRMED (không hoàn tất) |
| GEN-03 | Onboarding | Tour coach-mark | Theo trang, Bỏ qua/Quay lại/Tiếp/Đã hiểu | trang thiết lập | P2 | CONFIRMED |
| GEN-04 | Onboarding | Nút "?" xem lại hướng dẫn trang | | header | P2 | CONFIRMED |
| GEN-05 | Điều hướng | Thu gọn / Mở rộng menu | Desktop: sidebar 205px ↔ 65px (chỉ icon) | sidebar | P2 | CONFIRMED |
| GEN-06 | Phản hồi | Toast | "Đã duyệt 1 ô.", "Đã chép 45 ca…" | toàn app | P1 | CONFIRMED |
| GEN-07 | Trạng thái | Skeleton loading | Thẻ & danh sách xám khi tải | toàn app | P2 | CONFIRMED |
| GEN-08 | Hỗ trợ | Hướng dẫn sử dụng, Báo lỗi & góp ý | Tab mới; Google Form | menu | P2 | CONFIRMED |

## L. App nhân viên (`/m/`)

| ID | Nhóm | Tên chức năng | Mô tả | Trang | Ưu tiên | Kiểm chứng |
|---|---|---|---|---|---|---|
| EMP-01 | Chấm công | Thẻ ca hôm nay | Tên ca, giờ, địa điểm; "Ca bạn chọn (ngoài lịch)" | #/ | P0 | CONFIRMED |
| EMP-02 | Chấm công | Trạng thái định vị | Trong vùng · khoảng cách / lỗi quyền + hướng dẫn + "Bật định vị" + mã lỗi | #/ | P0 | CONFIRMED (trạng thái lỗi) |
| EMP-03 | Chấm công | Chọn ca bạn làm | Chip ca (NV linh hoạt) | #/ | P1 | CONFIRMED |
| EMP-04 | Chấm công | Đồng hồ + nút VÀO CA / RA CA | Nút tròn lớn | #/ | P0 | CONFIRMED (UI); xử lý INFERRED |
| EMP-05 | Chấm công | Chụp ảnh khi chấm | Khung tròn, "Chụp và gửi" | #/ | P1 | INFERRED |
| EMP-06 | Chấm công | Ghi chú khi chấm | "Thêm ghi chú (không bắt buộc)" | #/ | P2 | CONFIRMED |
| EMP-07 | Chấm công | Timeline hôm nay + cảnh báo quá giờ | "Đã quá giờ vào ca 2 giờ 45" | #/ | P1 | CONFIRMED |
| EMP-08 | Chấm công | Thẻ kết quả sau chấm + Gửi giải trình | | #/ | P1 | INFERRED |
| EMP-09 | Lịch & công | Bảng công tháng | KPI, lịch có chấm màu, chi tiết ngày | #/lich | P0 | CONFIRMED |
| EMP-10 | Lịch & công | Gửi giải trình | Bottom sheet, "Hệ thống ghi nhận", lý do + chọn nhanh, lưu nháp | #/lich | P1 | CONFIRMED (validation) |
| EMP-11 | Lịch & công | Lịch ca tuần này/tuần sau | Thanh giờ theo ngày | #/lich | P0 | CONFIRMED |
| EMP-12 | Lịch & công | Đăng ký ca tuần sau | Lưới ca × ngày, trạng thái Bạn chọn/Đã gửi/Đã xếp, Gửi đăng ký | #/lich | P0 | CONFIRMED |
| EMP-13 | Đơn | Tạo đơn 6 loại | Nghỉ phép, Muộn/sớm, Làm thêm, Đổi ca, Đăng ký ca, Quên chấm | sheet | P0 | CONFIRMED (form) |
| EMP-14 | Đơn | Kiểm tra số ngày phép | Không gửi được nếu vượt | sheet | P1 | CONFIRMED (hiển thị) / INFERRED (chặn) |
| EMP-15 | Lương | Danh sách phiếu theo năm | Trạng thái Đang tính / Đã công bố | #/luong | P0 | CONFIRMED |
| EMP-16 | Lương | Phiếu lương | KPI, thu nhập, khấu trừ, thực lĩnh, chi tiết ngày công | #/luong | P0 | CONFIRMED |
| EMP-17 | Tôi | Hồ sơ, phép còn lại, thông báo, Đơn của tôi | | #/toi | P1 | CONFIRMED |
| EMP-18 | Tôi | Hướng dẫn cài lên màn hình chính | Tab iPhone/Android | #/toi | P2 | CONFIRMED |
| EMP-19 | Tôi | Đăng xuất | | #/toi | P0 | CONFIRMED (nút) |
| EMP-20 | PWA | Manifest cài đặt | `/m/manifest.webmanifest` | /m | P2 | CONFIRMED |

**Tổng: 150+ chức năng** (bao gồm các tiện ích nhỏ).
