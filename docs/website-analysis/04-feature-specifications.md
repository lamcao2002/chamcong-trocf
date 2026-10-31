# 04. Đặc tả chức năng (Feature Specifications)

Mỗi đặc tả theo cấu trúc: Feature ID · Tên · Mục tiêu · Vị trí giao diện · Người dùng · Điều kiện · Input · Quy trình · Business Rules · Output · UI States · Error States · Edge Cases · Dependencies. Các chức năng nhỏ có liên quan được gộp vào đặc tả của chức năng cha (ghi rõ ID).

Nhãn kiểm chứng gắn sau từng mệnh đề quan trọng: **[C]** CONFIRMED · **[I]** INFERRED · **[U]** UNKNOWN.

---

## AUTH-01 · Đăng nhập quản trị

- **Mục tiêu:** Cho người có quyền quản trị vào `/app`.
- **Vị trí:** `/app/` khi chưa có phiên. Desktop: chia đôi, panel thương hiệu trái (gradient màu chủ đạo, slogan), thẻ form phải. Mobile: panel thương hiệu ở trên, thẻ form dưới. [C]
- **Người dùng:** Quản trị viên, Nhân sự, Quản lý nhóm. [C mô tả quyền]
- **Điều kiện:** Có Mã công ty (do WORKSHEET cấp), email và PIN. [C]
- **Input:** `Mã công ty` (placeholder "VD: SAOMAI"), `Email` (placeholder "ten@congty.vn"), `Mã PIN` (password, icon mắt ẩn/hiện). [C]
- **Quy trình:** Nhập → bấm "Đăng nhập" → `POST /api/v2/admin/login` → `POST /api/v2/admin/bootstrap` (tải cấu hình công ty, ca, vị trí, địa điểm, nhân viên) → vào Hộp việc. [C endpoint qua luồng demo; payload request U]
- **Business rules:** Phiên nhớ 14 ngày [I – hướng dẫn]. Token lưu localStorage theo mã công ty (`ehrm2_tok_admin_<MÃ>`) [C key]. Chỉ quyền ≠ "Chỉ dùng app" được vào [I].
- **Output:** Vào `/app/` với dữ liệu công ty.
- **UI States:** mặc định; đang gửi (nút loading) [I]; lỗi.
- **Error states:** sai thông tin / không có quyền → thông báo lỗi [U nội dung].
- **Edge cases:** mở tab mới ở `/app/` hiển thị lại màn đăng nhập dù localStorage có token demo [C — quan sát ở tab thứ 2]; cơ chế chọn token khi nhiều công ty [U].
- **Dependencies:** Nhân sự (quyền), Cài đặt (mã công ty).
- **Liên quan:** AUTH-02/03 (menu avatar: tên, "email · Quản trị viên", Đăng xuất) [C].

## DEMO-01/02 · Dữ liệu mẫu theo ngành

- **Mục tiêu:** Cho khách tiềm năng bấm thử ngay không cần đăng ký.
- **Vị trí:** Nút "Xem dữ liệu mẫu" trên form đăng nhập → `/app/?demo=1`. [C]
- **Input:** Chọn 1 trong 7 thẻ ngành (icon, tên, mô tả, "Xem mẫu: <tên công ty>"). [C]
- **Quy trình:** Bấm thẻ → `POST /api/v2/demo/info` (trả tên công ty, màu, ngành, admin, danh sách tài khoản NV mẫu) → `admin/login` → `bootstrap` → Hộp việc. [C]
- **Business rules:** Mỗi phiên demo tạo **công ty mẫu riêng** mã `DEMO-<NGÀNH>-<6 ký tự>` (đã thấy `DEMO-FNB-Y5XBSX` và `DEMO-FNB-XNB7JT` ở 2 tab) [C]. Dữ liệu 45 ngày, tự làm mới sau 6 giờ, không ảnh hưởng dữ liệu thật [C – văn bản]. Màu thương hiệu theo ngành (nhà hàng `#7b5236`) [C]. Người đăng nhập demo là quản trị viên "Nguyễn Thu Hà" [C].
- **Output:** Công ty mẫu "Cà phê Phố Nhỏ": 8 NV, 5 vị trí, 6 ca, 2 địa điểm, lịch, đơn từ, lương. [C]
- **UI States:** Skeleton khi tải Hộp việc ("đang tải…") [C].
- **Edge cases:** Thẻ dùng thử ở sidebar: "Đang dùng thử · dữ liệu tự làm mới sau 6 giờ", "Mở app nhân viên", "Xem mẫu ngành khác". [C]
- **Dependencies:** App nhân viên (`/m/?demo=<mã>`).

---

## INB-04…21 · Hộp việc

### INB-04 · Danh sách việc cần xử lý
- **Mục tiêu:** Gom mọi quyết định quản lý cần đưa ra trong kỳ vào một danh sách.
- **Vị trí:** Trang chủ `/app/`, khối "Cần bạn xử lý · N" (N đỏ) dưới 4 thẻ KPI. Desktop: danh sách trái (~33%) + chi tiết phải; mobile: danh sách full, chi tiết mở drawer. [C]
- **Người dùng:** Quản trị viên, Nhân sự, Quản lý nhóm (chỉ người mình quản lý [I]).
- **Input:** Kỳ hiện tại (`period` tháng 10/2026) [C].
- **Quy trình:** `POST /api/v2/admin/inbox` trả `period` và `items[]`. [C]
- **Cấu trúc item** [C]: `id` = `email|date|shiftCode`; `kind` ∈ {`ot`, `thieu_gio`, `vang`, `gps`, `sai_ca`, đơn từ…}; `title`; `evidence[]` (các dòng bằng chứng: "Vào 13:59", "Ra 23:38", "Giải trình: …"); `suggestion` {`label`, `ot` | `codes[]` như `duyet-log`, `duyet-gps`, `duyet-ca`}; `day` (bản ghi ngày công đầy đủ, xem 07-data-model).
- **Business rules:**
  - Việc được tạo khi ngày công có `needsReview = true` hoặc có đơn chờ duyệt. [C/I]
  - Loại "Vắng" không có đề xuất → không có nút Duyệt nhanh. [C]
  - Đơn đăng ký ca hiển thị nội dung "[Ca: SANG] Đăng ký từ app"; đơn nghỉ "[Nghỉ phép năm] Thi cuối kỳ" (tiền tố loại trong ngoặc vuông). [C]
- **Output:** Dòng: checkbox tròn · Tên (đậm) · ngày dạng "T7 24/10" (hoặc khoảng "04/11 → 04/11") · tag loại màu · tên ca · mô tả · pill đề xuất xanh "Đề xuất: duyệt 96 phút" · nút "✓ Duyệt". [C]
- **UI States:** loading skeleton; có dữ liệu; rỗng [U nội dung empty]; dòng đang chọn (viền/ nền nhấn ở desktop) [C].
- **Edge cases:** Một người nhiều việc cùng ngày khác ca → id khác nhau theo mã ca [C].

### INB-05 · Lọc theo loại
- Chip ngang cuộn được: `Tất cả 15 · OT đề xuất 3 · Thiếu giờ 1 · Vắng 1 · Ngoài vùng 1 · Sai ca 1 · Đơn nghỉ 1 · Đăng ký ca 7`. Chip active nền đen chữ trắng, các chip khác viền xám. Số đếm cập nhật sau mỗi lần duyệt; chip có 0 việc biến mất (Đơn nghỉ biến mất sau khi từ chối). [C]

