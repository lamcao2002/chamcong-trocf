# 06. Luồng người dùng (User Flows)

Ký hiệu: nhánh ✅ thành công · ❌ thất bại · ⚠️ ngoại lệ. Bước có [I] là suy luận (hướng dẫn chính thức / dữ liệu), còn lại CONFIRMED.

## UF-01 · Quản trị đăng nhập & vào demo

```mermaid
flowchart TD
  S([Mở /app/]) --> T{Đã có phiên?}
  T -- Có --> INBOX[Hộp việc]
  T -- Không --> L[Form đăng nhập]
  L --> C{Chọn}
  C -- Đăng nhập --> F[Nhập Mã công ty, Email, PIN]
  F --> V{Hợp lệ?}
  V -- ✅ --> B[admin/login → admin/bootstrap] --> INBOX
  V -- ❌ --> E[Thông báo lỗi - nội dung UNKNOWN] --> F
  C -- Xem dữ liệu mẫu --> D["/app/?demo=1 chọn ngành"]
  D --> DI[demo/info → login → bootstrap] --> INBOX
  C -- Thử công ty mới --> TR[UNKNOWN]
  C -- Xem hướng dẫn --> G["/huong-dan/"]
  INBOX --> FS{Công ty mới, setupDone=false?}
  FS -- Có [I] --> QS[Thiết lập nhanh tự mở]
  FS -- Không --> END([Làm việc])
```

## UF-02 · Thiết lập công ty lần đầu (Thiết lập nhanh)

```mermaid
flowchart TD
  A([Mở Thiết lập nhanh]) --> S1[B1: Tên công ty, quy mô, ngành]
  S1 --> N1{Có ngành giống?}
  N1 -- Có --> P[Gợi ý vị trí/ca/lương theo ngành]
  N1 -- Không --> NK[Ngành khác: 2 vị trí cơ bản - I]
  P --> S2[B2: Bật/tắt vị trí, ca cố định/linh hoạt, ca, kiểu lương, mức, ngày]
  NK --> S2
  S2 --> S3[B3: Địa điểm - lấy GPS / link Maps / tìm địa chỉ / bấm bản đồ, bán kính]
  S3 --> SK{Đã có địa điểm?}
  SK -- Bỏ qua --> S4
  SK -- Tiếp tục --> S4[B4: Dán danh sách nhân viên]
  S4 --> V{Dòng hợp lệ?}
  V -- Có dòng lỗi --> W[Báo dòng lỗi, bỏ qua dòng đó]
  V -- OK --> H[Hoàn tất thiết lập]
  W --> H
  H --> R[Màn cuối: QR + link + PIN từng người - I]
  R --> INV[Chép tin gửi Zalo]
  A -. "✕ / Để sau" .-> X([Đóng, làm sau])
```

## UF-03 · Nhân viên chấm công vào/ra ca

```mermaid
flowchart TD
  S([NV mở /m/ trên điện thoại]) --> LG{Đã đăng nhập?}
  LG -- Không --> LI[Email + PIN] --> DEV{Máy đã gắn tài khoản khác?}
  DEV -- Có --> BLK[❌ Máy bị khoá → nhờ quản lý Mở khoá máy - I]
  DEV -- Không --> HOME
  LG -- Có --> HOME[app/home: ca hôm nay, địa điểm, next=in/out]
  HOME --> GPS{Quyền vị trí?}
  GPS -- Bị chặn --> GERR[⚠️ Khối hướng dẫn bật định vị + mã lỗi + nút Bật định vị] --> GPS
  GPS -- Cho phép --> ZONE{Trong vùng?}
  ZONE -- Trong vùng --> BTN
  ZONE -- Ngoài vùng --> BTN2[⚠️ Vẫn chấm được, ghi khoảng cách - I]
  BTN2 --> BTN
  BTN[Bấm VÀO CA] --> CAM{Công ty bắt chụp ảnh và NV không miễn?}
  CAM -- Có --> PH[Chụp mặt → Chụp và gửi - I]
  CAM -- Không --> SAVE
  PH --> SAVE[Ghi log vào: giờ, toạ độ, geo, ảnh, ca]
  SAVE --> RES{Kết quả}
  RES -- Đúng giờ ✅ --> OK[Thẻ kết quả]
  RES -- Muộn / ngoài vùng ⚠️ --> EXP[Gợi ý Gửi giải trình]
  OK --> OUT[Khi về: bấm RA CA]
  EXP --> OUT
  OUT --> OT{Ở lại ≥ OT tối thiểu?}
  OT -- Có --> OTP[Tạo đề xuất OT chờ duyệt]
  OT -- Không --> DONE([Ngày công được hệ thống tính])
  OTP --> DONE
  SAVE -. "Bấm 2 lần" .-> DUP[⚠️ Báo đã có lần vào lúc… chỉ ghi thêm - I]
```

