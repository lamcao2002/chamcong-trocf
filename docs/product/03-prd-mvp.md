# PRD MVP — App chấm công

Oct 31, 2026 · @Lam Cao

MVP cho phép **một quán cà phê 5–10 nhân viên** chấm công bằng điện thoại, quản lý duyệt bất thường, và trả lương trọn **một kỳ tháng** — gồm 10 màn quản trị, 4 màn nhân viên, 36 user story, 21 bảng CSDL, làm trong 4 sprint (8–10 tuần).

Căn cứ: bộ phân tích `docs/website-analysis/`, [Kế hoạch xây dựng MVP](https://claude.ai/artifact/NKP9UCTnCyuL2ngNyaVHXX) và [Đặc tả bộ tính ngày công](https://claude.ai/artifact/67rpzF2DcocSBs4gtn22ik). Công nghệ đã chốt: Next.js + Ant Design, app nhân viên PWA cùng repo, PostgreSQL. Các quy tắc còn để ngỏ trong đặc tả bộ tính ngày công tạm dùng giá trị đề xuất.

## Phạm vi

MVP chỉ gồm phần Must Have; mọi thứ khác dời sang sau khi quán thử đầu tiên trả lương đúng một kỳ.

| Nhóm | Có trong MVP | Để sau (Should / Nice to have) |
| --- | --- | --- |
| Tài khoản | Đăng nhập bằng mã công ty + email + PIN; 4 cấp quyền; một công ty mỗi tài khoản | Gắn thiết bị, mở khoá máy; dùng thử theo ngành; mua gói |
| Cấu hình | Ca, vị trí (ca, ngày, địa điểm, lương tháng/giờ/công), địa điểm geofence, ngày lễ, quy tắc công ty | Bậc lương, phụ cấp, thưởng cố định, phạt, BHXH; thiết lập nhanh; mẫu ngành |
| Nhân sự | Thêm, sửa, Đã nghỉ; ghi đè lương/ca/địa điểm | Thêm hàng loạt, QR mời, xoá |
| Xếp ca | Xếp theo người theo tuần, lưu, Cho nghỉ | Chế độ cọ, rải lịch, chép tuần, mẫu tuần, đăng ký ca |
| Chấm công | VÀO/RA CA có GPS, chọn ca cho người linh hoạt | Chụp ảnh, ghi chú, offline |
| Bộ tính ngày công | Toàn bộ đặc tả, 50 ca kiểm thử | — |
| Duyệt | Hộp việc: lọc, chi tiết, duyệt theo đề xuất, điều chỉnh, duyệt/từ chối đơn | Duyệt hàng loạt, phím tắt, bản đồ trong chi tiết |
| Bảng công | Lưới tháng, drawer ngày, bảng công một người | Theo tuần, kỳ lệch, tự chọn, Excel |
| Đơn từ | Nghỉ phép, Quên chấm, Làm thêm; giải trình | Muộn/sớm, Đổi ca, Đăng ký ca |
| Lương | Tính lương tháng/giờ/công + OT, sao kê, thưởng/phạt tay, công bố, phiếu trong app | In PDF, Excel, công bố lại có lịch sử |
| Khác | — | Điều phối thời gian thực, tìm nhanh, màu thương hiệu, tour |

## Kiến trúc

&#91;embedded content: kiến trúc MVP · 2 giao diện, 1 máy chủ, 1 CSDL\]

Hai giao diện gọi chung một API; mọi lần chấm, duyệt hay đơn đều chạy qua bộ tính ngày công rồi ghi `day_records`, nên Hộp việc, Bảng công và Lương luôn đọc cùng một con số. Bản đồ dùng Leaflet + OpenStreetMap ngay trên trình duyệt.

## Màn hình MVP

Mười màn quản trị và bốn màn nhân viên; bố cục theo `05-ui-ux-specifications.md` (≥ 992 px: menu trái, < 992 px: thanh dưới).

| # | Màn hình | URL | Thành phần chính | Ai dùng |
| --- | --- | --- | --- | --- |
| A1 | Đăng nhập quản trị | `/app/login` | Mã công ty, email, PIN | Quản trị, Nhân sự, Quản lý nhóm |
| A2 | Hộp việc | `/app` | 4 thẻ số hôm nay; danh sách việc + chip lọc; chi tiết (thanh giờ, lý do, đề xuất); Duyệt / Điều chỉnh / Để sau | Như A1 |
| A3 | Bảng công | `/app/bang-cong` | Lưới tháng (ô ký hiệu + cột tổng); drawer ngày; drawer bảng công một người | Như A1 |
| A4 | Xếp ca | `/app/xep-ca` | Điều hướng tuần; dải 7 ô mỗi người; drawer chọn ca theo ngày; Cho nghỉ; thanh "N ô chưa lưu" | Quản trị, Nhân sự, Quản lý nhóm |
| A5 | Lương | `/app/luong` | Thẻ kỳ lương; danh sách nhân viên; sao kê "Vì sao ra số này"; thưởng/phạt; Công bố | Quản trị, Nhân sự |
| A6 | Nhân sự | `/app/nhan-su` | Danh sách + lọc trạng thái; drawer hồ sơ (thông tin, vị trí + ghi đè, quyền) | Quản trị, Nhân sự |
| A7 | Vị trí | `/app/vi-tri` | Thẻ vị trí; drawer: ca được làm, kiểu ca, ngày, địa điểm, kiểu lương, hệ số OT | Quản trị, Nhân sự |
| A8 | Ca & ngày lễ | `/app/vi-tri?tab=ca` | Thư viện ca + form ca; danh sách ngày lễ + thêm năm sau | Quản trị, Nhân sự |
| A9 | Địa điểm | `/app/dia-diem` | Bản đồ Leaflet; form: lấy vị trí hiện tại, ghim, bán kính 30–500 m, vị trí được chấm | Quản trị |
| A10 | Cài đặt | `/app/cai-dat` | Thông tin công ty; ngày làm việc; chế độ muộn; OT; ngày chốt kỳ | Quản trị |
| M1 | Đăng nhập nhân viên | `/m?ma=<mã>` | Email + PIN | Nhân viên |
| M2 | Chấm công | `/m` | Ca hôm nay; trạng thái GPS; chọn ca; nút VÀO/RA CA; dòng thời gian hôm nay | Nhân viên |
| M3 | Lịch & công | `/m#/lich` | Lịch tuần này/tuần sau; lịch tháng có chấm màu; chi tiết ngày + Gửi giải trình | Nhân viên |
| M4 | Lương | `/m#/luong` | Danh sách kỳ; phiếu đã công bố | Nhân viên |

Tạo đơn (Nghỉ phép, Quên chấm, Làm thêm) là bottom sheet mở từ nút "+" giữa thanh dưới của app nhân viên; Đăng xuất nằm ở menu tài khoản trên đầu M2.

## User story và tiêu chí nghiệm thu

36 story chia 10 epic; một story chỉ xong khi đạt hết tiêu chí nghiệm thu ở cột cuối. QL = quản lý (Quản trị viên, Nhân sự, Quản lý nhóm), NV = nhân viên.

| ID | Epic | User story | Tiêu chí nghiệm thu | Sprint |
| --- | --- | --- | --- | --- |
| US01 | Tài khoản | QL đăng nhập bằng mã công ty, email, PIN | Sai bất kỳ trường nào → "Thông tin đăng nhập không đúng" (không nói trường nào sai); 5 lần sai liên tiếp → khoá 15 phút; đúng → vào Hộp việc | 1 |
| US02 | Tài khoản | Hệ thống giới hạn theo 4 cấp quyền | Chỉ dùng app không vào được `/app`; Quản lý nhóm chỉ thấy người mình quản lý và không thấy số tiền lương; Nhân sự không sửa được Quản trị viên | 1 |
| US03 | Tài khoản | NV đăng nhập app bằng link có mã công ty | Mở `/m?ma=<mã>` tự điền mã; đăng nhập đúng → màn Chấm công; NV Đã nghỉ bị từ chối | 1 |
| US04 | Tài khoản | Người dùng giữ phiên và đăng xuất | Phiên quản trị 14 ngày, NV 90 ngày; Đăng xuất xoá phiên trên máy | 1 |
| US05 | Cấu hình | QL tạo và sửa ca | Đủ trường của form ca; mã ca không sửa được sau khi đã có lịch hoặc lần chấm; ca qua đêm tự nhận khi giờ ra < giờ vào; hiển thị "Làm X giờ Y phút (đã trừ nghỉ)" | 1 |
| US06 | Cấu hình | QL tạo và sửa vị trí | Chọn ca cố định hoặc linh hoạt, ca được làm, ngày làm, địa điểm (hoặc "ở đâu cũng được"), kiểu lương tháng/giờ/công, hệ số OT mặc định 150/200/300; lưu xong áp cho mọi người giữ vị trí | 1 |
| US07 | Cấu hình | QL đặt địa điểm chấm công | Lấy vị trí hiện tại (trung bình 5 lần đo) hoặc bấm bản đồ; bán kính 30–500 m; chọn vị trí được chấm tại đây | 1 |
| US08 | Cấu hình | QL quản lý ngày lễ | Thêm/xoá từng ngày; nút "Thêm ngày lễ Việt Nam năm N" thêm các ngày dương lịch cố định | 1 |
| US09 | Cấu hình | QL đặt quy tắc chấm công công ty | Ngày làm việc trong tuần, chế độ tính muộn, OT khi đến sớm, OT tối thiểu, tự duyệt OT theo đơn, ngày chốt kỳ; thanh "N thay đổi chưa lưu"; rời trang khi chưa lưu → hỏi xác nhận | 1 |
| US10 | Cấu hình | QL xem thông tin công ty và link cài app | Sửa tên, địa chỉ, tên app; nút chép link `/m?ma=<mã>` | 1 |
| US11 | Nhân sự | QL thêm nhân viên | Bắt buộc họ tên, email hợp lệ và không trùng; PIN tự sinh 4 số; chọn vị trí → hiện cấu hình thừa hưởng; lỗi hiện ngay cạnh trường | 1 |
| US12 | Nhân sự | QL sửa hồ sơ và ghi đè riêng | Công tắc Lương riêng / Ca riêng / Địa điểm riêng; tắt công tắc → quay lại theo vị trí; đặt lại PIN | 1 |
| US13 | Nhân sự | QL cho nhân viên nghỉ việc | Trạng thái Đã nghỉ: không đăng nhập được, ẩn khỏi xếp ca kỳ sau, bảng công cũ giữ nguyên | 1 |
| US14 | Xếp ca | QL xếp ca tuần cho từng người | Drawer theo người: bật/tắt ca từng ngày, một ngày nhiều ca; ca cố định hiện viền đứt, không cần xếp | 2 |
| US15 | Xếp ca | QL lưu hoặc bỏ thay đổi lịch | Ô đổi có chấm cam; thanh "N ô chưa lưu · ↶ · Lưu"; ↶ hỏi xác nhận; rời trang khi chưa lưu → hỏi xác nhận | 2 |
| US16 | Xếp ca | QL cho người ca cố định nghỉ một ngày | Ô thành "Nghỉ"; ngày đó 0 công, không báo vắng, không trừ phép | 2 |
| US17 | Chấm công | NV xem ca hôm nay và trạng thái vị trí | Hiện ca, giờ, địa điểm; "Trong vùng · X m" hoặc "Ngoài vùng · X m"; bị chặn quyền → hướng dẫn bật cho iPhone/Android | 2 |
| US18 | Chấm công | NV bấm VÀO CA | Ghi lần chấm với giờ server, toạ độ, độ chính xác GPS, trong/ngoài vùng tính ở server; thẻ kết quả: đúng giờ / muộn X phút / ngoài vùng | 2 |
| US19 | Chấm công | NV bấm RA CA | Nút đổi thành RA CA sau khi vào; bấm lặp không sai công; ở lại ≥ OT tối thiểu → báo "đã gửi đề xuất OT" | 2 |
| US20 | Chấm công | NV linh hoạt chọn ca khi chấm | Hiện chip các ca được phép, ca có lịch chọn sẵn; chọn ca ngoài lịch → cờ ngoài lịch | 2 |
| US21 | Ngày công | Bộ tính ngày công đúng đặc tả | 50/50 ca kiểm thử trong đặc tả chạy xanh trong CI | 2 |
| US22 | Ngày công | Ngày công luôn mới nhất | Lần chấm, duyệt, đơn, sửa lịch hoặc sửa ca/vị trí → tính lại ngày liên quan trong cùng giao dịch; Hộp việc, Bảng công, Lương khớp nhau ngay | 2 |
| US23 | Hộp việc | QL xem số liệu hôm nay | 4 thẻ: Đang trong ca x/y, Đi muộn hôm nay, Chưa chấm công (quá giờ vào 15 phút), Chờ xử lý | 3 |
| US24 | Hộp việc | QL xem và lọc việc cần xử lý | Chip có đếm theo loại; mỗi dòng có tên, ngày, loại, ca, mô tả, đề xuất; chip về 0 thì ẩn | 3 |
| US25 | Hộp việc | QL duyệt theo đề xuất | Chi tiết có thanh giờ, giờ vào/ra, "Vì sao hệ thống đề xuất"; bấm Duyệt → toast, việc biến mất, tự sang việc kế, số đếm giảm | 3 |
| US26 | Hộp việc | QL điều chỉnh khác | Số công (theo hệ thống/1/0,5/0), phút OT, duyệt thiếu giờ, tha muộn, ghi chú; Lưu duyệt chỉ bật khi có thay đổi | 3 |
| US27 | Bảng công | QL xem lưới công tháng | Hàng = NV, cột = ngày, ô theo 12 ký hiệu, cột tổng Công/Muộn/Thiếu/OT; tháng trước/sau; tìm tên, lọc vị trí | 3 |
| US28 | Bảng công | QL xem và sửa một ngày, một người | Bấm ô → drawer ngày (hệ thống tính + điều chỉnh + Hoàn duyệt); bấm tên → bảng công cả kỳ của người đó | 3 |
| US29 | Đơn từ | NV xin nghỉ phép | Loại phép năm/ốm/không lương, từ–đến, lý do; hiện phép còn lại; vượt phép còn lại (đã trừ đơn chờ) → không gửi được | 3 |
| US30 | Đơn từ | NV báo quên chấm | Ngày, ca, giờ vào/ra thực tế; duyệt xong → thêm lần chấm tổng hợp và tính lại | 3 |
| US31 | Đơn từ | NV đăng ký làm thêm | Ngày, trước/sau ca, từ–đến giờ, việc; duyệt xong + bật tự duyệt → OT trong khung đơn được duyệt sẵn | 3 |
| US32 | Đơn từ | NV gửi giải trình cho một ngày | Từ chi tiết ngày; hiện "Hệ thống ghi nhận"; lý do ≥ 10 ký tự hoặc chọn nhanh; nháp lưu trên máy | 3 |
| US33 | Đơn từ | QL duyệt hoặc từ chối đơn | Đơn hiện ở Hộp việc của quản lý trực tiếp (không có thì Quản trị/Nhân sự); từ chối có ô lý do tuỳ chọn; NV thấy trạng thái trong app | 3 |
| US34 | Lương | QL xem sao kê từng người | Mỗi dòng có số tiền và công thức chữ; OT chờ duyệt hiện riêng với thực lĩnh dự phóng; tổng quỹ lương và "x/N người sẵn sàng" | 4 |
| US35 | Lương | QL thêm thưởng/phạt cho kỳ | Số tiền > 0 và lý do bắt buộc; cộng/trừ thẳng vào thực lĩnh kỳ đang xem | 4 |
| US36 | Lương | QL công bố phiếu; NV xem phiếu | Hộp xác nhận nêu số phiếu, tổng tiền, việc tồn, OT chờ; công bố → lưu bản chụp bất biến; NV thấy phiếu trong M4; sửa sau công bố → trang Lương báo "cần công bố lại" | 4 |

## Thiết kế CSDL (PostgreSQL)

21 bảng, mọi bảng nghiệp vụ có `company_id` để tách dữ liệu từng công ty; ngày lưu kiểu `date`, thời điểm lưu `timestamptz`, tiền lưu `bigint` đồng.

| Bảng | Cột chính | Khoá / ràng buộc |
| --- | --- | --- |
| companies | code, name, address, app\_name, brand\_color, work\_days int\[\], grace\_mode, ot\_before, ot\_min, ot\_from\_request, cutoff\_day | code unique |
| locations | name, address, lat, lng, radius\_m | radius 30–500 |
| shifts | code, name, start\_time, end\_time, break\_start, break\_end, overnight, calc (block / actual / actual\_strict), std\_hours, min\_full, min\_half, grace\_min, min\_ot, is\_part, no\_late\_check | unique (company\_id, code); code bất biến khi đã dùng |
| positions | name, shift\_mode (fixed / flexible), fixed\_shift\_id, work\_days int\[\], any\_location, pay\_type (month / hour / unit), pay\_amount, std\_days, leave\_days, ot\_weekday, ot\_saturday, ot\_offday, ot\_holiday |  |
| position\_shifts | position\_id, shift\_id | PK cặp |
| position\_locations | position\_id, location\_id | PK cặp |
| employees | email, name, pin\_hash, status (active / left), contract, onboard\_date, role (app / manager / hr / admin), manager\_id, position\_id, pay\_override jsonb | unique (company\_id, email) |
| employee\_shifts | employee\_id, shift\_id | ghi đè ca riêng |
| employee\_locations | employee\_id, location\_id | ghi đè địa điểm riêng |
| sessions | employee\_id, token\_hash, kind (admin / app), expires\_at |  |
| holidays | date, name | unique (company\_id, date) |
| schedule\_cells | employee\_id, date, shift\_ids uuid\[\], is\_off | unique (employee\_id, date) |
| attendance\_logs | employee\_id, at, type (in / out), chosen\_shift\_id, lat, lng, accuracy\_m, in\_zone, distance\_m, location\_id, synthetic, source\_request\_id | index (employee\_id, at) |
| requests | employee\_id, type (leave / forgot / overtime), payload jsonb, from\_date, to\_date, reason, status (pending / approved / rejected), decided\_by, decided\_at, reject\_note |  |
| explanations | employee\_id, date, shift\_id, reason, status | unique (employee\_id, date, shift\_id) |
| approvals | employee\_id, date, shift\_id, cong\_override, ot\_minutes, approve\_missing, waive\_late, waive\_early, confirm\_shift\_id, approve\_gps, note, by, at, revoked\_at | một bản ghi hiệu lực cho mỗi (employee, date, shift) |
| day\_records | employee\_id, date, shift\_id, status, in\_at, out\_at, worked\_min, cong, expected\_cong, late\_min, early\_min, ot\_proposed, ot\_approved, ot\_state, missing, flags text\[\], needs\_review, notes jsonb, computed\_at | unique (employee\_id, date, shift\_id); bảng kết quả, tính lại được |
| adjustments | period\_key, employee\_id, kind (bonus / penalty), amount, note, by |  |
| payroll\_periods | period\_key, from\_date, to\_date, published, published\_at, published\_by, stale | unique (company\_id, period\_key) |
| payslips | period\_id, employee\_id, net, lines jsonb, summary jsonb, published\_at | bản chụp bất biến |
| audit\_logs | actor\_id, action, entity, entity\_id, before jsonb, after jsonb, at | chỉ thêm |

- PIN chỉ lưu dạng băm; không API nào trả PIN gốc sau lúc tạo (khắc phục điểm yếu bản gốc).
- Phép năm còn lại tính từ `positions.leave_days` (hoặc ghi đè) trừ đơn phép năm đã duyệt và đang chờ trong năm.

## Danh sách API

36 nhóm endpoint REST JSON dưới `/api/v1`; công ty lấy từ phiên đăng nhập, không bao giờ từ tham số, và mọi endpoint ghi đều sinh dòng `audit_logs`.

| Method | Đường dẫn | Mục đích | Quyền | Story |
| --- | --- | --- | --- | --- |
| POST | /auth/admin/login | Đăng nhập quản trị | Công khai | US01 |
| POST | /auth/app/login | Đăng nhập nhân viên | Công khai | US03 |
| POST | /auth/logout | Đăng xuất | Đã đăng nhập | US04 |
| GET | /me | Người dùng, công ty, quyền | Đã đăng nhập | US02 |
| GET / PATCH | /company | Thông tin và quy tắc công ty | Quản trị | US09, US10 |
| GET / POST / PATCH / DELETE | /shifts\[/:id\] | Thư viện ca | Nhân sự+ | US05 |
| GET / POST / PATCH / DELETE | /positions\[/:id\] | Vị trí | Nhân sự+ | US06 |
| GET / POST / PATCH / DELETE | /locations\[/:id\] | Địa điểm | Quản trị | US07 |
| GET / POST / DELETE | /holidays\[/:id\] | Ngày lễ | Nhân sự+ | US08 |
| POST | /holidays/seed-vn?year= | Thêm ngày lễ Việt Nam cố định của năm | Nhân sự+ | US08 |
| GET / POST | /employees | Danh sách, thêm nhân viên | Nhân sự+ | US11 |
| GET / PATCH | /employees/:id | Hồ sơ, sửa, Đã nghỉ | Nhân sự+ | US12, US13 |
| POST | /employees/:id/reset-pin | Tạo PIN mới, trả về đúng một lần | Nhân sự+ | US12 |
| GET | /schedule?week= | Lưới lịch một tuần | QL | US14 |
| PUT | /schedule | Lưu danh sách ô thay đổi | QL | US15, US16 |
| GET | /inbox?period= | Việc cần xử lý + đếm theo loại | QL | US24 |
| GET | /overview/today | 4 thẻ số hôm nay | QL | US23 |
| POST | /approvals | Duyệt theo đề xuất hoặc điều chỉnh | QL | US25, US26 |
| DELETE | /approvals/:id | Hoàn duyệt | QL | US28 |
| GET | /timesheet?period= | Lưới công kỳ + tổng | QL | US27 |
| GET | /timesheet/:employeeId?period= | Bảng công một người | QL | US28 |
| GET | /day/:employeeId/:date | Chi tiết ngày (ca, lần chấm, hệ thống tính) | QL | US28 |
| POST | /requests/:id/decide | Duyệt / từ chối đơn | QL | US33 |
| GET | /payroll?period= | Quỹ lương, trạng thái, danh sách | Nhân sự+ | US34 |
| GET | /payroll/:employeeId?period= | Sao kê một người | Nhân sự+ | US34 |
| POST / DELETE | /adjustments\[/:id\] | Thưởng/phạt kỳ | Nhân sự+ | US35 |
| POST | /payroll/publish?period= | Công bố, tạo bản chụp phiếu | Nhân sự+ | US36 |
| GET | /app/home | Ca hôm nay, ca được chọn, địa điểm, trạng thái | NV | US17, US20 |
| POST | /app/punch | Chấm vào/ra (server tính trong vùng, ghép ca, tính lại) | NV | US18, US19 |
| GET | /app/schedule?week= | Lịch tuần này, tuần sau | NV | M3 |
| GET | /app/timesheet?month= | Bảng công tháng của tôi | NV | M3 |
| POST | /app/requests | Gửi đơn nghỉ phép / quên chấm / làm thêm | NV | US29–US31 |
| GET | /app/requests | Đơn của tôi | NV | US33 |
| POST | /app/explanations | Gửi giải trình | NV | US32 |
| GET | /app/payslips | Danh sách kỳ đã công bố | NV | US36 |
| GET | /app/payslips/:periodKey | Phiếu một kỳ | NV | US36 |

"Nhân sự+" = Nhân sự và Quản trị viên; "QL" gồm cả Quản lý nhóm nhưng dữ liệu bị lọc theo người mình quản lý.

## Yêu cầu phi chức năng

Mười yêu cầu dưới đây đo được và được kiểm trước khi đưa quán thử dùng.

| Hạng mục | Yêu cầu |
| --- | --- |
| Bảo mật | PIN băm (argon2/bcrypt); khoá 15 phút sau 5 lần sai; token phiên chỉ lưu dạng băm ở server, cookie httpOnly; mọi truy vấn lọc theo `company_id` |
| Chống gian lận | Giờ chấm lấy giờ server; trong/ngoài vùng tính ở server từ toạ độ gửi lên; lưu độ chính xác GPS |
| Đúng số | Engine là hàm thuần, 50 ca kiểm thử chạy trong CI; mỗi số trên sao kê có công thức chữ |
| Nhất quán | Ghi + tính lại ngày công trong một giao dịch; Hộp việc, Bảng công, Lương đọc cùng `day_records` |
| Hiệu năng | Lưới bảng công 120 NV × 31 ngày tải < 1,5 giây; bấm VÀO CA phản hồi < 1 giây trên 4G |
| Múi giờ | Mọi ngày công tính theo Asia/Ho\_Chi\_Minh; ca qua đêm thuộc ngày bắt đầu |
| Thiết bị | App nhân viên chạy trên Safari iOS 16+ và Chrome Android 10+; cài lên màn hình chính (PWA manifest) |
| Truy vết | Mọi thao tác ghi có dòng `audit_logs` (ai, lúc nào, trước/sau) |
| Sao lưu | Sao lưu CSDL hằng ngày, giữ 30 ngày |
| Ngôn ngữ | Toàn bộ giao diện tiếng Việt, tiền định dạng 1.234.567đ, ngày dd/mm/yyyy |

## Backlog theo 4 sprint

Mỗi sprint 2–2,5 tuần và kết thúc bằng một bản chạy được để xem thử; thứ tự đi theo phụ thuộc dữ liệu.

1. **Sprint 1 — Nền tảng và cấu hình** (US01–US13): khởi tạo repo Next.js + Ant Design + Postgres, migration 21 bảng, đăng nhập + phân quyền, màn A1, A6–A10, M1. Demo: tạo được công ty "Cà phê Phố Nhỏ" với 5 vị trí, 6 ca, 2 địa điểm, 8 nhân viên.
2. **Sprint 2 — Lịch, chấm công, bộ tính ngày công** (US14–US22): màn A4, M2; engine theo đặc tả + 50 ca kiểm thử trong CI; tính lại theo sự kiện. Demo: xếp ca 1 tuần, 2 người chấm thật tại quán, ngày công ra đúng.
3. **Sprint 3 — Duyệt, bảng công, đơn từ** (US23–US33): màn A2, A3, M3, sheet Tạo đơn. Demo: một tuần dữ liệu thật, quản lý duyệt hết việc trong Hộp việc.
4. **Sprint 4 — Lương và chạy thử** (US34–US36): màn A5, M4; so lương với bảng tính tay của quán; sửa lỗi; triển khai production. Demo: công bố phiếu kỳ đầu tiên.

Song song từ Sprint 1: dựng design tokens và 4 màn mẫu (Hộp việc, Bảng công, Xếp ca, Chấm công) theo Bước 4 của kế hoạch.

## Định nghĩa hoàn thành và phụ thuộc còn mở

MVP xong khi quán thử dùng trọn một kỳ tháng và lương app tính khớp bảng tính tay.

- [ ] 36/36 story đạt tiêu chí nghiệm thu
- [ ] 50/50 ca kiểm thử bộ tính ngày công xanh trong CI
- [ ] Một quán thật dùng đủ 1 kỳ; chênh lệch lương so với tính tay = 0đ (hoặc giải thích được từng dòng)
- [ ] Chạy ổn trên ít nhất 1 iPhone và 1 Android của nhân viên thật
- [ ] Đã triển khai production có sao lưu hằng ngày

**Phụ thuộc còn mở:** các câu hỏi của [Đặc tả bộ tính ngày công](02-dac-ta-engine-ngay-cong.md) đã chốt ngày 01/11/2026, riêng công ca ghép cần xác nhận bằng bảng lương thật trước Sprint 4; chọn tên miền trước Sprint 4; tìm quán thử trước Sprint 3.
