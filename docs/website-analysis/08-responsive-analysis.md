# 08. Phân tích Responsive

## 1. Phương pháp
- Kiểm tra trên trình duyệt với viewport giả lập: **1440×900** (desktop), **1024×768**, **992×768**, **900×768**, **~800×1275** (khung trình duyệt mặc định), **375×812** (mobile, giả lập UA Android). (CONFIRMED)
- CSS có các media query chuẩn Ant Design: `575/576`, `767/768`, `991/992`, `1199/1200`, `1600` px và `prefers-reduced-motion`. (CONFIRMED — đọc từ stylesheet)

## 2. Breakpoint chính của trang quản trị

| Độ rộng | Navigation | Kết quả đo | Kiểm chứng |
|---|---|---|---|
| ≥ 992px | **Sidebar trái 205px**, không bottom nav | 992 & 1024 & 1440: sidebar hiển thị | CONFIRMED |
| < 992px | **Bottom nav 5 mục** + drawer "Thêm" | 900 & 800 & 375: bottom nav, không sidebar | CONFIRMED |
| Ngưỡng chính xác | trong khoảng 901–992px; khớp `lg = 992px` của Ant Design | | INFERRED |

=> Trang quản trị chỉ có **2 bố cục**: Desktop (≥992) và Compact (<992, dùng chung cho tablet & mobile). Tablet dọc 768px dùng bố cục mobile. (CONFIRMED với 768–900)

## 3. Desktop (≥ 992px)

| Khu vực | Hành vi |
|---|---|
| Navigation | Sidebar cố định full chiều cao (thẻ công ty, menu chính, nhóm THIẾT LẬP, mục phụ, thẻ dùng thử, "Thu gọn menu") |
| Header | Dải gradient; tiêu đề trái; **ô tìm kiếm dạng thanh** "Tìm nhân viên, ngày, việc… Ctrl K" + avatar phải |
| Hộp việc | KPI 4 cột **có sparkline**; **master–detail** trong cùng card (danh sách ~1/3 trái, chi tiết phải); có "Chọn tất cả" |
| Lương | Thẻ kỳ lương + lưới 2×2 thẻ phụ cùng hàng; **master–detail** (danh sách NV trái, sao kê phải); chọn kỳ có segmented `Tháng | Kỳ lệch | Tự chọn` ngay trên header |
| Xếp ca | **Lưới đầy đủ người × 7 ngày** với palette ca dạng thẻ ở trên ("chế độ cọ"), legend (Ca cố định · Đăng ký từ app · Chưa lưu), cột "Hôm nay" tô nền; dòng mô tả nhóm vị trí |
| Bảng công | Lưới hiển thị được nhiều ngày hơn (vẫn cuộn ngang khi cần) — INFERRED |
| Drawer | Trượt từ phải (ước lượng) |
| Đăng nhập | 2 cột: panel thương hiệu trái full-height, form phải |

## 4. Compact — Tablet & Mobile (< 992px)

| Khu vực | Thay đổi so với desktop | Kiểm chứng |
|---|---|---|
| Navigation | Sidebar ẩn → **bottom nav** `Hộp việc (badge) · Điều phối · Bảng công · Xếp ca · Thêm`; "Thêm" mở **drawer trái** chứa toàn bộ menu desktop | CONFIRMED |
| Header | Ô tìm kiếm thu thành **nút tròn kính lúp**; phụ đề có thể xuống dòng | CONFIRMED |
| KPI | Lưới **2×2**, không sparkline | CONFIRMED |
| Hộp việc | Chỉ danh sách; chi tiết mở **drawer từ dưới** gần full màn hình; nút "Duyệt" ngay trên từng dòng | CONFIRMED |
| Chip lọc | Cuộn ngang | CONFIRMED |
| Bảng công | Lưới cuộn ngang, cột tên sticky; nút điều hướng kỳ tròn; drawer full-width | CONFIRMED |
| Xếp ca | Segmented **"Xếp theo người" / "Xếp theo ngày"**; theo người = thẻ mỗi người + dải 7 ô + "Xếp ›" mở drawer chọn ca; theo ngày = palette chip + chip 7 ngày + danh sách người | CONFIRMED |
| Lương | Thẻ xếp dọc; danh sách NV; sao kê mở drawer | CONFIRMED |
| Nút công cụ header | Xuống nhiều hàng (Rải lịch / Chép tuần trước / Mẫu tuần) | CONFIRMED |
| Form drawer | Lưới 2 cột ở ~800px (vd Họ tên | Email), 1 cột ở 375px (INFERRED) | CONFIRMED 800 |
| Modal | Gần full width, bo góc, cuộn trong | CONFIRMED |
| Sticky bar | Nổi trên bottom nav (vd "18 ô chưa lưu") | CONFIRMED |

