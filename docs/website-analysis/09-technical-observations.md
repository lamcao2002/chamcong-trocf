# 09. Quan sát kỹ thuật

> Chỉ ghi nhận những gì quan sát được hợp pháp từ trình duyệt khi dùng demo công khai: tài nguyên tải về, tên chunk, response API mà chính giao diện gọi, localStorage của chính phiên. Không gọi API ngoài luồng giao diện, không truy cập dữ liệu riêng tư.

## 1. Frontend

| Hạng mục | Quan sát | Bằng chứng | Kiểm chứng |
|---|---|---|---|
| Framework | **React** | Chunk `assets/react-5qNoNoy7.js`; `#root` mount | CONFIRMED (tên chunk) |
| Thư viện UI | **Ant Design v5** (CSS-in-JS) | Class `ant-app`, `ant-col-*`, `:where(.css-2jrse6)`, chunk `antd-r4c-wSK7.js`; transition `cubic-bezier(0.645,0.045,0.355,1)` | CONFIRMED |
| Build tool | **Vite** (hoặc Rollup-based) | Asset dạng `/assets/<Tên>-<hash 8 ký tự>.js`, code-splitting theo trang (`Home-`, `Live-`, `Timesheet-`, `Schedule-`, `Payroll-`, `Staff-`, `Invite-`, `QuickSetup-`, `Positions-`, `PositionDrawer-`, `Locations-`, `LocationPicker-`, `MapView-`, `Settings-`, `PeriodBar-`, `Photo-`) | INFERRED |
| Icon | **lucide** (lucide-react) | Chunk icon tên kebab: `chevron-down`, `triangle-alert`, `refresh-cw`, `calendar-range`, `shield-alert`, `bell-off`, `user-round`, `undo-2`, `log-in`, `trash-2`… | INFERRED (đúng quy ước tên lucide) |
| Bản đồ | **Leaflet** + tile **OpenStreetMap** | Attribution "Leaflet \| © OpenStreetMap", `map-CIGW-MKW.css` | CONFIRMED |
| Xuất Excel | **SheetJS (xlsx)** phía client | Chunk `xlsx-DJ2dwYa-.js` tải khi vào Bảng công | INFERRED |
| Font | Be Vietnam Pro (Google Fonts, 400–800) | link stylesheet | CONFIRMED |
| Router admin | History API, path `/app/<slug>` + query | URL đổi không reload | CONFIRMED |
| Router app NV | Hash router `#/lich`, `#/luong`, `#/toi` | URL | CONFIRMED |
| Bundle app NV | Bundle riêng `assets/m-NhOuxE_V.js` | script | CONFIRMED |
| PWA | Manifest `/m/manifest.webmanifest`, `theme-color` `#2f9a4c` ở admin | head | CONFIRMED |
| Service worker | Không có controller | `navigator.serviceWorker.controller` = null | CONFIRMED |
| Lazy load | Chunk tải trước (prefetch) gần như toàn bộ trang sau khi vào Hộp việc | Network list | CONFIRMED |

## 2. API (quan sát qua luồng giao diện)

- **Kiểu:** RPC — tất cả là `POST https://chamcong.worksheet.vn/api/v2/<nhóm>/<hành động>`, response JSON `{success: true, ...}`. (CONFIRMED)
- **Auth header:** giá trị bị che trong công cụ (REDACTED) — cơ chế cụ thể UNKNOWN; token lưu localStorage (xem §4). (CONFIRMED key)