### INB-07/14 · Duyệt theo đề xuất
- **Input:** item đã có `suggestion`.
- **Quy trình:** Bấm "Duyệt" trên dòng / nút chính "✓ Duyệt 96 phút [A]" trong chi tiết → `POST /api/v2/admin/approve` → response `{"success":true,"message":"Đã duyệt 1 ô."}` → gọi lại `inbox` + `overview`. [C]
- **Output:** Toast trên cùng "✓ Đã duyệt 1 ô."; item biến mất; chi tiết **tự chuyển sang việc kế tiếp**; số đếm KPI, chip, badge menu giảm. [C]
- **Business rules:** Đề xuất theo loại [C]: OT → duyệt số phút sau ca; Thiếu giờ (có giải trình) → "Duyệt 1 công"; Ngoài vùng → "Duyệt vị trí"; Sai ca → "Xác nhận ca <tên ca thực tế>".
- **Edge case quan sát:** Sau khi duyệt OT ngày 24/10 của Trần Đức Minh, Hộp việc không còn mục này nhưng sao kê Lương vẫn liệt kê 24/10 là "96p chờ" [C — mâu thuẫn dữ liệu, nguyên nhân U: có thể do cache/độ trễ đọc Sheet 1–2 phút theo hướng dẫn].

### INB-09…13 · Panel chi tiết việc
- **Header:** tag loại · tiêu đề lớn ("Trần Đức Minh ở lại 96 phút sau ca") · phụ đề "Quản lý ca · Ca 2 (14h–22h) 14:00 → 22:00 · Thứ Bảy, 24/10". [C]
- **Timeline bar:** trục giờ (bắt đầu ~1h trước ca, kết thúc sau giờ ra), thanh sọc chéo xám = khung ca (có khoảng nghỉ giữa ca màu nhạt hơn), thanh màu chủ đạo = thời gian có mặt, đoạn tím = sau ca. [C]
- **Số liệu:** Vào · Ra · Công · Sau ca (tím) · Ảnh chấm công (2 thumbnail). [C]
- **"Vì sao hệ thống đề xuất":** icon check xanh + câu giải thích ("Ra ca lúc 23:36, sau giờ hết ca (22:00) 1 giờ 36 — vượt mức tối thiểu tính OT.") hoặc "Tình hình" với icon "!" cam ("Không có lần chấm nào trong ca này và không có đơn nghỉ."). [C]
- **Bản đồ:** Leaflet + OpenStreetMap, nút +/−, nhãn tên địa điểm, ghim màu chủ đạo, điểm chấm. [C]
- **Gợi ý phím:** "⌨ J / K chuyển việc · A duyệt theo đề xuất · E mở bảng công ngày này". [C]

### INB-16 · Điều chỉnh khác…
- **Input** [C]:
  - `Số công`: segmented `Theo hệ thống | 1 công | 0,5 công | 0 công` (mặc định Theo hệ thống).
  - `Phút OT được tính`: số + hậu tố "phút" (prefill = phút đề xuất; trống với placeholder "không…" khi không có OT).
  - `Duyệt thiếu giờ` (checkbox dạng pill) — xuất hiện ở loại Vắng/thiếu giờ.
  - `Ghi chú cho lần duyệt này (tuỳ chọn)` — textarea.
  - Nút `Lưu duyệt` (primary) · `Quay lại`.
- **Rules:** Lưu duyệt dùng cùng endpoint `approve` [C]. Hướng dẫn nhắc thêm tuỳ chọn "tha muộn/sớm" [I] (không thấy ở các mẫu đã mở).

### INB-19 · Duyệt/Từ chối đơn
- **Chi tiết đơn** [C]: tag (Đơn nghỉ / Đăng ký ca, nền xanh dương nhạt full width) · "Tên · Xin nghỉ phép" · "Gửi lúc 18:20:20 30/10/2026" · khối "Ngày áp dụng 2026-11-04 đến 2026-11-04" · khối lý do · (đăng ký ca) link "Xem trên lưới xếp ca →" · nút `✓ Duyệt` · `✕ Từ chối` · `Để sau`.
- **Quy trình:** `POST /api/v2/admin/request/decide` → reload inbox/overview. [C]
- **States:** khi đang gửi, 2 nút mờ đi, nút Duyệt hiện spinner chấm. [C]
- **Rules:** Từ chối **không yêu cầu lý do** [C]. Đơn nghỉ phép năm được duyệt → ngày đó 1 công và trừ phép [I – hướng dẫn].

### INB-08 · Duyệt hàng loạt
- Tích ≥1 checkbox → nút "✓ Duyệt theo đề xuất · N" xuất hiện cạnh nút làm mới (N = số dòng đã chọn có đề xuất). Desktop có thêm "Chọn tất cả". Mỗi dòng được duyệt đúng đề xuất của dòng đó [I – hướng dẫn]. [C phần hiển thị]

---

## LIVE-* · Điều phối

- **Mục tiêu:** Nhìn tình hình nhân sự ngay lúc này.
- **Vị trí:** `/app/dieu-phoi`. Header: "Điều phối", phụ đề "Thứ Bảy, 31/10 · cập nhật 09:23 · tự làm mới mỗi phút", hàng chip địa điểm. [C]
- **Dữ liệu:** `POST /api/v2/admin/live` [C endpoint]; overview trả `stats` {onShiftNow, inNow, lateToday, absentNow}, `today_rows[]`, `trend[]` 7 ngày {planned, came, late, missing}, `feed[]` nhật ký [C].
- **Thẻ KPI** [C]: Đang làm (đã chấm vào, chưa ra) · Chưa vào ca (ca đã bắt đầu) · Sắp vào ca (trong 12 giờ tới, số màu xanh dương) · Vào muộn (trong khung giờ đang xem) · Chấm ngoài vùng (cần xem bản đồ).
- **Bản đồ** [C]: legend Đang làm (nâu) · Vào muộn (vàng) · Quá giờ ra (tím) · Ngoài vùng (đỏ) · Đã ra (xám); marker gom cụm hiển thị số.
- **Cần để ý ngay** [C]: danh sách cảnh báo; empty state "Mọi thứ ổn — Không ai trễ vào ca, chấm ngoài vùng hay quá giờ ra."; nút làm mới.
- **Sắp vào ca (6 giờ tới)** [C]: avatar chữ, tên, "Ca chiều · 12:00–17:00", giờ "lúc 12:00" màu xanh dương.
- **Dòng thời gian ca** [C]: khoảng 21:00 hôm qua → 0h ngày mai; segmented lọc `Tất cả | Đang làm | Chưa vào | Sắp vào | Đã xong`; legend Giờ ca (sọc) · Có mặt (nâu) · Muộn (vàng) · Sau giờ ca (tím) · Chưa có mặt (viền đỏ đứt) · Lần chấm ngoài vùng (vạch đỏ); vạch dọc đen "bây giờ" có nhãn giờ; mỗi hàng "Tên / Trạng thái · MÃ CA giờ".
  - **Rule:** ca đêm hiển thị liền một thanh qua mốc 0 giờ [C – văn bản].
  - **Edge:** cùng một người–ca có thể xuất hiện 2 lần: "Sắp vào ca" (hôm nay) và "Đã xong ca" (hôm qua, trong cửa sổ từ 21:00) [C].
- **Chấm công 24 giờ qua** [C]: "Tên vào ca/ra ca · Địa điểm · giờ · x giờ y phút trước".
- **Drawer ngày công** (bấm hàng timeline) [C]: avatar, tên, "Quản lý ca · Thứ Bảy, 31/10"; tag trạng thái (Đang làm); timeline; thẻ Vào ca (giờ, địa điểm xanh, ảnh) / Ra ca; bảng "Hệ thống tính" (Làm trong ca, Công, Muộn/về sớm, Sau ca/ngoài giờ); bản đồ; "ĐIỀU CHỈNH" segmented `Tự tính | 1 công | 0,5 | 0`; "Phút OT được tính" (placeholder "không đổi"); ghi chú (vd: kiểm kê hàng cuối tháng); `Lưu duyệt` **disabled đến khi có thay đổi**; link "Mở bảng công của Minh" → `/app/bang-cong?ngay=…&nv=…`.