**Quy tắc ghép ca [C dữ liệu / I cơ chế]:** NV linh hoạt có thể chọn ca khi chấm (`log.shift`); hệ thống so giờ thực tế với khung ca — nếu chọn CHIEU mà giờ khớp SANG → cờ `sai_ca` + đề xuất "Xác nhận ca Ca sáng". Thiếu log ra → `thieu_ra`/"thiếu giờ". Không có log và không có đơn → `vang`.

## UF-04 · Quản lý duyệt việc hằng ngày (Hộp việc)

```mermaid
flowchart TD
  S([Mở Hộp việc]) --> K[Xem 4 KPI hôm nay]
  K --> L[Danh sách việc + chip lọc]
  L --> M{Cách duyệt}
  M -- Nhanh --> Q[Bấm ✓ Duyệt trên dòng]
  M -- Hàng loạt --> B[Tích nhiều dòng → Duyệt theo đề xuất · N]
  M -- Xem kỹ --> D[Mở chi tiết: timeline, ảnh, lý do, bản đồ]
  D --> A{Quyết định}
  A -- Đồng ý đề xuất / phím A --> AP[admin/approve]
  A -- Phương án khác --> ALT[vd Không tính OT] --> AP
  A -- Điều chỉnh khác… --> ADJ[Số công, phút OT, duyệt thiếu giờ, ghi chú] --> LS[Lưu duyệt] --> AP
  A -- Để sau --> NXT[Sang việc khác]
  A -- E --> TS[Mở Bảng công ngày đó]
  Q --> AP
  B --> AP
  AP --> R{Kết quả}
  R -- ✅ --> T[Toast Đã duyệt N ô → reload inbox+overview → tự chuyển việc kế]
  R -- ❌ lỗi mạng/server --> ER[Thông báo lỗi - UNKNOWN nội dung]
  T --> EMPTY{Còn việc?}
  EMPTY -- Không --> E0([Danh sách rỗng - empty state UNKNOWN])
  EMPTY -- Có --> L
  D --> REQ{Là đơn từ?}
  REQ -- Có --> RD[Duyệt / Từ chối / Để sau → request/decide]
```

## UF-05 · Nhân viên gửi đơn / giải trình và quản lý xử lý

```mermaid
flowchart TD
  S([NV: + Tạo đơn]) --> TY{Loại đơn}
  TY --> NP[Nghỉ phép] --> CK{Vượt phép còn lại?}
  CK -- Có --> X1[❌ Không gửi được - I]
  CK -- Không --> SUB
  TY --> MS[Muộn/sớm] --> SUB
  TY --> LT[Làm thêm] --> SUB
  TY --> DC[Đổi ca] --> SUB
  TY --> DK[Đăng ký ca] --> SUB
  TY --> QC[Quên chấm] --> SUB
  SUB[Gửi] --> VAL{Đủ trường?}
  VAL -- Thiếu --> ERR[⚠️ Báo lỗi cạnh ô] --> TY
  VAL -- Đủ --> PEND[Đơn Chờ duyệt → Tôi › Đơn của tôi]
  PEND --> INB[Hiện trong Hộp việc của quản lý trực tiếp]
  INB --> DEC{Quản lý}
  DEC -- Duyệt ✅ --> EFF[Áp vào bảng công / lịch / phép]
  DEC -- Từ chối ❌ --> RJ[NV thấy trạng thái Từ chối + thông báo]
  EFF --> NOTI[Chấm đỏ mục Tôi - thông báo]
  G([NV: Giải trình ngày X]) --> GT[Sheet: Hệ thống ghi nhận + Lý do / chọn nhanh]
  GT --> GV{Lý do đủ dài?}
  GV -- Không --> GE[⚠️ Ghi rõ lý do…] --> GT
  GV -- Có --> GS[Gửi → explanation status Chờ duyệt] --> INB
```

