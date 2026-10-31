# 05. Đặc tả giao diện (UI/UX Specifications)

> Thông số đo bằng `getComputedStyle` trên trình duyệt ở viewport 1440×900 và ~800px (CONFIRMED khi ghi "đo được"). Kích thước khung/khoảng cách không đo trực tiếp được đánh dấu **(ước lượng)**. Màu chủ đạo của demo nhà hàng là nâu `#7B5236`; mọi màu "brand" bên dưới sẽ đổi theo màu công ty chọn ở Cài đặt.

## 1. Design Tokens

### 1.1. Màu
| Token | Giá trị | Mục đích | Nguồn |
|---|---|---|---|
| `--brand` | `#7B5236` (demo FnB); mặc định sản phẩm `#2F9A4C` | Nút chính, tab active, ô "Đủ công", ghim bản đồ, header | đo được |
| `--brand-dark` | `#60402A` | Điểm cuối gradient header | đo được |
| `--header-gradient` | `linear-gradient(120deg, brand 0%, brand-dark 100%)` | Dải header mọi trang, panel đăng nhập | đo được |
| `--brand-soft` | `#F2EEEB` (nâu rất nhạt) | Nền nav active, nền tổng thực lĩnh | đo được |
| `--bg-app` | `#EEF3F0` | Nền trang | đo được |
| `--surface` | `#FFFFFF` | Card, sidebar, drawer | đo được |
| `--text` | `#17201B` | Chữ chính | đo được |
| `--text-muted` | `#65706A` | Nhãn KPI, phụ đề | đo được |
| `--border` | `#DFE6E1` | Viền nút phụ, input | đo được |
| `--stripe-a / --stripe-b` | `#E3EBE6` / `#F2F6F3` (sọc 135°, 6px) | Khung ca trên timeline | đo được |
| `--danger-bg / --danger` | `#FDEAEA` / `#B42323` | Tag Vắng, Thiếu giờ, Ngoài vùng, badge số | đo được |
| `--warn-bg / --warn` | `#FFF3D9` / `#8A5200` | Tag Sai ca, số "Đi muộn", ô M | đo được |
| `--ot-bg / --ot` | `#F1EAFB` / `#6A37B5` | Tag OT, OT chờ, thanh sau ca | đo được |
| `--info-bg / --info` | `#EAF0FD` / `#3B63C4` | Tag Đăng ký ca, Đơn nghỉ, "Sắp vào ca", banner đăng ký | đo được |
| `--success` | xanh lá (~`#2F9A4C`) | Pill "Đề xuất: …", "Sẵn sàng", nút Duyệt nhanh nền xanh nhạt | ước lượng |
| `--danger-kpi` | đỏ đậm (~`#B42323`) | Số "Chưa chấm công", "Cần duyệt" | ước lượng |
| `--chip-active` | `#17201B` nền / trắng chữ | Chip lọc đang chọn | quan sát |
| Brand presets | `#2F9A4C #1E8E5A #0E7C86 #3B63C4 #214098 #6A37B5 #BE185D #B4532A #334155` | Bảng màu Cài đặt | đo được |
| Màu mã ca | CA1 xanh dương nhạt; CA2 cam/vàng nhạt; SANG tím nhạt; CHIEU xanh ngọc nhạt; TOI hồng nhạt; TV2 xanh lá nhạt | Chip ca ở Xếp ca | quan sát (ước lượng mã) |
| Upsell | xanh lá `#2F9A4C` cố định | Nút "Chọn gói", thẻ "Dùng cho công ty bạn" | quan sát |

### 1.2. Typography
| Token | Giá trị | Mục đích | Nguồn |
|---|---|---|---|
| `font-family` | "Be Vietnam Pro", system-ui, sans-serif (Google Fonts 400/500/600/700/800) | Toàn bộ | đo được |
| `fs-base` | 14px / lh 22px | Thân, nav | đo được |
| `fs-page-title` | 22px / 700 (trắng, trên header) | "Chào buổi sáng, Hà", "Xếp ca" | đo được |
| `fs-detail-title` | 21px / 700 | Tiêu đề panel chi tiết | đo được |
| `fs-kpi` | 30px / 800 | Số KPI | đo được |
| `fs-money-xl` | ~36–40px / 800 | "44.973.304đ" | ước lượng |
| `fs-label` | 12.5px / 400, màu muted | Nhãn KPI | đo được |
| `fs-tag` | 11.5px / 700 | Tag trạng thái | đo được |
| `fs-button` | 16px / 600 (nút chi tiết); 14px trên nút nhỏ | Nút | đo được / ước lượng |
| `fs-time-big` | ~32px / 800 | "13:59", "23:36" | ước lượng |
| `fs-clock` (app NV) | ~64px / 800 | Đồng hồ chấm công | ước lượng |