---

## TS-* · Bảng công

### TS-01…03 · Chọn kỳ
- Header nâu: ‹ "Tháng 10/2026 / 01/10 – 31/10/2026" › + dropdown loại kỳ `Tháng | Kỳ lệch | Tự chọn`. [C]
- **Kỳ lệch:** hiện thêm "Bắt đầu từ ngày [26 ▾]" + nút "Kỳ này"; nhãn "Kỳ tháng 10/2026 · 26/09 – 25/10/2026". [C] Ngày bắt đầu mặc định lấy từ Cài đặt "Ngày chốt kỳ lương" [I]. Lựa chọn lưu localStorage `ehrm2_ky_luong` [I theo tên key].
- **Tự chọn:** ẩn mũi tên, hiện RangePicker 2 ô ngày + icon lịch. [C]
- Phụ đề header cập nhật: "26/09/2026 – 25/10/2026 · 8 người · 6 ngày cần xử lý". [C]

### TS-04 · Lưới cả kỳ
- **Cột:** Nhân viên (tên + vị trí, cố định trái) · từng ngày (thứ viết tắt T2…CN, CN chữ đỏ, ngày hôm nay nền nhấn) · Công · Muộn · Thiếu · OT. [C]
- **Ô:** ô vuông bo góc ~8px; ký hiệu [C]: Đủ công (nâu đặc) · ½ Nửa công (xanh lá nhạt) · M Muộn/về sớm (vàng) · ! Thiếu giờ vào/ra (đỏ) · V Vắng (đỏ) · G Ngoài vùng (viền đỏ) · C Chấm sai ca (viền vàng đứt) · + OT chờ duyệt (viền tím đứt) · + OT đã duyệt (tím đặc) · P Nghỉ phép (xanh dương) · L Nghỉ lễ (xám) · ô trống xám nhạt = không có ca · • = đang làm/chưa xong.
- **Badge số** góc trên phải ô (vd "2") = số ca trong ngày. [C]
- **Cột OT** dạng "90p +294?" = đã duyệt + chờ duyệt. [C]
- Gợi ý "Bấm tên để xem bảng công cả kỳ của người đó". [C]

### TS-05 · Theo tuần
- Chip tuần trong kỳ (01/10–04/10 … 26/10–31/10), tuần chứa hôm nay chọn sẵn. [C]
- Ô ngày: mini bar (sọc + nâu) + "13:59–22:04"; trạng thái chữ thay cho giờ: "nghỉ", "thiếu giờ vào/ra" (đỏ, nền hồng), "ngoài vùng", "muộn 7p · 1c" (vàng), "sau ca 92p", "05:59 · đang làm", "Chưa tới". [C]
- Cột "Tuần": "4 công" + "ổn" / "1 cần duyệt". [C]
- Chú thích dưới bảng: "Khung sọc = giờ ca · thanh xanh = có mặt · vàng = muộn · tím = sau giờ ca · đỏ = thiếu giờ / ngoài vùng. Ca đêm hiện trọn trong ô của ngày bắt đầu ca, kể cả phần sau 0 giờ." [C]
- Chế độ tuần ẩn nút "Duyệt loạt". [C]

### TS-08 · Duyệt loạt
- **Quy trình:** Bấm "Duyệt loạt" → nút đổi thành "Đang chọn ô" (nền màu chủ đạo) → thanh tối nổi đáy "Bấm vào các ô viền đứt (cần duyệt) để chọn · [Chọn mọi ô cần duyệt] · [✓ Duyệt] (disabled)" → chọn → "Đã chọn 7 ô — duyệt theo đề xuất của hệ thống · Duyệt 7"; ô đã chọn có viền đen đậm. [C]
- **Rule:** chỉ ô cần duyệt mới chọn được [C văn bản]; duyệt theo đề xuất [C văn bản].
- **Lưu ý:** "Cần duyệt · 5" đếm **người**, "Chọn mọi ô" đếm **ô** (7). [C]

### TS-11 · Drawer ngày công (dùng chung với Điều phối)
- Như mô tả ở Điều phối; thêm nút "Xem sao kê lương của <tên>" ở chân. [C] "Hoàn duyệt" khi ô đã duyệt [I].

### TS-13 · Bảng công một người
- **Vị trí:** bấm tên ở lưới → drawer "Tên · Quản lý ca · bảng công 01/10/2026 – 31/10/2026". [C]
- **KPI 6 ô** [C]: Tổng công 26 (27 ca · làm 194 giờ 53) · Muộn/về sớm 7p (muộn 7p · sớm 0p) · Thiếu chấm/vắng 0 lần · OT đã duyệt 1 giờ 30 (chờ duyệt 4 giờ 54, tím) · Nghỉ phép · lễ 0 · 0 ngày · Cần duyệt 3 (đỏ, "bấm dòng để duyệt").
- **Tab:** `Ngày có ca | Mọi ngày | Cần duyệt · 3` + `Excel` + `Lương` (→ `/app/luong?nv=`). [C]
- **Thẻ ngày:** "T5 01/10 · CA1 06:00–14:00" · tag trạng thái (Đủ công nâu / OT chờ duyệt viền tím đứt) · 2 ô vào/ra có ảnh nhỏ + giờ + địa điểm · "1 công" / "1 công · OT 98p chờ". Thẻ cần duyệt nền hồng nhạt, có dòng giải thích. [C]

---

## SCH-* · Xếp ca

### SCH-02/03 · Xếp theo người
- **Vị trí:** `/app/xep-ca`, segmented "Xếp theo người" (mặc định mobile). Lựa chọn view lưu localStorage `ehrm2_xepca_view` [I].
- **Hiển thị** [C]: nhóm theo vị trí có thể thu gọn ("⌄ Quản lý ca 2"); mỗi người: avatar, tên, "Linh hoạt · tuần 45 giờ" hoặc "Cố định TV2 · tuần 12 giờ" hoặc "tuần 0 giờ · 4 đăng ký chờ nhận", link "Xếp ›", dải 7 ô ca (mã ca màu riêng; "CHIEU+" = có thêm ca; ô viền đứt = ca cố định mặc định; "Nghỉ").
- **Drawer người** [C]: tiêu đề tên + nút "Rải lịch"; hướng dẫn "Bấm vào ca để gán cho ngày đó, bấm lại để bỏ. Một ngày có thể làm nhiều ca."; mỗi ngày 1 hàng: chip các ca được phép (mã + giờ ngắn "07–12"; chip chọn có dấu ✓ và màu ca), nút tẩy đỏ (xoá ngày) khi ngày có ca, hàng đổi màu vàng khi đã thay đổi; ghi chú xanh "Đăng ký từ app: SANG (nhận ở danh sách ngoài)"; nút "Hiện thêm 3 ca khác" (ca ngoài danh sách vị trí); nút "Xong".
- **Rule:** Ca hiển thị mặc định = `caDuocChon` của vị trí [C]. Thay đổi chỉ áp vào lưới (chưa lưu) [C].
- **Bất nhất văn bản:** hướng dẫn trong drawer ghi "Xong bấm Lưu ở cuối trang" nhưng nút trong drawer là "Xong" (Lưu nằm ở thanh của trang). [C]