## UF-06 · Xếp ca tuần & nhận đăng ký

```mermaid
flowchart TD
  S([Mở Xếp ca]) --> W[Chọn tuần ‹ ›]
  W --> BN{Có đăng ký chờ nhận?}
  BN -- Có --> NB[Banner → Xem tuần sau]
  NB --> AC{Nhận}
  AC -- Nhận tất cả N --> WR[Ghi vào lịch ngay ✅]
  AC -- Từng ô ✓ nhận / ✕ từ chối - desktop --> WR
  BN -- Không --> MODE{Cách xếp}
  MODE -- Theo người --> P[Drawer người: bật/tắt chip ca từng ngày] --> DIRTY
  MODE -- Theo ngày / cọ --> BR[Chọn ca trên palette → bấm người/ô] --> DIRTY
  MODE -- Cho nghỉ --> OFF[Chọn Cho nghỉ → bấm ô người ca cố định] --> DIRTY
  MODE -- Chép tuần trước --> CF{Xác nhận N người, M ca}
  CF -- Huỷ --> W
  CF -- Chép --> DIRTY
  MODE -- Mẫu tuần --> TP{Có mẫu?}
  TP -- Không --> SV[Lưu tuần đang xem thành mẫu]
  TP -- Có --> AP[Áp mẫu] --> DIRTY
  MODE -- Rải lịch --> RL[Chọn NV, khoảng ngày, nhóm ca×thứ, tuỳ chọn] --> RV{Hợp lệ?}
  RV -- Không --> RD[Nút Rải disabled]
  RV -- Có --> WR
  DIRTY[Ô có chấm cam, thanh N ô chưa lưu] --> DS{Quyết định}
  DS -- Lưu --> SAVE[Lưu ✅ → NV thấy lịch mới - I]
  DS -- ↶ Bỏ --> CFM{Bỏ N thay đổi?}
  CFM -- Giữ lại --> DIRTY
  CFM -- Bỏ thay đổi --> W
```

## UF-07 · Chốt & công bố lương

```mermaid
flowchart TD
  S([Mở Lương, chọn kỳ]) --> O[Xem quỹ lương, OT đã/chờ duyệt, ngày công cần xử lý]
  O --> P{Còn việc tồn?}
  P -- Có --> H[Mở Hộp việc xử lý] --> O
  P -- Không / chấp nhận --> L[Kiểm tra từng người: Vì sao ra số này]
  L --> AJ{Cần thưởng/phạt?}
  AJ -- Có --> AM[Modal: NV, loại, số tiền, lý do]
  AM --> AV{Hợp lệ?}
  AV -- ❌ số tiền ≤0 / thiếu lý do --> AE[Báo lỗi đỏ] --> AM
  AV -- ✅ --> L
  AJ -- Không --> PUB[Công bố phiếu lương]
  PUB --> CF[Modal: số phiếu, tổng, cảnh báo tồn, OT chờ, đóng băng]
  CF -- Xử lý trước ở Hộp việc --> H
  CF -- Huỷ --> O
  CF -- Công bố N phiếu ✅ --> FZ[Phiếu đóng băng → NV thấy trong app + thông báo]
  FZ --> CH{Sửa sau công bố?}
  CH -- Có --> RP[Trang Lương báo số liệu đổi → Công bố lại - I]
  CH -- Huỷ công bố - I --> O
  O --> EX[In phiếu / Xuất Excel - I]
```