### 1.3. Hình khối & khoảng cách
| Token | Giá trị | Mục đích | Nguồn |
|---|---|---|---|
| `radius-card` | 18px | Card KPI, panel | đo được |
| `radius-lg` | 14px | Ô nhóm, khối trong drawer | đo được |
| `radius-md` | 10px | Input, khối nhỏ | đo được |
| `radius-sm` | 8px / 6px / 4px | Ô lưới công, chip mã ca | đo được |
| `radius-pill` | 999px | Nút, tag, chip | đo được |
| `radius-avatar` | 50% | Avatar chữ cái | đo được |
| `shadow-card` | `0 1px 2px rgba(23,40,30,.05), 0 6px 20px rgba(23,40,30,.06)` | Card | đo được |
| `pad-card` | 16px 18px | Card KPI | đo được |
| `pad-sidebar` | 18px 12px | Sidebar | đo được |
| `btn-h` | 45px (nút lớn), ~36px (nút thường) | Nút | đo được / ước lượng |
| `btn-pad` | ~10.75px 15px | Nút lớn | đo được |
| `tag-pad` | 3px 10px | Tag | đo được |
| `gap-grid` | ~16px giữa card | Lưới KPI | ước lượng |
| `page-gutter` | 27px desktop (232−205), ~18px mobile | Lề nội dung | đo được / ước lượng |
| `sidebar-w` | 205px (thu gọn: 65px) | Sidebar desktop | đo được |
| `bottom-nav-h` | ~70px | Thanh dưới mobile | ước lượng |
| `header-band-h` | ~160–230px (tràn dưới thẻ đầu) | Dải gradient | ước lượng |

### 1.4. Chuyển động
| Token | Giá trị | Nguồn |
|---|---|---|
| `transition-default` | `0.2s cubic-bezier(0.645, 0.045, 0.355, 1)` (chuẩn Ant Design) | đo được |
| `transition-color` | `color .3s` | đo được |
| Drawer | trượt từ dưới (mobile) / phải (desktop), có mask tối | quan sát |
| Toast | hiện giữa trên, nền trắng, icon check màu brand, tự ẩn | quan sát |
| Skeleton | thanh xám bo tròn | quan sát |
| `prefers-reduced-motion` | có media query | đo được |

## 2. Thành phần dùng chung (Component Library)