### SCH-04 · Xếp theo ngày / chế độ cọ
- **Mobile** [C]: palette chip ca (mã + tên + giờ), "Cho nghỉ · bỏ ca cố định", "Xoá ca"; dòng "Đang chọn CA1: bấm vào người để gán / bỏ ca."; chip 7 ngày kèm số người; tóm tắt theo ca ("CA1 1 người…"); danh sách người kèm các ca của ngày.
- **Desktop** [C]: lưới đầy đủ (hàng người × cột ngày, mỗi ô liệt kê các ca với giờ); palette ca ở trên + ô tìm + lọc vị trí; dòng mô tả từng nhóm "Ca linh hoạt — cần xếp lịch · được chọn: SANG, CHIEU, TOI · làm cả tuần"; legend "Ca cố định (không cần xếp) · Đăng ký từ app · Chưa lưu"; cột hôm nay tô nền "Hôm nay".
- **Rule:** "Cho nghỉ" chỉ hiện khi công ty có người ca cố định; ngày Nghỉ → không công, không vắng, không trừ phép; đi làm ngày đó → "làm ngoài lịch" chờ duyệt [I – hướng dẫn].

### SCH-06/07 · Lưu & bỏ thay đổi
- Ô thay đổi có **chấm cam** góc phải. Thanh nổi đáy viền vàng: "● 18 ô chưa lưu · ↶ · 💾 Lưu (18)". Bấm ↶ → Modal "Bỏ 18 thay đổi chưa lưu? Lưới sẽ trở lại như lần lưu gần nhất." [Giữ lại] [Bỏ thay đổi (đỏ)]. [C]
- Nhân viên thấy lịch mới ngay sau khi Lưu [I].

### SCH-08 · Rải lịch nhiều ngày
- **Input** [C]: (1) Nhân viên — multi-select "Chọn một hoặc nhiều người" + link "+ Thêm tất cả người làm ca linh hoạt (7)"; (2) Khoảng ngày — Từ ngày (mặc định hôm nay) / Đến ngày (mặc định +30 ngày); (3) Ca theo thứ trong tuần — các "Nhóm": select ca + 7 nút thứ (mặc định T2–T6 chọn); "+ Thêm nhóm ngày khác"; checkbox "Xoá ca ở những thứ không thuộc nhóm nào" (tắt), "Bỏ qua ngày lễ" (bật).
- **Rules** [C văn bản]: Mỗi thứ chỉ thuộc một nhóm; ngày được rải **thay** ca đang có. Tối đa 3 tháng/lần [I]. Nút "Rải ô lịch" disabled đến khi đủ điều kiện, hiển thị số ô sẽ ghi [C disabled / I số]. Ghi ngay không cần Lưu [I].

### SCH-09 · Chép tuần trước
- Modal xác nhận [C]: "Chép lịch tuần 19/10 – 25/10/2026 sang tuần này? 7 người, 45 ca. Lịch tuần 26/10 – 01/11/2026 của những người này sẽ được thay theo tuần trước. Chưa lưu ngay — bạn xem lại rồi bấm Lưu." → Toast "Đã chép 45 ca của 7 người. Xem lại rồi bấm Lưu." → lưới có 18 ô thay đổi.

### SCH-10 · Mẫu tuần
- Modal [C]: "Áp mẫu vào tuần …" (empty: "Chưa có mẫu nào. Xếp xong một tuần chuẩn rồi lưu thành mẫu ở bên dưới, tuần sau chỉ cần áp mẫu.") + "Lưu tuần đang xem thành mẫu" (mô tả "7 người có lịch xếp tay, 45 ca. Ca cố định theo vị trí không cần lưu vào mẫu.", input tên mặc định "Mẫu tuần 26/10", nút "Lưu mẫu"). Lưu vào `settings.weekTemplates[]` [I theo bootstrap].

### SCH-11/12 · Nhận đăng ký ca
- Banner xanh dương ở tuần hiện tại: "Tuần sau (02/11 – 08/11/2026) có **7 đăng ký ca** từ app đang chờ nhận." + "› Xem tuần sau". Ở tuần đó: "7 đăng ký ca từ app đang chờ nhận trong tuần này (ô viền đứt xanh). Nhận là ghi luôn vào lịch." + "✓✓ Nhận tất cả 7". [C]
- **Dữ liệu:** `POST /api/v2/admin/schedule` trả `cells[]` {date, email, shifts[]} và `registrations[]` {row, date, email, name, shift}. [C]
- **Desktop** [C]: mỗi đăng ký là ô viền đứt xanh ghi mã ca, kèm 2 nút nhỏ **✓** (nền brand — nhận) và **✕** (từ chối); hàng người ghi "Linh hoạt · 0 giờ".
- **Bất thường quan sát:** ở bố cục compact (<992px), các ô đăng ký của Ánh/Bảo hiển thị trống (không thấy viền đứt xanh, không có ✓✕) dù banner mô tả có; chỉ thấy đăng ký trong drawer người. [C]

### SCH-16 · Bảng "Số người mỗi ca" (desktop)
- **Vị trí:** cuối lưới Xếp ca desktop. [C]
- **Hiển thị:** hàng = từng ca (chip mã + tên), cột = 7 ngày, ô = số người được xếp; nếu có đăng ký chờ thêm dòng nhỏ "+1 chờ"; hàng cuối "Tổng người có ca" (vd 5 · 4 · 5 · 5 · 5 · 6 · 4). [C]
- **Rule:** "Ô đỏ: ngày đó chưa có ai cho ca này trong khi các ngày khác có." — cảnh báo thiếu người. [C văn bản]
- Ở nhóm ca cố định có dòng mô tả "Ca cố định TV2 06:00–08:00 · cả tuần · ô mờ là ca mặc định, chỉ xếp khi cần đổi". [C]

---

## PAY-* · Lương

### PAY-01/02 · Tổng quan kỳ lương
- **Dữ liệu:** `payroll/status` {key, label, published, at, by, publishedNet, count}; `adjust/list` {items[{row, email, type, amount, note}]}; lương từng người nằm trong `timesheet.employees[].pay` {type, lines[{key, name, amt, how}], net, pendingOT}. [C]
- **Thẻ chính** [C]: "Kỳ lương tháng 10/2026" + tag "⏱ Chưa công bố" (vàng); số lớn "44.973.304đ"; "Quỹ lương dự kiến (tổng thực lĩnh) · 8 người · 01/10 – 31/10/2026"; progress "3/8 người sẵn sàng"; "Nhân viên chưa thấy phiếu lương kỳ này trong app."; nút "➤ Công bố phiếu lương".
- **Thẻ phụ** [C]: OT đã duyệt 115.385đ (1 giờ 30 phút · 1 người) · OT chờ duyệt +376.923đ tím (4 giờ 54 phút · chưa tính, nếu duyệt sẽ cộng thêm) · Ngày công cần xử lý 7 đỏ (5 người · xử lý xong rồi hãy công bố) + "Mở Hộp việc" · Thưởng/phạt nhập tay +500.000đ (1 khoản · Đỗ Như Quỳnh).
- **Rule "Sẵn sàng":** người không còn việc cần xử lý. [I]

### PAY-03 · Danh sách nhân viên
- Tìm "theo tên hoặc email"; chip `Tất cả 8 · Cần xử lý 5 · OT chờ 1 · Sẵn sàng 3 · Có thưởng/phạt 1`; select "Mọi vị trí", "Mọi kiểu lương"; select sắp xếp "tên A → Z" (và thực lĩnh [I]). Dòng: avatar chữ, tên, vị trí, "29 công · OT 0", thực lĩnh phải, tag "1 việc" (đỏ) / "Sẵn sàng" (xanh). [C]