### Vấn đề responsive quan sát được
1. **Thanh lưu Cài đặt chồng lên bottom nav** ở ~800px: bấm "Huỷ" trên thanh đã kích hoạt mục "Bảng công" phía dưới → điều hướng ngoài ý muốn. (CONFIRMED)
2. **Ô đăng ký ca không hiển thị** trên lưới "Xếp theo người" (layout compact) của tuần có đăng ký chờ — banner nói "ô viền đứt xanh" nhưng ô trống; đăng ký chỉ thấy trong drawer người. Ở desktop cùng tuần, ô đăng ký hiển thị đúng kèm nút ✓/✕. (CONFIRMED cả hai)

### Chức năng chỉ có ở desktop
| Chức năng | Ghi chú | Kiểm chứng |
|---|---|---|
| Bảng "Số người mỗi ca" (độ phủ ca) dưới lưới Xếp ca | Không thấy ở compact | CONFIRMED |
| Nhận/Từ chối từng ô đăng ký ca (✓/✕) | Compact chỉ có "Nhận tất cả" | CONFIRMED |
| Sparkline KPI, "Chọn tất cả" ở Hộp việc | | CONFIRMED |
| Thu gọn menu (sidebar 205px → 65px chỉ icon, nút đổi thành "Mở rộng menu") | | CONFIRMED |
| Ô tìm kiếm dạng thanh có nhãn "Ctrl K" | Compact: nút kính lúp | CONFIRMED |
3. Thanh "N ô chưa lưu" bị bottom nav che một phần khi chưa cuộn tới cuối danh sách (chỉ thấy viền vàng). (CONFIRMED)

## 5. App nhân viên `/m/`
- **Mobile-first**: một cột, khung nội dung giới hạn chiều rộng và căn giữa trên màn rộng (quan sát ở ~800px: khung ~700px có lề hai bên) — chiều rộng tối đa chính xác UNKNOWN. (CONFIRMED hành vi / ước lượng số)
- Bottom nav 5 mục với nút "+" nổi giữa. (CONFIRMED)
- Form dạng **bottom sheet** (Tạo đơn, Giải trình, Phiếu lương). (CONFIRMED)
- PWA: manifest `/m/manifest.webmanifest`, hướng dẫn "Cài lên màn hình chính" iPhone (Safari → Chia sẻ → Thêm vào MH chính) / Android (Chrome → ⋮ → Thêm vào màn hình chính). (CONFIRMED)
- Không thấy service worker điều khiển trang (`navigator.serviceWorker.controller` = null) → không có offline (INFERRED). (CONFIRMED giá trị)

## 6. Trang hướng dẫn `/huong-dan/`
- Trang tài liệu tĩnh dài, có mục lục đánh số 1–14, ảnh chụp màn hình minh hoạ, FAQ dạng `<details>` thu gọn, tab "Quản trị / Nhân viên". (CONFIRMED)

## 7. Thao tác theo thiết bị

| Thao tác | Desktop | Mobile |
|---|---|---|
| Tìm nhanh | Ctrl/⌘+K hoặc thanh tìm | Nút kính lúp |
| Duyệt việc | Chọn dòng → chi tiết bên phải, phím J/K/A/E | Nút Duyệt trên dòng / mở drawer |
| Xếp ca | Chọn ca palette → bấm/kéo ô | Drawer người hoặc chế độ theo ngày |
| Xem lương | Master–detail | Danh sách → drawer |
| Thu gọn menu | Có | Không áp dụng |