| Component | Mô tả | States |
|---|---|---|
| **Header band** | Gradient brand, tiêu đề trắng 22px + phụ đề trắng mờ; phải: ô tìm (desktop, bo pill, nền trắng trong suốt, gợi ý "Tìm nhân viên, ngày, việc…" + kbd "Ctrl K") hoặc nút tròn kính lúp (mobile); nút "?" tròn (trang thiết lập); avatar tròn trắng chữ "TH" | — |
| **Sidebar** | Thẻ công ty (logo vuông bo, tên, "Dữ liệu dùng thử"); item icon + nhãn 14px; item active nền brand-soft bo 10px; badge đỏ số; nhãn nhóm "THIẾT LẬP" in hoa xám; footer mục phụ; thẻ dùng thử vàng nhạt chứa nút xanh; "Thu gọn menu" | default, hover (nền xám nhạt — ước lượng), active |
| **Bottom nav** | 5 mục icon trên nhãn; active: icon trong pill nền brand-soft + nhãn đậm; badge đỏ trên icon Hộp việc | default, active |
| **KPI card** | Nhãn muted, số lớn màu theo ngữ nghĩa, phụ chú nhỏ; desktop có sparkline | loading skeleton |
| **Chip filter** | Pill viền xám, nhãn + số xám; active nền đen chữ trắng | default, active |
| **Segmented control** | Nền xám nhạt bo pill, ô active trắng có bóng | — |
| **Tag trạng thái** | Pill 11.5px/700 theo bảng màu ngữ nghĩa | — |
| **Button primary** | Nền brand, chữ trắng 600, bo pill, có icon trái; kbd hint (ô "A" viền trắng) | hover, loading (spinner chấm, mờ), disabled (xám, chữ mờ) |
| **Button default** | Nền trắng, viền `#DFE6E1`, bo pill | hover, disabled |
| **Button text** | "Để sau", "Huỷ" (chỉ chữ đậm) | — |
| **Button quick-approve** | Pill nền xanh lá nhạt, chữ xanh "✓ Duyệt" | — |
| **Button danger** | Chữ đỏ + icon thùng rác; trạng thái "armed" nền hồng | — |
| **Checkbox tròn** | Ô tròn viền xám; chọn: nền brand + ✓ trắng | — |
| **Input** | Nền trắng, viền xám, bo ~10px, cao ~44px; hậu tố (addon) xám "phút", "đ", "m" | focus (viền brand), error (viền đỏ + chữ đỏ dưới) |
| **Timeline bar** | Thanh sọc khung ca + thanh màu có mặt (bo tròn đầu, có chấm tròn tại điểm vào), đoạn tím sau ca, đỏ ngoài vùng, vạch "bây giờ"; trục giờ dưới | — |
| **Map** | Leaflet, tile OSM, zoom +/−, nhãn địa điểm bo pill trắng, ghim brand, vòng bán kính nét đứt, cluster số | — |
| **Drawer** | Mobile: full-width trượt lên (tiêu đề + ✕ trái); Desktop: panel phải | open/close |
| **Bottom sheet** (app NV) | Thanh kéo xám trên cùng, tiêu đề + ✕ tròn phải | — |
| **Modal xác nhận** | Icon "!" cam tròn, tiêu đề đậm, mô tả, nút phải | — |
| **Sticky action bar** | Nổi đáy, bo 18px; loại sáng viền vàng (Xếp ca) hoặc tối (Duyệt loạt, Cài đặt) | — |
| **Toast** | Pill trắng bóng nhẹ, icon ✓ tròn brand, chữ đậm | — |
| **Coach mark** | Popover trắng bo 18px, "Hướng dẫn · bước x/n", chấm tiến trình, 2–3 nút | — |
| **Avatar chữ** | Tròn, nền xanh lá rất nhạt, 2 chữ cái xanh đậm | — |
| **Thẻ lựa chọn (radio card)** | Viền xám; chọn: viền brand 2px + nền brand-soft + radio đặc | — |
| **Switch** | Ant Switch, bật màu brand | — |

## 3. Đặc tả từng trang

### 3.1. Đăng nhập quản trị — `/app/`
- **Mục đích:** đăng nhập / vào demo.
- **Layout desktop:** 2 cột ~52/48; trái gradient brand full-height (logo "WS" + "E-HRM Pro · WORKSHEET" trên; slogan 28px/800 trắng ở giữa; "worksheet.vn" dưới); phải nền `#EEF3F0`, thẻ form trắng ~420px bo 18px căn giữa.
- **Mobile:** panel trên cao ~470px, thẻ form chồng xuống dưới.
- **Thành phần:** tiêu đề "Đăng nhập quản trị", phụ "Dùng email và mã PIN được cấp.", 3 input, nút primary full width, divider "Chưa có tài khoản?", 2 nút viền "Xem dữ liệu mẫu" / "Thử công ty mới", link xanh "Xem hướng dẫn sử dụng".
- **Lưu ý:** màu panel lấy từ màu thương hiệu đã lưu trên máy (`ehrm2_brand`) — tab mới vẫn nâu sau khi đã dùng demo nhà hàng. (CONFIRMED)

### 3.2. Chọn ngành mẫu — `/app/?demo=1`
- Header nhỏ logo + "E-HRM Pro · Dùng thử"; H1 "Công ty bạn thuộc ngành nào?"; đoạn mô tả; lưới thẻ 2 cột (mobile vẫn 2 cột ở 800px) — thẻ trắng bo 18px: icon trong ô vuông xanh nhạt, tên đậm, mô tả, link xanh "Xem mẫu: … →"; footer link.