### PAY-04 · Sao kê một người
- **Header** [C]: "Sao kê tháng 10/2026 · 01/10 – 31/10/2026" + "🖨 In phiếu" + "+ Thưởng / phạt"; tên lớn; "Quản lý ca · Ca linh hoạt (theo lịch) · Lương tháng 10.000.000đ · Bậc 1".
- **KPI** [C]: Công 26 (27 ca) · OT đã duyệt 1g30 (90 phút) · OT chờ duyệt 4g54 (+376.923đ nếu duyệt) · Thực lĩnh 10.115.385đ (Lương theo tháng, ô nền nâu nhạt).
- **"Vì sao ra số này"** [C]: dòng "Lương theo công 10.000.000 — 10.000.000 ÷ 26 công chuẩn × 26 công"; "Tăng ca đã duyệt 115.385 — 30/10: 90p × 51.282đ/giờ × 150% (ngày thường)"; "Thực lĩnh 10.115.385đ".
- **Callout tím** [C]: "Chưa tính: 294 phút OT chờ duyệt — 06/10 (98p), 18/10 (100p) và 24/10 (96p). Nếu duyệt hết, thực lĩnh thành 10.492.308đ (+376.923đ)." + link "Duyệt trong Hộp việc".
- **Thưởng/phạt nhập tay** [C]: empty "Chưa có khoản nào trong kỳ. Dùng cho hoa hồng, thưởng nóng, phạt vi phạm…" + "+ Thêm".
- **Từng ngày** [C]: switch "Hiện đủ từng ngày"; bảng cột Ngày · Ca · Vào · Ra · Trong ca · Công · Muộn/sớm · Sau ca · Ghi nhận; các ngày bình thường gộp thành dải "01/10 – 05/10 · 4 ca đủ công, 1 ngày không có ca · 4 công · bấm để mở"; ngày bất thường hiện riêng (pill "98p chờ" viền tím đứt, "+90p", "muộn 7p"); chú thích "Ô 'chờ' màu tím: phút ở lại sau ca chưa được duyệt — 4 giờ 54 phút tổng."

### Công thức lương quan sát được
| Kiểu lương | Công thức | Ví dụ | Kiểm chứng |
|---|---|---|---|
| Tháng | mức ÷ công chuẩn × công | 11.000.000 ÷ 26 × 26 = 11.000.000 | C |
| Đơn giá giờ OT (lương tháng) | mức ÷ công chuẩn ÷ giờ chuẩn ca | 10.000.000 ÷ 26 ÷ 7,5 = 51.282 | C |
| OT | phút/60 × đơn giá giờ × hệ số | 90p × 51.282 × 150% = 115.385 | C |
| Giờ | số giờ × đơn giá giờ | 79,35 giờ × 25.000 = 1.983.750 | C (phiếu tháng 9) |
| Công/buổi | đơn giá × số công | 60.000 × 27 = 1.620.000 | C (khớp số) |
| Bậc lương | lương tháng = mức của bậc | Bậc 2 → 11.000.000 | C |
| Phụ cấp theo công / cố định / theo tháng chia công | xem POS-03 | | C (văn bản) |
| Phạt muộn | đ/phút × phút muộn | 1.000đ/phút × 14 = 14.000 | C (văn bản ví dụ) |
| BHXH | lương đóng × tỷ lệ (mặc định 10,5%), chỉ khi kỳ tròn tháng | | C (văn bản) |
| Hệ số OT mặc định | 150% ngày thường · 200% ngày nghỉ tuần · 300% ngày lễ; "Thứ Bảy nghỉ" để trống = 150% | | C |

### PAY-05 · Thưởng/phạt
- Modal [C]: tiêu đề "Thêm thưởng / phạt"; "Áp dụng cho kỳ **tháng 10/2026**. Khoản này cộng / trừ thẳng vào thực lĩnh."; Nhân viên (select, prefill); Loại segmented `Thưởng (+) | Phạt (-)`; Số tiền (placeholder 500.000, hậu tố đ) + chip nhanh 200.000 · 500.000 · 1.000.000 · 2.000.000; Lý do (placeholder "Vd: Hoa hồng hợp đồng, thưởng doanh số"); nút "Huỷ" · "Thêm thưởng" (đổi theo loại [I]).
- **Validation** [C]: "Nhập số tiền lớn hơn 0." · "Ghi lý do để nhân viên hiểu khoản này (vd: Hoa hồng hợp đồng, Làm hỏng hàng)." — viền đỏ cả 2 ô.

### PAY-06 · Công bố phiếu lương
- Modal xác nhận [C] gồm 4 khối màu:
  1. (xanh dương, icon điện thoại) "**8 nhân viên** sẽ thấy phiếu lương kỳ này trong app. Tổng thực lĩnh **44.973.304đ**."
  2. (vàng, icon cảnh báo) "Còn **7 ngày công cần xử lý** (5 người): thiếu giờ, vắng, ngoài vùng… Các ngày này đang tính theo số máy ghi nhận."
  3. (tím) "Còn **294 phút OT chờ duyệt** chưa được tính. Nếu duyệt hết, quỹ lương tăng thêm khoảng **376.923đ**."
  4. (xám, icon khoá) "Phiếu sẽ được **đóng băng** theo số liệu lúc này. Nếu sau đó sửa công, duyệt OT hay thêm thưởng / phạt thì **phải công bố lại** để nhân viên thấy số mới."
  - Nút: "Xử lý trước ở Hộp việc" · "Huỷ" · "Công bố 8 phiếu" (primary).
- **Rule:** Không bắt buộc xử lý hết trước khi công bố [C]. App NV: "Phiếu này là bản đã công bố, không đổi khi bảng công được sửa sau ngày công bố." [C]

---

## STF-* · Nhân sự

### STF-03/04 · Form nhân viên (drawer)
- **Header:** icon "?" + "Thêm nhân viên / Chọn vị trí là có sẵn ca, địa điểm, lương"; khi sửa: avatar + tên + vị trí + nút "Chép tin mời". [C]
- **Thông tin** [C]: Họ tên · Email đăng nhập · Mã PIN (tự sinh 4 số, ẩn/hiện, "Tạo mã"; ghi chú "4–8 chữ số, dùng để đăng nhập app.") · Trạng thái `Đang làm | Đã nghỉ` · Ngày vào làm (date, mặc định hôm nay; "Trước ngày này không tính vắng.") · Loại hợp đồng (Full-time / Part-time / Thực tập / Cộng tác viên).
- **Vị trí** [C]: select vị trí. Chưa chọn → cảnh báo cam "Chưa gắn vị trí: ca và địa điểm đặt riêng ngay dưới đây, lương giữ như hiện tại; khi chấm công người này được chọn mọi ca…" + "Ca làm việc" (Chọn ca) + "Địa điểm chấm công" (mặc định "Ở đâu cũng được"). Đã chọn → khối tóm tắt "THEO VỊ TRÍ PHA CHẾ: SANG 07:00–12:00 · CHIEU … · TOI … · Đăng ký ca theo tuần · Cả tuần · Quán Hoàn Kiếm, Quán Tây Hồ · 28.000đ/giờ" + nhóm "Khác với vị trí (không bắt buộc)": công tắc **Lương riêng** (vd "Đơn giá mỗi giờ … đ/giờ · Vị trí: 28.000đ"), **Ca riêng**, **Địa điểm riêng** (chọn địa điểm con).
- **Quản lý & quyền** [C]: Người quản lý trực tiếp (select, "Không có"; ghi chú "Người này (nếu có quyền Quản lý nhóm) sẽ duyệt công, đơn từ cho nhân viên."); Quyền vào trang quản trị — 4 thẻ radio có mô tả.
- **Chụp ảnh khi chấm công** [C]: `Theo công ty | Bắt buộc | Miễn` + mô tả động ("Theo Cài đặt công ty (đang tắt: không chụp) và vị trí." / "Người này không phải chụp ảnh, kể cả khi công ty bật.").
- **Footer** [C]: (sửa) "🔓 Mở khoá máy" · "🗑 Xoá nhân viên" (đỏ) · "Huỷ" · "Lưu hồ sơ"; (thêm) "Huỷ" · "Thêm nhân viên".
- **Validation** [C]: hiện **một** lỗi chữ đỏ ở dưới footer ("Nhập họ tên."), không viền đỏ trên trường.
- **Rules:** Email là định danh đăng nhập & khoá chính [C – id inbox dùng email]. PIN lưu dạng rõ và trả về cho admin trong bootstrap [C] (xem 09).