| Endpoint | Gọi khi | Response chính | Kiểm chứng |
|---|---|---|---|
| `/api/v2/demo/info` | Mở demo / app NV demo | company, brand, industry, admin, accounts[] | CONFIRMED |
| `/api/v2/admin/login` | Đăng nhập admin | (UNKNOWN nội dung) | CONFIRMED endpoint |
| `/api/v2/admin/bootstrap` | Sau login | me, company, settings, shifts, holidays, positions, locations, staff (kèm PIN), categories, steps, pending | CONFIRMED |
| `/api/v2/shop/plans` | Sau bootstrap | plans[] giá gói | CONFIRMED |
| `/api/v2/admin/inbox` | Hộp việc, sau mỗi duyệt | period, items[] | CONFIRMED |
| `/api/v2/admin/overview` | Hộp việc, sau mỗi duyệt | stats, today_rows, trend, feed | CONFIRMED |
| `/api/v2/admin/approve` | Duyệt ô công | `{success, message:"Đã duyệt 1 ô."}` | CONFIRMED |
| `/api/v2/admin/request/decide` | Duyệt/Từ chối đơn | (UNKNOWN) | CONFIRMED endpoint |
| `/api/v2/admin/live` | Điều phối | (UNKNOWN chi tiết) | CONFIRMED endpoint |
| `/api/v2/admin/timesheet` | Bảng công, Lương | period, holidays, employees[{summary, pay, days[]}] | CONFIRMED |
| `/api/v2/admin/payroll/status` | Lương | trạng thái công bố | CONFIRMED |
| `/api/v2/admin/adjust/list` | Lương | thưởng/phạt kỳ | CONFIRMED |
| `/api/v2/admin/schedule` | Xếp ca | cells[], registrations[] | CONFIRMED |
| `/api/v2/app/login` | Đăng nhập NV | (UNKNOWN) | CONFIRMED endpoint |
| `/api/v2/app/home` | Màn chấm công | user, company, features, next, todayShifts, choices, locations, freeMode, requireCamera, leave, notices, pending | CONFIRMED |
| `/api/v2/app/timesheet` · `/schedule` · `/payslips` · `/payslip` · `/requests` | Các tab app NV | | CONFIRMED endpoint |
| Endpoint ghi khác (lưu lịch, rải lịch, nhận đăng ký, lưu nhân viên, vị trí, ca, địa điểm, cài đặt, công bố, thưởng/phạt, chấm công, gửi đơn) | | | UNKNOWN (không thực thi lưu) |

**Ghi chú:**
- Mốc thời gian dùng **số phút** tuyệt đối (`t`, `inAbs`, `startAbs`…, ví dụ 29.890.640) — INFERRED là phút kể từ Unix epoch.
- Lương (`pay.lines[].how`) **tính phía server** và trả kèm công thức dạng văn bản. (CONFIRMED)
- Một số bản ghi có `row` (số dòng) → backend đọc/ghi Google Sheet theo dòng. (INFERRED từ dữ liệu + tuyên bố sản phẩm)
- Sau thao tác ghi, client **gọi lại** các endpoint đọc (không thấy websocket). Điều phối "tự làm mới mỗi phút" → polling. (CONFIRMED gọi lại / INFERRED polling)
- Hướng dẫn: hệ thống đọc lại Sheet sau 1–2 phút khi sửa tay → có lớp cache phía server. (INFERRED)

## 3. Backend & lưu trữ

| Hạng mục | Quan sát | Kiểm chứng |
|---|---|---|
| Lưu trữ dữ liệu | Google Sheet của từng doanh nghiệp (tab: chấm công, lịch, đơn từ, lương…) | CONFIRMED (tuyên bố sản phẩm, FAQ) |
| Ảnh chấm công | Thư mục Google Drive của doanh nghiệp chia sẻ cho "email bot của Worksheet" quyền chỉnh sửa | CONFIRMED (văn bản Cài đặt) |
| Ràng buộc Sheet | "Không thêm, xoá hoặc đổi thứ tự cột" | CONFIRMED (FAQ) |
| Health check | "Kiểm tra dữ liệu" quét tab/cột/nhân viên/ca/địa điểm/nhật ký; auto-fix an toàn (thêm tab/cột thiếu ở cuối) | CONFIRMED văn bản |
| Ngôn ngữ/ hạ tầng server | — | UNKNOWN |
| Bản cũ | `/cu/admin` cùng Google Sheet | INFERRED (hướng dẫn) |

## 4. Authentication & phiên (client)