### 3.3. Hộp việc — `/app/`
- **Header:** "Chào buổi sáng, Hà" + "Thứ Bảy, 31/10 · 3 người có ca lúc này".
- **Khu KPI:** desktop 4 cột (285×142px mỗi thẻ, có sparkline); mobile 2×2.
- **Panel "Cần bạn xử lý":** card trắng bo 18px; header (tiêu đề + đếm đỏ + kỳ "01/10/2026 – 31/10/2026" ở desktop; nút làm mới tròn; nút bulk); hàng chip cuộn ngang; desktop: cột danh sách ~205px+… (≈36%) cuộn độc lập + đường kẻ dọc + chi tiết (≈64%); mobile: danh sách full.
- **Dòng việc:** padding ~18px, kẻ ngang giữa các dòng; dòng chọn có vạch trái đen (desktop).
- **Chi tiết:** xem 04 INB-09.
- **Responsive:** <992px chi tiết mở drawer từ dưới chiếm ~92% chiều cao, tiêu đề drawer là tên NV.

### 3.4. Điều phối — `/app/dieu-phoi`
- Header + chip địa điểm (pill trắng active, pill trong suốt viền trắng mờ khác).
- Lưới KPI 2 cột (mobile) / hàng (desktop — ước lượng), thẻ "Chấm ngoài vùng" chiếm full hàng ở mobile.
- Card bản đồ (cao ~330px) với legend chấm màu trên phải.
- Card "Cần để ý ngay" + "Sắp vào ca (6 giờ tới)".
- Card "Dòng thời gian ca": cột tên ~170px cố định + vùng timeline cuộn; hàng cao ~60px.
- Card "Chấm công 24 giờ qua": danh sách.

### 3.5. Bảng công — `/app/bang-cong`
- Header: tiêu đề + phụ đề tổng; hàng điều hướng kỳ (nút tròn ‹ ›, nhãn giữa 2 dòng, dropdown loại kỳ pill trong suốt).
- Card chính: segmented "Lưới cả kỳ | Theo tuần" + nút làm mới; hàng lọc (tìm pill + select vị trí); hàng nút (Cần duyệt · N, Duyệt loạt, Excel); link "Xem chú thích màu" / legend 2 hàng; ghi chú phải "Bấm tên để xem…".
- Lưới: cột tên ~170px sticky; ô ngày ~30×30px (ước lượng) gap 4px; header ngày 2 dòng (thứ, số); cuộn ngang; cột tổng cố định phải (ước lượng).
- Theo tuần: chip tuần cuộn ngang; bảng cột ngày ~100px; chú thích dưới.

### 3.6. Xếp ca — `/app/xep-ca`
- Header: tiêu đề + "Tuần 26/10 – 01/11/2026"; điều hướng tuần (‹ nhãn 2 dòng ›, "Tuần này" khi lệch); hàng nút công cụ pill trong suốt viền trắng mờ (icon + nhãn).
- Desktop: palette ca dạng thẻ nhỏ (mã màu + tên + giờ), ca chọn viền xanh; legend phải; lưới full.
- Mobile: segmented 2 chế độ; danh sách nhóm.
- Thanh lưu nổi đáy khi có thay đổi.

### 3.7. Lương — `/app/luong`
- Header: tiêu đề + mô tả; điều hướng kỳ + nút "In phiếu", "Xuất Excel" (pill viền trắng).
- Desktop: hàng trên — thẻ kỳ lương lớn (≈1/3) + lưới 2×2 thẻ phụ; dưới — master–detail: danh sách NV (~300px) + sao kê.
- Mobile: thẻ xếp dọc; sao kê mở drawer.

### 3.8. Nhân sự — `/app/nhan-su`
- Card bộ lọc (tìm + select vị trí; segmented trạng thái; nút "Thêm" primary + nút "…" tròn).
- Danh sách thẻ người (avatar 40px, tên + badge quyền tím/vàng, vị trí · bậc, tag kiểu ca xanh dương + "N ca", mã ca xám nhỏ; chevron phải).
- Drawer form full chiều cao, footer cố định.