### STF-05 · Xoá nhân viên
- Modal [C]: "Xoá hẳn Lê Ngọc Ánh? Người này đã có 76 lần chấm công, 4 đơn từ. Sau khi xoá, các dữ liệu đó vẫn nằm trong Google Sheet nhưng không còn hiện trên Bảng công và Lương, kể cả các kỳ cũ. Nếu người này chỉ thôi việc, nên đặt Trạng thái Đã nghỉ: không đăng nhập app được nữa mà bảng công cũ vẫn giữ." Nút: "Chuyển sang 'Đã nghỉ' thay vì xoá" · "Huỷ" · "Xoá nhân viên". Nút Xoá ở footer chuyển trạng thái hồng khi modal mở.

### STF-10 · Thêm hàng loạt
- Modal [C]: textarea ("Mỗi dòng: Họ tên, email, vị trí"; ghi chú "Dấu phẩy, chấm phẩy hoặc dán thẳng 3 cột từ Excel / Google Sheet. Mỗi người được tạo mã PIN 4 số.") → **preview trực tiếp**: "1 người sẵn sàng, 1 dòng bỏ qua." + select "Dòng thiếu vị trí dùng: [Không gán]" + bảng `# · Họ tên · Email · Vị trí (select) · trạng thái` ("Sẵn sàng" / "Thiếu email hoặc email sai" — dòng lỗi nền vàng) → nút "Thêm N người".
- **Rule:** khớp vị trí không phân biệt dấu ("Pha che" → "Pha chế") [C].

### STF-11 · Gửi link cài app
- Modal [C]: QR code; "📱 Nhân viên quét mã hoặc mở link này"; link `https://chamcong.worksheet.vn/m/?ma=<MÃ>`; "Mã công ty: … · mở được trên mọi điện thoại, không cần tải từ kho ứng dụng."; "Sao chép link" · "Tải ảnh QR"; "Tin nhắn mẫu cho từng người": tìm người + "Chép tin cho cả 8 người"; mỗi dòng: avatar, tên, email · vị trí, **PIN hiển thị rõ**, "Chép tin nhắn".

---

## POS-* / SHF-* / HOL-* · Vị trí & ca

### POS-03 · Form vị trí (drawer "Vị trí: <tên>")
- Phụ đề "Một lần cấu hình — mọi người cùng vị trí dùng chung"; tên vị trí; khối "TH ĐM 2 người đang giữ vị trí này: … Lưu xong, ca / địa điểm / lương của họ cập nhật theo." [C]
- **Ca & ngày làm** [C]: radio thẻ `Ca cố định` (ngày nào cũng một ca, không cần xếp lịch) | `Linh hoạt` (đăng ký hoặc được xếp ca theo tuần, trong các ca cho phép); "Các ca được phép làm" — thẻ checkbox mỗi ca (mã màu, tên, giờ, icon ca ghép); "+ Xem thêm 7 ca mẫu"; ghi chú "Ngày nào có lịch / đăng ký ca mới cần chấm công; ngày không có lịch không bị tính vắng."; "Ngày được đăng ký ca" — 7 nút tròn + link "Dùng ngày chung của công ty"; "Ngày không chọn là ngày nghỉ: đi làm sẽ thành OT."
- **Địa điểm chấm công** [C]: `Tại địa điểm đã chọn` (kiểm tra GPS) | `Ở đâu cũng được` (không kiểm tra GPS — hợp người đi thị trường) + checkbox từng địa điểm ("Bán kính 60 m").
- **Lương** [C]: kiểu `Lương tháng | Theo công / buổi | Theo giờ`; (tháng) Mức lương tháng, Công chuẩn, Ngày phép năm, ví dụ tính; **Bậc lương** (danh sách tên bậc + mức + số người; "Thêm bậc").
- **Phụ cấp – thưởng cố định** [C]: công tắc "Có phụ cấp" → dòng (kiểu `Theo mỗi công | Cố định mỗi tháng | Theo tháng, chia công` + số tiền + xoá) + "Thêm phụ cấp" + chip gợi ý (+ Xăng xe, + Điện thoại, + Chuyên cần, + Nhà ở); công tắc "Thưởng cố định hằng tháng" → (tên khoản + số tiền) + "Thêm khoản thưởng"; "Cộng mỗi kỳ tròn tháng."
- **Phạt – BHXH** [C]: công tắc "Trừ tiền phạt và BHXH" (tắt: không trừ phạt muộn, quên chấm và cả BHXH) → Phạt đi muộn/về sớm (đ/phút), Phạt mỗi lần quên chấm (đ/lần), Lương đóng BHXH (đ), Tỷ lệ người lao động đóng (% — mặc định 10,5).
- **Hệ số OT** [C]: Ngày thường 150 · Thứ Bảy nghỉ (trống, placeholder 150) · Chủ nhật, ngày nghỉ 200 · Ngày lễ 300; "Chỉ OT đã được duyệt mới tính tiền."
- **Khác** [C]: "Miễn chụp ảnh khi chấm công"; "Ghi chú nội bộ".
- **Footer** [C]: "Xoá vị trí" · "Huỷ" · "Lưu vị trí". Huỷ **không** hỏi xác nhận dù đã thay đổi [C].

### SHF-02 · Form ca ("Sửa ca CA1")
- Tên ca; Mã ca (disabled — "Mã không đổi được vì đã gắn với lịch và nhật ký chấm công."); Giờ vào; Giờ ra; Nghỉ giữa ca từ – đến; nhãn tính "Làm 7 giờ 30 phút (đã trừ nghỉ)". [C]
- **Cách tính công** (thẻ radio) [C]: `Theo khung ca` (BLOCK: đủ số phút trong khung = 1 công, ghi nhận muộn/sớm) · `Theo giờ thực tế` (công = giờ làm thật ÷ giờ chuẩn, không bắt lỗi) · `Giờ thực tế + bắt lỗi`.
- Giờ chuẩn (7,5 giờ) · Đủ 1 công khi làm từ (420 phút) · Nửa công khi làm từ (210 phút; ít hơn → 0 công) · Cho phép muộn (5 phút) · OT tối thiểu (30 phút). [C]
- Công tắc `Ca ghép` (một ngày làm 2–3 ca ghép; nghỉ phép ca ghép tính nửa công) · `Không bắt lỗi muộn / sớm` (hợp ca ngắn như tạp vụ). Ghi chú. Huỷ · Lưu ca. [C]
- **Rule:** Sửa giờ ca áp cho mọi vị trí dùng ca đó [C văn bản]. Ca qua đêm được tính liền một ca [C văn bản].

### HOL-01/02 · Ngày lễ
- Mô tả: "Ngày lễ nhân viên ca cố định được tính đủ công dù không đi làm; đi làm được tính OT theo hệ số ngày lễ." Nút "Thêm ngày lễ Việt Nam năm 2027" · "Thêm". Danh sách: ô ngày "01/01" + "T5 · 2026", tên, "· đã qua". Ghi chú: Tết Nguyên đán và Giỗ Tổ theo âm lịch, ngày nghỉ bù thay đổi mỗi năm — thêm tay. [C]

---