## UF-08 · Thêm nhân viên & mời cài app

```mermaid
flowchart TD
  S([Nhân sự]) --> M{Cách thêm}
  M -- 1 người --> F[Drawer: họ tên, email, PIN tự sinh, vị trí, quyền…]
  F --> V{Hợp lệ?}
  V -- ❌ --> E[Một dòng lỗi đỏ ở chân: Nhập họ tên. …] --> F
  V -- ✅ --> SV[Thêm nhân viên]
  M -- Hàng loạt --> B[Dán danh sách] --> PV[Preview: sẵn sàng / dòng lỗi]
  PV --> BT[Thêm N người - bỏ dòng lỗi]
  SV --> INV
  BT --> INV[… → Gửi link cài app]
  INV --> Q[QR + link ?ma=MÃ + tin nhắn mẫu kèm PIN]
  Q --> CP{Chép}
  CP -- Cả N người --> Z[Dán nhóm Zalo]
  CP -- Từng người --> Z1[Gửi riêng]
  Z --> NV([NV mở link → đăng nhập])
```

## UF-09 · Nhân viên nghỉ việc / đổi máy / quên PIN

```mermaid
flowchart TD
  S([Hồ sơ NV]) --> C{Tình huống}
  C -- Nghỉ việc --> DEL{Xoá hay Đã nghỉ?}
  DEL -- Xoá nhân viên --> CF[Modal: N lần chấm, M đơn sẽ không còn hiện ở Bảng công & Lương]
  CF -- Chuyển sang Đã nghỉ ✅ --> ST[Trạng thái Đã nghỉ: không đăng nhập được, giữ lịch sử]
  CF -- Xoá ❌ không hoàn tác - I --> RM[Ẩn khỏi mọi kỳ, dữ liệu còn trong Sheet]
  CF -- Huỷ --> S
  DEL -- Đặt Đã nghỉ --> ST
  C -- Đổi điện thoại --> UL[Mở khoá máy → NV đăng nhập lại máy mới - I]
  C -- Quên PIN --> PIN[Tạo mã mới → Lưu hồ sơ → gửi NV - I]
```

## UF-10 · Cấu hình địa điểm (geofence)

```mermaid
flowchart TD
  S([Địa điểm → Thêm/Sửa]) --> W{Cách đặt vị trí}
  W -- Lấy vị trí hiện tại --> G{Quyền GPS?}
  G -- ❌ --> GE[Báo lỗi quyền - I]
  G -- ✅ --> AV[Đo 5 lần lấy trung bình]
  W -- Link Google Maps / địa chỉ --> SR[Tìm] --> SRR{Tìm thấy?}
  SRR -- ❌ --> SE[Báo không tìm thấy - UNKNOWN]
  SRR -- ✅ --> PIN
  W -- Bấm bản đồ --> PIN
  AV --> PIN[Ghim + toạ độ tự điền]
  PIN --> R[Chỉnh bán kính 30–500 m]
  R --> PS[Chọn vị trí được chấm tại đây]
  PS --> SV[Lưu ✅]
  SV --> SUG[30 ngày sau: Gợi ý từ lần chấm thật nếu ≥5 lần lệch/sát mép]
```

## UF-11 · Đổi cài đặt công ty

```mermaid
flowchart TD
  S([Cài đặt]) --> CH[Thay đổi trường / màu]
  CH --> PV[Xem trước ngay - màu]
  PV --> BAR[Thanh: N thay đổi chưa lưu · Huỷ · Lưu cài đặt]
  BAR -- Lưu ✅ --> AP[Áp cho admin + app NV]
  BAR -- Huỷ --> RV[Hoàn nguyên]
  BAR -- Rời trang ⚠️ --> LOST[Thay đổi mất, không cảnh báo - CONFIRMED]
```