### 3.9. Vị trí & ca — `/app/vi-tri`
- Header + tab dạng pill có đếm ("Vị trí 5", "Ca & ngày lễ 6").
- Thanh tóm tắt "5 vị trí · 8 người theo vị trí" + "+ Thêm vị trí".
- Thẻ vị trí: tên 18px đậm + pill "👥 2 người"; mô tả kiểu; giá lớn ("10 – 12 triệu /tháng · 3 bậc lương"); khối xám chứa chip ca; hàng chip thứ; địa điểm có icon ghim; footer kẻ trên "Cả nhóm theo mẫu" + "✎ Sửa" + "…".
- Tab ca: thẻ ca (chip mã + tên + giờ + icon ca ghép; tag "Khung ca" xanh; dòng thông số; "Vị trí: …"; nút ✎ 🗑); khối ngày lễ.

### 3.10. Địa điểm — `/app/dia-diem`
- Header + nút "+ Thêm"; card bản đồ lớn; nhãn "◌ Vùng chấm công"; thẻ địa điểm (icon ghim trong ô, tên, địa chỉ, chip "Bán kính 60 m", "👥 3 người", chip vị trí; nút "⊕ Xem", "✎ Sửa", 🗑 đỏ); nút viền đứt "+ Thêm địa điểm"; card gợi ý.

### 3.11. Cài đặt — `/app/cai-dat`
- Các card section xếp dọc, mỗi card có tiêu đề icon; form 2 cột ở desktop (ước lượng), 1–2 cột ở mobile.

### 3.12. App nhân viên — `/m/`
- Khung nội dung tối đa ~560px căn giữa (ước lượng), nền `#EEF3F0`.
- Header gradient brand cao ~120px, thẻ đầu chồng lên.
- Bottom nav 5 mục, nút "+" tròn nâu nổi lên ở giữa.
- Màn chấm công: nút VÀO CA đường kính ~160px (ước lượng) với 2 vòng đồng tâm.
- Login: header xanh lá (màu mặc định sản phẩm) với icon vân tay; thẻ form; chip ngành; chip tài khoản nhanh.

## 4. Interaction tổng hợp

| Tương tác | Hành vi | Kiểm chứng |
|---|---|---|
| Hover nút/ dòng | Đổi nền nhẹ (Ant Design default) | INFERRED |
| Focus input | Viền màu brand | INFERRED (Ant) |
| Disabled | Nền xám nhạt, chữ xám (vd "Lưu duyệt", "Rải ô lịch", "Thêm") | CONFIRMED |
| Loading nút | Nút mờ + spinner chấm, nút cạnh bị disable | CONFIRMED |
| Phím tắt | J/K/A/E (Hộp việc), Ctrl/⌘+K | CONFIRMED (hiển thị) |
| Esc | Đóng search modal (CONFIRMED); drawer chi tiết không đóng bằng Esc trong lần thử (CONFIRMED) | |
| Click ngoài | Đóng dropdown | INFERRED |
| Kéo chọn ô | Xếp ca desktop | INFERRED |
| Auto-refresh | Điều phối mỗi phút | CONFIRMED (nhãn) |
| Optimistic/ reload | Sau thao tác: gọi lại inbox + overview | CONFIRMED |
| Live preview | Màu thương hiệu | CONFIRMED |
| Unsaved indicator | Chấm cam / thanh "N chưa lưu" | CONFIRMED |

## 5. Ghi chú UX (quan sát, không đề xuất thiết kế lại)
- Ngôn ngữ giao diện tiếng Việt thân thiện, câu giải thích đầy đủ trong mọi form (hint dưới từng trường). (CONFIRMED)
- Hầu hết thao tác nguy hiểm có xác nhận có nội dung cụ thể (số ca, số người, hậu quả). (CONFIRMED)
- Một số chỗ thiếu nhất quán đã ghi ở 04 & 08: thanh lưu chồng bottom nav ở ~800px; huỷ drawer vị trí/ rời trang cài đặt không cảnh báo; text "bấm Lưu" vs nút "Xong"; ô đăng ký ca không hiển thị trên lưới mobile.