| Key localStorage | Ý nghĩa (INFERRED theo tên) |
|---|---|
| `ehrm2_tok_admin_<MÃ CÔNG TY>` | Token phiên admin theo công ty |
| `ehrm2_tok_app_<MÃ>` | Token phiên app nhân viên |
| `ehrm2_boot_<MÃ>_<hash>` | Cache dữ liệu bootstrap |
| `ehr_device_uid` | ID thiết bị (gắn máy chống chấm hộ) |
| `ehrm2_brand`, `ehrm2_m_brand` | Màu thương hiệu (dùng ngay cả ở màn đăng nhập) |
| `ehrm2_m_email` | Email đăng nhập gần nhất |
| `ehrm2_m_draft_request_<email>` | Nháp đơn/giải trình |
| `ehrm2_m_seen_<email>` | Thông báo đã xem |
| `ehrm2_coach_<trang>` | Đã xem tour |
| `ehrm2_xepca_view` | Chế độ xem Xếp ca |
| `ehrm2_ky_luong` | Loại kỳ đã chọn |
| `ehrm2_tile` | (UNKNOWN — có thể lớp bản đồ) |

- Đăng nhập: Mã công ty + Email + PIN (4–8 số). Phiên admin nhớ 14 ngày; app NV "rất lâu". (CONFIRMED form / INFERRED thời hạn)
- Không thấy cookie phiên trong quan sát; token ở localStorage. (INFERRED)

## 5. Tích hợp bên ngoài

| Dịch vụ | Dùng cho | Kiểm chứng |
|---|---|---|
| Google Sheets / Drive | Lưu dữ liệu, ảnh | CONFIRMED (tuyên bố) |
| OpenStreetMap tiles | Bản đồ | CONFIRMED |
| Google Maps | Dán link để lấy toạ độ; "Kiểm tra trên Google Maps" | CONFIRMED (UI) |
| Google Forms | Báo lỗi & góp ý | CONFIRMED |
| Google Fonts | Font | CONFIRMED |
| Geocoding khi "gõ địa chỉ → Tìm" | Nhà cung cấp UNKNOWN | UNKNOWN |
| Thanh toán | QR chuyển khoản ngân hàng, email kích hoạt | CONFIRMED văn bản / UNKNOWN cổng |
| Trình duyệt | Geolocation API, Camera (getUserMedia) | CONFIRMED geolocation (lỗi "quyền: denied"), camera INFERRED |

## 6. Quan sát bảo mật (trung lập, để tránh lặp lại khi xây sản phẩm mới)

| # | Quan sát | Kiểm chứng | Gợi ý cho sản phẩm mới |
|---|---|---|---|
| 1 | `admin/bootstrap` trả **mã PIN dạng rõ** của mọi nhân viên cho trình duyệt admin | CONFIRMED (dữ liệu demo) | Hash PIN; chỉ hiển thị khi vừa tạo/đặt lại |
| 2 | Modal "Gửi link cài app" hiển thị PIN của mọi người | CONFIRMED | Tạo link mời 1 lần / OTP |
| 3 | PIN 4 số là mặc định | CONFIRMED | Giới hạn số lần thử, khoá tạm |
| 4 | Token lưu localStorage | INFERRED | Cân nhắc httpOnly cookie |
| 5 | Gắn thiết bị bằng UID lưu localStorage | INFERRED | Có thể bị xoá/giả lập; kết hợp thêm tín hiệu |
| 6 | Toạ độ & bán kính địa điểm gửi xuống app NV | CONFIRMED | Kiểm tra geofence phía server |

## 7. Hiệu năng & hành vi

- Trang chuyển không reload, dữ liệu bootstrap cache trong localStorage. (CONFIRMED)
- Skeleton loading cho Hộp việc. (CONFIRMED)
- Toàn bộ chunk trang được prefetch sau lần tải đầu. (CONFIRMED)
- Số liệu có thể lệch tạm thời giữa các màn (vd OT đã duyệt ở Hộp việc nhưng sao kê vẫn hiện "chờ"). (CONFIRMED hiện tượng / nguyên nhân UNKNOWN)

## 8. Không khẳng định
Không có bằng chứng về: ngôn ngữ backend, cơ sở dữ liệu ngoài Google Sheet, hạ tầng hosting/CDN, cơ chế push notification, nhà cung cấp email.