## LOC-03 · Form địa điểm
- Drawer "Sửa: Quán Hoàn Kiếm — Không cần gõ kinh độ, vĩ độ — chọn một trong các cách bên dưới" [C].
- Tên địa điểm · Địa chỉ · thẻ "◎ Lấy vị trí hiện tại — Đứng tại văn phòng / cửa hàng rồi bấm. Đo 5 lần lấy trung bình." · "🔗 Dán link Google Maps hoặc gõ địa chỉ [input] [Tìm]" · bản đồ có ghim + vòng bán kính (nét đứt) ("Hoặc bấm thẳng lên bản đồ để đặt ghim") · Bán kính (input m + slider 30 → 500, mốc 100/200/300/400) · hướng dẫn "Văn phòng trong toà nhà: 80–150 m. Kho, nhà xưởng, khuôn viên rộng: 200–300 m. GPS điện thoại thường lệch 10–50 m, đặt quá nhỏ dễ bị báo 'ngoài vùng'." · "Toạ độ (tự điền): 21.024520, 105.853080 · Kiểm tra trên Google Maps ↗" · "Vị trí chấm công tại đây" (checkbox thẻ từng vị trí) · Xoá · Huỷ · Lưu. [C]
- **Rule:** Chấm ngoài vòng vẫn được ghi, gắn cờ "ngoài vùng" để duyệt [C – hướng dẫn + dữ liệu `geo: "Ngoài vùng"`].

## LOC-04 · Gợi ý từ lần chấm thật
- "So với các lần chấm công 30 ngày gần nhất, để nhân viên không bị báo ngoài vùng oan." + "Tải lại". Empty: "Chưa có gợi ý — các địa điểm đang khớp với vị trí chấm thật. Khi có từ 5 lần chấm gần một địa điểm mà ghim lệch hoặc nhiều lần chấm sát mép vòng, gợi ý sẽ hiện ở đây." [C]

---

## SET-* · Cài đặt
- **Bố cục** [C]: các thẻ section có icon: Thông tin công ty · Google Sheet & Drive · Màu chủ đạo · Tính lương · Quy tắc chấm công · Nhập dữ liệu hàng loạt từ file · Kiểm tra dữ liệu.
- **Thanh lưu** [C]: khi có thay đổi, thanh tối nổi đáy "N thay đổi chưa lưu · Huỷ · Lưu cài đặt".
- **Màu chủ đạo** [C]: 9 swatch tròn (`#2F9A4C`, `#1E8E5A`, `#0E7C86`, `#3B63C4`, `#214098`, `#6A37B5`, `#BE185D`, `#B4532A`, `#334155`) + "Màu khác #7B5236" (ô màu + hex); chọn → **xem trước ngay trên toàn hệ thống** (header, nút) + thẻ preview app nhân viên (header màu, "Ca hôm nay · 08:30–17:30", tag "Trong vùng", nút "Duyệt").
- **Quy tắc muộn** [C]: thẻ radio "Tính cả số phút muộn (Cho phép 5 phút, vào muộn 14 phút → tính muộn 14 phút. Muộn 4 phút → không tính.)" / "Chỉ tính phần vượt (… → tính muộn 9 phút.)". Bootstrap: `graceMode: "toan_bo"` [C].
- **OT** [C]: "Tính OT khi đến sớm trước giờ vào ca" (`otBefore`), "Tự xác nhận OT theo đơn đã duyệt" (`otFromRequest`), "Số phút tối thiểu để tính OT" (`otMin` = 30).
- **Edge cases quan sát** [C]: (1) Rời trang khi có thay đổi chưa lưu → thay đổi bị bỏ, **không cảnh báo**, màu trở lại cũ. (2) Ở viewport ~800px, thanh lưu nằm chồng lên thanh điều hướng dưới — bấm "Huỷ" đã kích hoạt mục "Bảng công" của bottom nav.

## GEN-01 · Tìm nhanh
- Modal giữa màn hình, input "Gõ tên nhân viên, ngày (15/9) hoặc tên trang…". Mặc định liệt kê 9 trang (icon + "Trang"). [C]
- Gõ tên → 2 kết quả: "<Tên> · <vị trí> · bảng công tháng này" và "Hồ sơ <Tên> · Nhân sự". Gõ "15/10" → "Bảng công ngày 15/10 · Mở lưới công, chọn sẵn ngày này". Không khớp → "Không thấy kết quả. Thử gõ tên nhân viên hoặc ngày dạng 15/9." [C]
- Phím tắt Ctrl/⌘+K (nhãn hiển thị ở desktop) [C hiển thị].

## GEN-02 · Thiết lập nhanh (4 bước)
- Stepper tròn 1–4, nút ✕. [C]
1. **Ngành nghề:** Tên công ty; Quy mô `Dưới 10 | 10 – 30 | 30 – 100 | Trên 100`; 6 thẻ ngành (+ "Ngành khác" [I]) mỗi thẻ có "N vị trí: …"; "Để sau" · "Tiếp tục →".
2. **Vị trí & ca:** "Sẽ tạo 5 vị trí, dùng 6 ca. Mức lương chỉ để tham khảo — sửa ngay trên thẻ."; mỗi thẻ: tên + công tắc bật; `Ca cố định | Linh hoạt`; select ca; kiểu lương (Tháng/Giờ/Công) + mức; 7 thứ; dòng bậc; "Thêm vị trí".
3. **Địa điểm:** tên, địa chỉ, 3 cách đặt ghim, bán kính (mặc định 100m); "Công ty đã có 2 địa điểm… Có thể bỏ qua bước này."; "Bỏ qua" · "Tiếp tục".
4. **Nhân viên:** textarea dán danh sách; "Chưa có danh sách? Bỏ qua bước này…"; "Hoàn tất thiết lập". Màn cuối: QR + link + PIN từng người [I – hướng dẫn].
- Bootstrap có `steps[]`: company, location, shift, position, staff, invite (done true/false) và `settings.setupDone` [C].

## GEN-03 · Tour coach-mark
- Popover trắng bo tròn, nhãn "Hướng dẫn · bước x/n", chấm tiến trình, tiêu đề, mô tả, "Bỏ qua" · "Quay lại" · "Tiếp" / "Đã hiểu"; phần tử được giới thiệu được khoanh viền sáng trên nền tối. Đã gặp: Nhân sự (2), Vị trí (4), Ca (2), Địa điểm (4), Cài đặt (3). Lưu đã xem ở localStorage `ehrm2_coach_<trang>`. [C]

## SHOP-01/02 · Mua gói
- Bottom sheet [C]: "WORKSHEET · CHẤM CÔNG / Thấy hợp với công ty bạn? / Giá theo quy mô nhân sự — chưa tới 700đ mỗi ngày cho cả công ty." + "Chọn gói · từ 249K/năm" (xanh lá cố định, không theo màu thương hiệu) + "Để sau" + ✕.
- Modal [C]: "Dùng thật cho công ty bạn — Chọn gói, điền 3 ô, quét mã QR là xong. Email kích hoạt gửi ngay khi nhận tiền."; segmented `Theo năm | Vĩnh viễn · trả 1 lần`; 3 radio gói (giá/năm); 3 cam kết (Dữ liệu nằm trên Google Sheet của công ty bạn · Email kích hoạt gửi ngay khi nhận tiền, cài đặt khoảng 5 phút · Chuyển khoản, không lưu thẻ, không tự gia hạn); form Họ và tên · Số điện thoại · Email (Nhận hướng dẫn kích hoạt) · Tên công ty (không bắt buộc); tổng "Dưới 20 nhân sự · 1 năm 249.000đ"; "Tiếp tục · quét mã thanh toán →".
- Giá từ API `shop/plans` [C]: t30 <20 NS: 249.000/năm, 747.000 vĩnh viễn · t60 20–60: 390.000 / 1.170.000 · t120 60–120: 590.000 / 1.770.000.
- Bước QR & xử lý thanh toán: [U].

---

## EMP-* · App nhân viên

