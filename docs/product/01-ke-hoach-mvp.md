# Kế hoạch xây dựng MVP — App chấm công

Oct 31, 2026 · @Lam Cao

Bộ tài liệu `docs/website-analysis/` mô tả lại sản phẩm gốc E-HRM Pro; để ra MVP cần biến nó thành **đặc tả xây dựng** qua 5 bước dưới đây, rồi mới code trong khoảng 8–10 tuần.

## Bước 1 — Chốt 4 quyết định (1 buổi)

Bốn quyết định này ảnh hưởng mọi bước phía sau, nên chốt trước.

| Quyết định | Đề xuất | Lý do |
| --- | --- | --- |
| Lưu dữ liệu | CSDL thật (PostgreSQL), không dùng Google Sheet làm nơi lưu chính | Sheet chậm, khó giữ nhất quán; lỗi "OT đã duyệt mà Lương vẫn báo chờ" ở bản gốc có thể do cách lưu này. Có thể thêm xuất sang Sheet sau |
| Công nghệ | Next.js (React) + Ant Design cho trang quản trị; app nhân viên là PWA cùng repo; backend Node + Postgres (vd Supabase) | Bám sát giao diện đã phân tích, một người cũng làm được |
| Phạm vi MVP | Chỉ phần Must Have trong `10-development-roadmap.md` | Đủ để 1 quán chấm công và trả lương 1 tháng |
| Khách thử đầu tiên | 1 quán cà phê thật, 5–10 nhân viên | Có dữ liệu thật để kiểm tra lương |

## Bước 2 — Đặc tả bộ tính ngày công + test case (quan trọng nhất)

Bộ tính ngày công là trái tim sản phẩm: làm sai phần này thì lương sai, nên phải xong trước khi code.

- Phạm vi: ghép lần chấm vào ca, ca đêm, ca ghép, tính muộn, nửa công, vắng, OT, ngày lễ, nghỉ phép.
- Đầu ra: một **bảng quyết định** kèm khoảng 40–60 ca kiểm thử có kết quả mong đợi.
- Ví dụ một ca kiểm thử: cho phép muộn 5 phút, vào muộn 14 phút → tính muộn 14 phút.

## Bước 3 — PRD MVP thu gọn + backlog

Cắt từ bộ tài liệu phân tích thành bốn phần dùng được ngay để code:

- Danh sách màn hình MVP: khoảng 10 màn quản trị, 4 màn nhân viên.
- User story có tiêu chí nghiệm thu.
- Thiết kế CSDL cụ thể: bảng, cột, khoá.
- Danh sách API.

## Bước 4 — Giao diện mẫu

Dựng design tokens (màu, chữ, bo góc) và 3–4 màn chính để duyệt hướng giao diện trước khi code hàng loạt: Hộp việc, Bảng công, Xếp ca, màn Chấm công.

## Bước 5 — Code theo 4 sprint (khoảng 8–10 tuần)

1. **Sprint 1:** nền tảng, đăng nhập, phân quyền, cấu hình ca / vị trí / địa điểm, nhân sự.
2. **Sprint 2:** xếp ca, app nhân viên chấm công (GPS), bộ tính ngày công + test.
3. **Sprint 3:** Hộp việc, Bảng công, đơn từ, giải trình.
4. **Sprint 4:** tính lương, công bố phiếu, phiếu lương trong app nhân viên, chạy thử với quán thật.

## Việc tiếp theo

Claude có thể làm ngay hai việc sau:

- [ ] Viết Bước 2 và Bước 3 thành tài liệu, lưu tiếp vào Project "app trocf".
- [ ] Khởi tạo code MVP qua repo GitHub (kết nối được) hoặc dùng Claude Code trên máy.

Câu hỏi cần chốt: giữ 4 đề xuất ở Bước 1, hay đổi điểm nào — chẳng hạn bắt buộc dữ liệu nằm trên Google Sheet như bản gốc?