### EMP-01…08 · Chấm công
- **Header** nâu: avatar chữ, tên, "Phục vụ · Cà phê Phố Nhỏ", nút chuông (chấm đỏ khi có thông báo). [C]
- **Thẻ ca:** "Ca bạn chọn (ngoài lịch) · Ca sáng · 07:00 – 12:00 · Quán Hoàn Kiếm". [C]
- **Định vị:** khi bị chặn: khối vàng "Trình duyệt đang chặn quyền vị trí. Bấm biểu tượng ổ khoá… → Vị trí → Cho phép, rồi tải lại trang. Kiểm tra thêm: Cài đặt hệ thống → Quyền riêng tư → Dịch vụ định vị… · Mã lỗi 1 · Mac · Chrome · quyền: denied" + nút "↻ Bật định vị". Khi được: "Trong vùng · khoảng cách" [I]. [C trạng thái lỗi]
- **Chọn ca bạn làm:** chip các ca (NV linh hoạt; ca có lịch có chấm nhỏ). [C]
- **Đồng hồ** lớn "09:46" + "THỨ BẢY, 31/10/2026"; **nút tròn VÀO CA** (vòng ngoài xanh dương nhạt, nút trong xanh lá, icon vân tay). [C] Sau khi vào → RA CA [I].
- "Thêm ghi chú (không bắt buộc)". [C]
- **Hôm nay:** "Đã quá giờ vào ca 2 giờ 45"; timeline; "Ca khác hôm nay: Ca tối 17:00–22:00"; "Chưa có lần chấm nào hôm nay." [C]
- Thẻ "4 đơn đang chờ duyệt · Xem trạng thái trong mục Tôi · Xem". [C]
- **Dữ liệu `app/home`** [C]: user (flexible), company (brand, appName), features.payroll, `next.action` = "in"/"out", `todayShifts[]`, `choices[]` ca được chọn, `locations[]` (lat, lng, radius), `freeMode`, `requireCamera`, `leave` {total, used, pending, left}, `notices[]`, `pending`.
- **Rules:** Không cần chọn ca nếu có lịch — app tự nhận ca theo giờ chấm và lịch [I hướng dẫn]; chấm 2 lần không sai công [I]; ngoài vùng vẫn chấm được kèm khoảng cách → giải trình [I]; ở lại sau ca → đề xuất OT [C qua dữ liệu].

### EMP-09/10 · Bảng công & giải trình
- Header "Lịch & công" + ‹ "Tháng 10/2026" › (› disabled ở tháng hiện tại); segmented `Bảng công | Lịch ca`. [C]
- KPI: "35 công / 35 ca · 119 phút muộn · 0 thiếu chấm · 0 phút OT tính". [C]
- Lịch tháng: ô ngày có gạch màu dưới (nâu đủ, vàng muộn/sớm, đỏ thiếu/vắng, tím OT, xanh phép, xám lễ); CN chữ đỏ; hôm nay nền nâu; ngày chọn viền vàng. [C]
- Chi tiết ngày: thẻ cho **mỗi ca** trong ngày: "Thứ Sáu, 09/10 · Ca sáng 07:00 – 12:00 · Quán Hoàn Kiếm" + tag; timeline; Vào (muộn 13p, vàng) / Ra / Công; danh sách ghi nhận ("Muộn 13 phút"); log vào/ra kèm địa điểm; nút "Giải trình ngày 09/10". [C]
- **Giải trình (bottom sheet):** "Gửi giải trình · Thứ Sáu, 09/10/2026 · Ca sáng"; khối vàng "Hệ thống ghi nhận: Muộn 13 phút"; textarea Lý do; "Viết ngắn gọn, đủ để quản lý hiểu và duyệt. Nội dung được lưu nháp trên máy này."; Chọn nhanh: Kẹt xe / thời tiết xấu · Đi gặp khách / công tác · Quên bấm chấm công · Điện thoại hết pin / lỗi mạng · Đã báo quản lý trước; "Gửi giải trình". Validation: "Ghi rõ lý do (ít nhất vài chữ) để quản lý duyệt nhanh." [C] Nháp lưu `ehrm2_m_draft_request_<email>` [C key].
- **Rule:** Giải trình gửi kèm tiền tố mã ca "[Ca: SANG] …" (thấy trong admin) [C].

### EMP-11/12 · Lịch ca & đăng ký ca
- "Tuần này · 26/10 – 01/11 · 8 ca · 40 giờ": trục 06–21h, mỗi ngày một thanh (ngày đã qua nhạt, hôm nay đậm). "Tuần sau · Chưa có ca · 4 chờ duyệt": thanh viền xanh đứt. [C]
- "Đăng ký ca tuần sau": lưới ca × ngày; ô "Chờ" (viền xanh đứt); legend Bạn chọn · Đã gửi, chờ duyệt · Đã xếp lịch; "Chưa chọn ca nào" + "Gửi đăng ký"; danh sách "Đăng ký đã gửi" (ngày, ca, giờ, "Chờ duyệt"). [C]
- Cần nghỉ ngày có lịch → nút "Đổi ca" cuối trang [I].

### EMP-13 · Tạo đơn (bottom sheet)
- "Tạo đơn · Gửi tới quản lý trực tiếp của bạn để duyệt"; lưới 6 loại có icon màu. [C]

| Loại | Trường | Ghi chú |
|---|---|---|
| Nghỉ phép | Phép năm còn lại (x/12 ngày + progress) · Loại nghỉ `Phép năm / Nghỉ ốm / Không lương` · Từ ngày · Đến ngày (hiện thứ) · Lý do | Không gửi được nếu vượt phép còn lại (đã trừ đơn chờ) [I] |
| Muộn / sớm | Bạn xin `Đi trễ / Về sớm` · Ngày · Số phút · Ca (`Cả ngày / ca chính` + từng ca) · Lý do | "Đơn được duyệt thì số phút đi trễ này không bị trừ lương." |
| Làm thêm | Ngày · Làm thêm trước/sau ca (chọn ca) · Từ giờ · Đến giờ · Việc cần làm thêm | Đơn duyệt → OT tự xác nhận nếu bật `otFromRequest` |
| Đổi ca | Ngày xin nghỉ · Ca nghỉ · Ngày làm bù · Ca làm bù · Lý do | "Nghỉ một ngày theo lịch và đi làm bù vào ngày khác." |
| Đăng ký ca | Lưới tuần sau · Ghi chú | Giống EMP-12 |
| Quên chấm | Ngày · Ca · Giờ vào thực tế · Giờ ra thực tế · Lý do | "Chỉ cần điền giờ bị thiếu. Quản lý duyệt xong, giờ này được cộng vào bảng công." |
[C toàn bộ trường]

### EMP-15/16 · Lương
- Header "Phiếu lương · Thực lĩnh tháng 9/2026 · 1.983.750đ"; chip "Năm 2026" + "1 phiếu đã công bố"; danh sách 12 tháng: badge "TH 9", "Tháng 9/2026 · Công bố 05/10/2026", số tiền + "Xem phiếu ›"; tháng khác "⏳ Đang tính" ("Đang chấm công" / "Chưa công bố phiếu"); chú thích riêng tư. [C]
- Phiếu (sheet): thẻ nâu thực lĩnh + "Kỳ 01/09 – 30/09/2026 · Công bố 05/10/2026 · Lương giờ"; KPI công/muộn/thiếu chấm/OT; THU NHẬP (dòng + công thức); Thực lĩnh; "⌄ Xem chi tiết 16 ngày công"; chú thích đóng băng. [C]

### EMP-17…19 · Tôi
- Hồ sơ (Email, Chức vụ/vị trí, Phép năm còn lại) · Thông báo (đếm; "Phiếu lương tháng 9/2026 đã công bố · 08:15 · 05/10/2026 · Xem phiếu ›") · Đơn của tôi (đếm chờ duyệt; từng đơn: loại · ngày, tag "Chờ duyệt", mô tả, "Gửi 07:46 29/10/2026") · Hướng dẫn sử dụng · Báo lỗi & góp ý · Cài lên màn hình chính (tab iPhone/Android, 4 bước) · Đăng xuất · footer "Phố Nhỏ Chấm công · WORKSHEET TECH". [C]
