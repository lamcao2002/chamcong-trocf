# Đặc tả bộ tính ngày công — MVP

Oct 31, 2026 · @Lam Cao

Bộ tính ngày công biến **ca + lịch + lần chấm + đơn từ** thành một bản ghi ngày công cho mỗi nhân viên × ngày × ca; tài liệu này chốt 6 bước tính, bảng quyết định và 50 ca kiểm thử để code Sprint 2 theo đúng kết quả mong đợi.

Quy ước nguồn: **\[Gốc\]** = quan sát được trên bản tham khảo E-HRM Pro (giao diện, dữ liệu API, hướng dẫn chính thức); **\[Đề xuất\]** = quy tắc ta tự chốt cho MVP vì bản gốc không cho thấy. Theo kế hoạch đã duyệt, dữ liệu lưu trên PostgreSQL; mọi mốc giờ lưu theo giờ Việt Nam (UTC+7). Các quy tắc \[Đề xuất\] đã được chốt ở mục [Quyết định đã chốt](#quyết-định-đã-chốt).

## Đầu vào và đầu ra

Engine là một hàm thuần: cùng đầu vào luôn ra cùng ngày công, không đọc đồng hồ ngoài tham số `now`.

| Đầu vào | Trường dùng | Nguồn |
| --- | --- | --- |
| Ca (thư viện) | start, end, breakStart, breakEnd, overnight, calc, std (giờ), min1, min05 (phút), grace, minOT, part (ca ghép), khongBatLoi | \[Gốc\] |
| Vị trí / nhân viên | kiểu ca (cố định / linh hoạt), ca cố định, ca được chọn, ngày làm việc, địa điểm, ngày vào làm, trạng thái | \[Gốc\] |
| Lịch | ô (ngày, nhân viên, danh sách mã ca hoặc OFF) | \[Gốc\] |
| Lần chấm | thời điểm, loại vào/ra, ca NV chọn, toạ độ, trong/ngoài vùng, ảnh, ghi chú | \[Gốc\] |
| Đơn đã duyệt | nghỉ phép, muộn/sớm, làm thêm, đổi ca, quên chấm | \[Gốc\] |
| Duyệt của quản lý | công ghi đè, phút OT, tha muộn/sớm, duyệt vị trí, xác nhận ca | \[Gốc\] |
| Cài đặt công ty | ngày làm việc, chế độ tính muộn, OT khi đến sớm, OT tối thiểu, tự duyệt OT theo đơn | \[Gốc\] |
| Ngày lễ | ngày, tên | \[Gốc\] |
| now | thời điểm tính | \[Đề xuất\] |

**Đầu ra** — một `DayRecord` cho mỗi (nhân viên, ngày, ca), gồm: trạng thái; giờ vào/ra hiệu lực; phút làm trong ca; công; công kỳ vọng; phút muộn, về sớm; OT (đề xuất, đã duyệt, trạng thái); số lần thiếu chấm; cờ; ghi chú giải thích; cần duyệt hay không; đề xuất duyệt. Cấu trúc khớp bản gốc \[Gốc\], xem `07-data-model.md`.

## Quy trình tính

&#91;embedded content: quy trình tính ngày công · 6 bước + vòng duyệt\]

Các bước A–E ra số liệu thô, bước F gắn cờ; quyết định của quản lý không sửa lần chấm gốc mà được áp sau cùng rồi tính lại ngày công ngay.

## Bước A — Xác định ca kỳ vọng của mỗi ngày

Mỗi ngày, engine lập danh sách ca mà nhân viên phải làm, xét theo thứ tự ưu tiên dưới đây; quy tắc đầu tiên khớp sẽ quyết định.

| # | Điều kiện | Ca kỳ vọng | Ghi chú | Nguồn |
| --- | --- | --- | --- | --- |
| 1 | Ngày trước ngày vào làm, hoặc sau `left_date` của nhân viên Đã nghỉ | Không có | Không tính vắng; các ngày đến hết `left_date` vẫn tính bình thường để giữ công cũ (US13) | \[Gốc\], \[Đề xuất\] mốc ngày |
| 2 | Ô lịch = OFF (Cho nghỉ) | Không có | 0 công, không vắng, không trừ phép | \[Gốc\] |
| 3 | Ô lịch có mã ca | Đúng các ca trong ô | Một ngày có thể nhiều ca | \[Gốc\] |
| 4 | Nhân viên ca cố định, ngày thuộc ngày làm việc của vị trí | Ca cố định | Hiển thị ô viền đứt | \[Gốc\] |
| 5 | Nhân viên linh hoạt, không có ô lịch | Không có | Ngày không xếp là ngày nghỉ | \[Gốc\] |
| 6 | Ngày không thuộc ngày làm việc | Không có, `offDay = true` | Đi làm sẽ thành OT | \[Gốc\] |

Sau khi có danh sách ca, áp thêm ba lớp:

- **Ngày lễ** \[Gốc\]: người ca cố định được đủ công dù không đi làm; đi làm thì OT theo hệ số lễ. Người linh hoạt có ca trong ngày lễ: \[Đề xuất\] tính như ngày thường, OT theo hệ số lễ, không thêm công lễ.
- **Đơn nghỉ phép đã duyệt** phủ ngày: \[Gốc\] phép năm = 1 công và trừ 1 ngày phép; ca ghép = 0,5 công. \[Đề xuất\] nghỉ ốm và không lương = 0 công, không báo vắng.
- **Đơn đổi ca đã duyệt** \[Đề xuất\]: bỏ ca nghỉ khỏi ngày xin nghỉ, thêm ca làm bù vào ngày làm bù.

## Bước B — Ghép lần chấm vào ca

Mỗi lần chấm được gán cho đúng một ca kỳ vọng; lần chấm không gán được ca nào thành "làm ngoài lịch" và vào Hộp việc.

1. **Cửa sổ ghép** \[Đề xuất\]: lần vào thuộc ca nếu nằm trong \[giờ vào − 120 phút, giờ ra\]; lần ra thuộc ca nếu nằm trong \[giờ vào, giờ ra + 6 giờ\] và trước giờ vào của ca kế tiếp trong ngày. Ngoại lệ với hai ca liền nhau: lần ra trong 15 phút sau mốc giao ca, khi ca trước chưa có lần ra, thuộc ca trước (T30, T51).
2. **Chấm trùng** \[Gốc\]: bấm VÀO CA hai lần không sai công — lấy lần vào sớm nhất và lần ra muộn nhất của ca; các lần còn lại chỉ lưu nhật ký.
3. **Ca liền nhau** \[Gốc\]: một cặp vào/ra phủ hai ca liền nhau (vd vào 07:13, ra 17:00 cho Ca sáng 07–12 và Ca chiều 12–17) được tách tại mốc giao ca: Ca sáng ra 12:00, Ca chiều vào 12:00 đúng giờ. Chỉ tách khi ca sau không có lần vào riêng (T29); ca sau có lần vào riêng thì mỗi ca xét lần chấm của mình (T30, T51) \[Đề xuất\].
4. **Ca đêm** \[Gốc\]: ca qua 0 giờ (vd 22:00 → 06:00) thuộc ngày bắt đầu ca; giờ ra ngày hôm sau vẫn ghép vào ca đó.
5. **Nhân viên chọn ca khi chấm** \[Gốc\]: ghi lại mã ca đã chọn. Nếu giờ thực tế khớp ca khác tốt hơn (trùng nhiều phút hơn), gắn cờ `sai_ca` và đề xuất "Xác nhận ca \<ca khớp>"; công tạm tính theo ca khớp. Ca đã chọn không có trong lịch mà giờ thực tế trùng ca đó nhiều hơn ca có lịch thì đây là ca ngoài lịch (mục 6), ca có lịch thành vắng \[Đề xuất\].
6. **Chấm khi không có ca** \[Đề xuất\]: nhân viên linh hoạt chọn một ca ngoài lịch ("Ca bạn chọn (ngoài lịch)") → tạo ca tạm, gắn cờ `ngoai_lich`, cần duyệt; người ca cố định chấm ngày Cho nghỉ → cùng cờ \[Gốc\].
7. **Ngoài vùng** \[Gốc\]: lần chấm vẫn ghép vào ca, gắn cờ `gps`; ngày công vẫn tính bình thường nhưng cần duyệt vị trí.

## Bước C — Tính giờ làm và công

Phút làm trong ca chỉ đếm phần nằm trong khung ca và trừ giờ nghỉ giữa ca; công suy ra từ số phút đó theo cách tính của ca.

```latex
\text{worked} = \left|[\max(\text{in},\,\text{start}),\ \min(\text{out},\,\text{end})]\right| - \left|\text{giao với giờ nghỉ}\right|
```

Ví dụ \[Gốc\]: Ca 1 06:00–14:00, nghỉ 10:00–10:30, vào 05:59 ra 14:05 → worked = 450 phút (7g30). Tạp vụ 06:00–08:00, vào 05:59 ra 08:07 → worked = 120.

| Cách tính ca | Công | Bắt muộn/sớm | Nguồn |
| --- | --- | --- | --- |
| Theo khung ca (BLOCK) | 1 nếu worked ≥ min1; 0,5 nếu min05 ≤ worked < min1; 0 nếu nhỏ hơn | Có | \[Gốc\] |
| Theo giờ thực tế | worked ÷ (std × 60), làm tròn 2 chữ số, tối đa 1 | Không | \[Gốc\] công thức; \[Đề xuất\] làm tròn và trần |
| Giờ thực tế + bắt lỗi | Như dòng trên | Có | \[Gốc\] |

- Thiếu lần vào hoặc lần ra → worked = 0, công = 0, `missing` = số lần thiếu, trạng thái `thieu_gio` \[Gốc\].
- **Công kỳ vọng** (dùng cho phép, lễ): ca thường = 1; ca ghép (`part`) = 0,5 \[Gốc\]. Quy tắc chỉ dựa vào cờ `is_part`, không dựa vào số giờ; ca Tạp vụ 2 giờ muốn có công kỳ vọng 0,5 thì phải bật cờ này \[Đề xuất\].
- **Ca ghép đi làm khác nghỉ phép:** đi làm đủ được 1 công (T24, T29, T30), nghỉ phép năm được 0,5 công (T37), và hai ca ghép trong ngày ra 2 công. Tạm giữ đúng đặc tả, phải xác nhận bằng bảng lương thật của quán trước Sprint 4.
- **Lương theo giờ** dùng worked, không dùng công: Ánh tháng 9 làm 79,35 giờ × 25.000đ = 1.983.750đ \[Gốc\].

## Bước D — Muộn và về sớm

Muộn chỉ được ghi khi vượt thời gian cho phép của ca; số phút ghi phụ thuộc chế độ công ty chọn.

| Chế độ (Cài đặt) | Cho phép 5', vào muộn 14' | Cho phép 5', vào muộn 4' | Nguồn |
| --- | --- | --- | --- |
| Tính cả số phút muộn (`toan_bo`) | 14 phút | 0 | \[Gốc\] |
| Chỉ tính phần vượt | 9 phút | 0 | \[Gốc\] |

- Muộn = vào − giờ vào ca; về sớm = giờ ra ca − ra. Về sớm dùng cùng mức cho phép và cùng chế độ \[Đề xuất\].
- Ca bật "Không bắt lỗi muộn / sớm" (vd Tạp vụ) và ca tính "Theo giờ thực tế": luôn 0 \[Gốc\].
- Hai ca liền nhau được tách tại mốc giao ca thì mốc giao không tính muộn/sớm \[Gốc\].
- Muộn/sớm **không làm mất công** nếu worked vẫn đủ min1 (vd vào 14:07 ca 14–22 → worked 443 ≥ 420 → 1 công, muộn 7') \[Gốc\].
- Tiền phạt = phút × mức phạt đ/phút của vị trí, chỉ khi vị trí bật "Trừ tiền phạt và BHXH" và chưa được tha \[Gốc\]. Phạt nằm ngoài MVP: engine nhận `penaltyPerMin` và trả tiền phạt để chạy T49, nhưng không lưu, không có giao diện, và service luôn truyền 0. Đơn muộn/sớm đã duyệt hoặc quản lý "tha" → đánh dấu `waived`, phút vẫn hiển thị nhưng không phạt \[Gốc\].

## Bước E — OT

OT luôn chỉ là **đề xuất chờ duyệt**; tiền OT chỉ tính trên số phút quản lý đã duyệt \[Gốc\].

| Loại OT | Đề xuất khi | Số phút đề xuất | Hệ số mặc định | Nguồn |
| --- | --- | --- | --- | --- |
| Sau ca | ra − giờ ra ca ≥ OT tối thiểu (30') | Toàn bộ phần sau ca (vd ra 23:38 ca hết 22:00 → 98') | 150% | \[Gốc\] |
| Trước ca | Cài đặt bật "Tính OT khi đến sớm" và giờ vào ca − vào ≥ OT tối thiểu | Toàn bộ phần trước ca | 150% | \[Gốc\] |
| Ngày nghỉ tuần (`offDay`) | Đi làm ngày không thuộc ngày làm việc | Toàn bộ phút làm | 200% (Thứ Bảy nghỉ: 150% nếu để trống) | \[Gốc\] hệ số; \[Đề xuất\] cách đếm |
| Ngày lễ | Đi làm ngày lễ | Toàn bộ phút làm | 300% | \[Gốc\] hệ số; \[Đề xuất\] cách đếm |

- Ở lại ít hơn OT tối thiểu → không đề xuất, không ghi gì (vd ra 08:07 ca hết 08:00) \[Gốc\].
- OT tối thiểu lấy theo ca; ca để trống thì lấy của công ty \[Gốc\].
- **Theo đơn**: khi bật "Tự xác nhận OT theo đơn đã duyệt", phần phút nằm trong khung giờ của đơn Làm thêm đã duyệt được duyệt sẵn; phần vượt đơn vẫn chờ duyệt \[Gốc\] ý; \[Đề xuất\] cách tách phần vượt.
- Trạng thái OT: `none` → `cho_duyet` → đã duyệt (phút do quản lý chọn, có thể khác đề xuất) hoặc "Không tính OT" (0 phút) \[Gốc\].
- Tiền OT (cho bước lương): đơn giá giờ × phút/60 × hệ số. Lương tháng: đơn giá giờ = mức ÷ công chuẩn ÷ giờ chuẩn của ca (10.000.000 ÷ 26 ÷ 7,5 = 51.282đ) \[Gốc\].

## Bước F — Trạng thái, cờ và đề xuất cho Hộp việc

Một ngày công có thể mang nhiều cờ nhưng chỉ một trạng thái hiển thị, chọn theo thứ tự ưu tiên trong bảng (dòng trên thắng) \[Đề xuất\]; mỗi cờ cần duyệt sinh một việc trong Hộp việc kèm đề xuất \[Gốc\].

| Ưu tiên | Trạng thái | Khi nào | Cần duyệt | Đề xuất trong Hộp việc | Nguồn |
| --- | --- | --- | --- | --- | --- |
| 1 | `chua_toi` | now < giờ ra ca, chưa chấm | Không | — | \[Gốc\]; \[Đề xuất\] giữ tới hết ca vì `vang` chỉ có sau khi hết ca |
| 2 | `dang_lam` | Đã vào, chưa ra, now < giờ ra ca + 6 giờ | Không | — | \[Gốc\] |
| 3 | `vang` | Có ca, hết ca, không có lần chấm nào, không có đơn | Có | Không có đề xuất; chỉ "Điều chỉnh khác…" | \[Gốc\] |
| 4 | `thieu_gio` | Chỉ có vào hoặc chỉ có ra (cờ `thieu_vao`/`thieu_ra`) | Có | Có giải trình → "Duyệt 1 công" (giờ thiếu lấy từ giải trình hoặc đơn quên chấm) | \[Gốc\] |
| 5 | `sai_ca` | Ca đã chọn khác ca khớp giờ | Có | "Xác nhận ca \<ca khớp>" | \[Gốc\] |
| 6 | `ngoai_vung` | Có lần chấm ngoài vùng (cờ `gps`) | Có | "Duyệt vị trí" | \[Gốc\] |
| 7 | `ngoai_lich` | Chấm khi không có ca kỳ vọng | Có | "Duyệt ca \<ca đã chọn>" | \[Đề xuất\] |
| 8 | `ot_cho` | Có OT đề xuất chưa duyệt (cờ `ot_cho`) | Có | "Duyệt N phút"; phương án khác "Không tính OT" | \[Gốc\] |
| 9 | `muon` | Muộn hoặc về sớm > 0, chưa tha | Không | Hiển thị ô M; quản lý có thể tha | \[Gốc\] ô; \[Đề xuất\] không bắt duyệt |
| 10 | `nua_cong` | Công = 0,5 | Không | — | \[Gốc\] ô |
| 11 | `du` | Còn lại, công ≥ 1 | Không | — | \[Gốc\] |

Trạng thái ngày đặc biệt hiển thị thay các dòng trên: `nghi_phep` (P), `le` (L), `nghi` (OFF / không ca) \[Gốc\]. Ba trạng thái này chỉ dùng khi ngày không có lần chấm; có chấm thì chọn theo bảng trên, vd đi làm ngày lễ là `ot_cho` (T34) \[Đề xuất\]. Đi làm ngày nghỉ tuần tạo dòng có `shift_id` trống, trạng thái `ot_cho` (T35) \[Đề xuất\]. Ca 0 công vì về quá sớm không vào Hộp việc (T07) \[Đề xuất\].

Mỗi việc mang `evidence` là các dòng bằng chứng ("Vào 13:59", "Ra 23:38", lời giải trình) và một câu "Vì sao hệ thống đề xuất" sinh từ chính số liệu, vd "Ra ca lúc 23:36, sau giờ hết ca (22:00) 1 giờ 36 — vượt mức tối thiểu tính OT" \[Gốc\].

## Ảnh hưởng của duyệt và đơn lên ngày công

Duyệt không sửa lần chấm gốc; nó lưu một bản ghi duyệt riêng, và engine áp bản ghi đó **sau** khi tính xong để ra con số cuối \[Đề xuất, khớp hành vi gốc\].

| Hành động | Tác động | Nguồn |
| --- | --- | --- |
| Duyệt theo đề xuất | Xoá cờ cần duyệt của việc đó; áp đề xuất (phút OT, công, vị trí, ca) | \[Gốc\] |
| Điều chỉnh khác — Số công | "Theo hệ thống" giữ công tính được; 1 / 0,5 / 0 ghi đè | \[Gốc\] |
| Điều chỉnh khác — Phút OT | Ghi đè phút OT đã duyệt; để trống = không đổi | \[Gốc\] |
| Duyệt thiếu giờ | Coi ngày đủ công dù thiếu chấm; không phạt quên chấm | \[Gốc\] |
| Không tính OT | OT đã duyệt = 0, cờ OT đóng | \[Gốc\] |
| Tha muộn / sớm | `waived` = true, không phạt | \[Gốc\] |
| Đơn Quên chấm đã duyệt | Thêm lần chấm tổng hợp (`synthetic`) với giờ trong đơn rồi tính lại | \[Gốc\] |
| Đơn Muộn/sớm đã duyệt | Tha số phút trong đơn cho ca đó | \[Gốc\] |
| Đơn Nghỉ phép đã duyệt | Ngày thành `nghi_phep`; phép năm = công kỳ vọng và trừ phép | \[Gốc\] |
| Hoàn duyệt | Xoá bản ghi duyệt, ngày trở về kết quả hệ thống | \[Gốc\] |

- Mọi duyệt và đơn đều ghi người làm và thời điểm để truy vết \[Đề xuất\].
- Sau mỗi thay đổi, tính lại **ngay** ngày công liên quan và cập nhật Hộp việc, Bảng công, Lương trong cùng giao dịch — tránh lỗi bản gốc: OT đã duyệt ở Hộp việc nhưng Lương vẫn báo "chờ" \[Đề xuất\].
- Kỳ lương đã công bố là bản chụp đóng băng; thay đổi sau đó chỉ hiện ở phiếu khi công bố lại \[Gốc\].

## Bộ ca kiểm thử

T01–T50 và các ca bổ sung T51–T53 là đặc tả chạy được: mỗi dòng thành một unit test, và engine chỉ được coi là xong khi tất cả đều đúng. Trừ khi ghi `now`, các ca chạy với `now` sau cửa sổ 6 giờ của ca cuối.

**Cấu hình ca dùng trong test** (cho phép muộn 5', OT tối thiểu 30', chế độ muộn "Tính cả số phút" trừ khi ghi khác):

- **CA1** 06:00–14:00, nghỉ 10:00–10:30, khung ca, min1 420, min05 210 · **CA2** 14:00–22:00, nghỉ 18:00–18:30, như CA1
- **SANG** 07:00–12:00 · **CHIEU** 12:00–17:00 · **TOI** 17:00–22:00 — ca ghép, khung ca, min1 270, min05 150, không nghỉ
- **TV2** 06:00–08:00, không bắt lỗi, min1 90, min05 45, cho phép 0'
- **DEM** 22:00–06:00 qua đêm, khung ca, min1 420, min05 210, không nghỉ \[Đề xuất\]
- **LH** 08:00–18:00, giờ thực tế, giờ chuẩn 8, không nghỉ \[Đề xuất\]

| ID | Nhóm | Ca | Dữ liệu vào | Kết quả mong đợi | Nguồn |
| --- | --- | --- | --- | --- | --- |
| T01 | Cơ bản | CA1 | Vào 05:59, ra 14:05 | `du`, worked 450, 1 công, muộn 0, OT 0 | Gốc |
| T02 | Cơ bản | CA1 | Vào 06:04, ra 14:00 | `du`, muộn 0 (trong 5'), worked 446, 1 công | Đề xuất |
| T03 | Muộn | CA1 | Vào 06:14, ra 14:00 | Muộn 14, worked 436, 1 công, ô M | Gốc |
| T04 | Muộn | CA1, chế độ "phần vượt" | Vào 06:14, ra 14:00 | Muộn 9, 1 công | Gốc |
| T05 | Về sớm | CA1 | Vào 06:00, ra 13:50 | Về sớm 10, worked 440, 1 công | Đề xuất |
| T06 | Nửa công | CA1 | Vào 07:00, ra 14:00 | Muộn 60, worked 390, 0,5 công | Đề xuất |
| T07 | Không công | CA1 | Vào 06:00, ra 09:00 | Về sớm 300, worked 180, 0 công, không cần duyệt | Đề xuất |
| T08 | Đến sớm | CA1, OT trước ca tắt | Vào 05:30, ra 14:00 | worked 450, OT 0 | Gốc |
| T09 | OT trước ca | CA1, OT trước ca bật | Vào 05:20, ra 14:00 | `ot_cho`, OT trước ca 40 | Gốc |
| T10 | OT sau ca | CA2 | Vào 13:59, ra 23:38 | `ot_cho`, OT 98, worked 450, 1 công, đề xuất "Duyệt 98 phút" | Gốc |
| T11 | Dưới OT tối thiểu | TV2 | Vào 05:59, ra 08:07 | `du`, worked 120, OT 0 | Gốc |
| T12 | Dưới OT tối thiểu | CA2 | Vào 14:00, ra 22:29 | OT 0 | Gốc |
| T13 | Đúng ngưỡng OT | CA2 | Vào 14:00, ra 22:30 | `ot_cho`, OT 30 | Gốc |
| T14 | Duyệt OT khác đề xuất | CA2 | T10 + quản lý duyệt 90' | OT đã duyệt 90, hết cần duyệt | Gốc |
| T15 | OT theo đơn | CA2, tự duyệt theo đơn bật | Đơn làm thêm 22:00–23:00 đã duyệt; ra 23:38 | 60' tự duyệt, 38' `ot_cho` | Đề xuất |
| T16 | Không tính OT | CA2 | T10 + "Không tính OT" | OT đã duyệt 0, hết cần duyệt | Gốc |
| T17 | Thiếu ra | SANG | Vào 06:59, không ra | `thieu_gio` (`thieu_ra`), 0 công, missing 1 | Gốc |
| T18 | Thiếu vào | CA1 | Chỉ ra 14:02 | `thieu_gio` (`thieu_vao`), 0 công, missing 1 | Đề xuất |
| T19 | Vắng | CA1 | Không chấm, không đơn | `vang`, 0 công, không có đề xuất | Gốc |
| T20 | Thiếu + giải trình | SANG | T17 + giải trình "ra 12:05 quên bấm" | Đề xuất "Duyệt 1 công" | Gốc |
| T21 | Đơn quên chấm | SANG | T17 + đơn quên chấm ra 12:05 đã duyệt | Lần ra tổng hợp 12:05, worked 300, `du`, 1 công, OT 0 | Gốc |
| T22 | Chưa tới | CA1 | now 05:50, chưa chấm | `chua_toi` | Gốc |
| T23 | Đang làm | CA1 | Vào 05:59, now 09:00 | `dang_lam`, công tạm 0 | Gốc |
| T24 | Ngoài vùng | TOI | Vào 16:59 ngoài vùng, ra 22:05 hợp lệ | `ngoai_vung`, 1 công, đề xuất "Duyệt vị trí" | Gốc |
| T25 | Sai ca | Lịch SANG | Chọn CHIEU; vào 06:59, ra 12:04 | `sai_ca`, 1 công theo SANG, đề xuất "Xác nhận ca Ca sáng" | Gốc |
| T26 | Ngoài lịch | Linh hoạt, không lịch | Chọn SANG; vào 06:58, ra 12:01 | `ngoai_lich`, công tạm 1, cần duyệt | Đề xuất |
| T27 | Làm ngày Cho nghỉ | Cố định CA1, ô OFF | Vào 06:00, ra 14:00 | `ngoai_lich`, 0 công tới khi duyệt | Gốc ý, Đề xuất công |
| T28 | Chấm trùng | CA1 | Vào 05:58 và 06:02, ra 14:00 | Lấy 05:58, `du`, 1 công | Gốc |
| T29 | Ca liền nhau | SANG + CHIEU | Vào 07:13, ra 17:00 | SANG: muộn 13, ra 12:00, worked 287, 1 công · CHIEU: vào 12:00 đúng giờ, worked 300, 1 công | Gốc |
| T30 | Hai cặp chấm | SANG + CHIEU | 06:58–12:02 và 12:01–17:03 | Cả hai `du`, mỗi ca 1 công | Đề xuất |
| T31 | Ca đêm | DEM ngày 10/10 | Vào 21:55 ngày 10/10, ra 06:03 ngày 11/10 | Ghép vào ngày 10/10, worked 480, 1 công | Gốc ý, Đề xuất số |
| T32 | Ngoài cửa sổ ghép | CA1 | Vào 03:50, ra 14:00 | Lần 03:50 thành `ngoai_lich`; CA1 `thieu_gio` (thiếu vào) | Đề xuất |
| T33 | Lễ, không đi làm | Cố định CA1 | Ngày lễ, không chấm | `le`, 1 công | Gốc |
| T34 | Lễ, đi làm | Cố định CA1 | Ngày lễ; vào 06:00, ra 14:00 | `ot_cho`, 1 công + OT đề xuất 450' hệ số 300% | Gốc hệ số, Đề xuất cách đếm |
| T35 | Ngày nghỉ tuần | Cố định, ngày không làm việc | Vào 08:00, ra 12:00 | `ot_cho`, `offDay`, `shift_id` trống, 0 công, OT đề xuất 240' hệ số 200% | Đề xuất |
| T36 | Phép năm | CA1 | Đơn phép năm đã duyệt | `nghi_phep`, 1 công, phép còn lại −1 | Gốc |
| T37 | Phép, ca ghép | SANG | Đơn phép năm đã duyệt | `nghi_phep`, 0,5 công | Gốc |
| T38 | Nghỉ ốm | CA1 | Đơn nghỉ ốm đã duyệt | `nghi_phep`, 0 công, không vắng, không trừ phép | Đề xuất |
| T39 | Cho nghỉ | Cố định CA1, ô OFF | Không chấm | `nghi`, 0 công, không vắng | Gốc |
| T40 | Trước ngày vào làm | Cố định CA1 | Ngày < ngày vào làm, không chấm | Không có ca, không vắng | Gốc |
| T41 | Linh hoạt không lịch | Linh hoạt | Không lịch, không chấm | Không có ca, không vắng | Gốc |
| T42 | Giờ thực tế | LH | Vào 08:30, ra 17:00 | worked 510, 1 công (trần 1), muộn 0 | Gốc quy tắc, Đề xuất trần |
| T43 | Giờ thực tế | LH | Vào 09:00, ra 13:00 | worked 240, 0,5 công, muộn 0 | Gốc |
| T44 | Giờ thực tế + bắt lỗi | LH bắt lỗi | Vào 08:20, ra 18:00 | Muộn 20, 1 công | Gốc |
| T45 | Không bắt lỗi | TV2 | Vào 06:20, ra 08:00 | Muộn 0, worked 100, 1 công | Gốc |
| T46 | Nửa công ca ghép | SANG | Vào 07:00, ra 09:40 | Về sớm 140, worked 160, 0,5 công | Đề xuất |
| T47 | Tha muộn | CA1 | T03 + quản lý tha | Muộn 14 hiển thị, `waived`, phạt 0 | Gốc |
| T48 | Duyệt vắng thành 1 công | CA1 | T19 + Điều chỉnh: 1 công | 1 công, hết cần duyệt | Gốc |
| T49 | Phạt muộn | CA1, phạt 1.000đ/phút bật | T03 | Phạt 14.000đ | Gốc |
| T50 | Hoàn duyệt | CA1 | T48 rồi hoàn duyệt | Trở lại `vang`, 0 công, cần duyệt | Gốc |
| T51 | Ra quá ngoại lệ giao ca | SANG + CHIEU | 06:58–12:16 và 12:01–17:03 | Lần ra 12:16 không thuộc SANG: SANG `thieu_gio` (thiếu ra), CHIEU `du` | Đề xuất |
| T52 | Sau ngày nghỉ việc | Cố định CA1, `left_date` 10/10 | Ngày 11/10, không chấm | Không có ca, không vắng | Đề xuất |
| T53 | Đến hết ngày nghỉ việc | Cố định CA1, `left_date` 10/10, đã chuyển Đã nghỉ | Ngày 10/10; vào 06:00, ra 14:00 | `du`, 1 công, công cũ không mất | Đề xuất |

## Quyết định đã chốt

Các câu hỏi mở dưới đây được chốt ngày 01/11/2026 theo đề xuất của [Sprint 2](05-sprint-2.md); riêng B2 cần xác nhận lại bằng bảng lương thật của quán.

| # | Câu hỏi | Quyết định |
| --- | --- | --- |
| A1 | Cửa sổ ghép lần chấm | Vào sớm tối đa 120 phút, ra muộn tối đa 6 giờ |
| A2 | Ca nào có công kỳ vọng 0,5 | Chỉ ca bật `is_part` |
| A3 | Công theo giờ thực tế | Làm tròn 2 chữ số, trần 1 công |
| A4 | Nghỉ ốm, không lương | 0 công, không trừ phép |
| A5 | Người linh hoạt làm ngày lễ | Chỉ OT hệ số 300%, không thêm công lễ |
| A6 | OT ngày nghỉ tuần, ngày lễ | Tính trên toàn bộ phút làm |
| A7 | Muộn/sớm có bắt duyệt không | Không, chỉ hiện ô M |
| A8 | Ca 0 công vì về quá sớm | Không vào Hộp việc |
| A9 | Phần vượt khung đơn làm thêm | Để chờ duyệt |
| B1 | Lần ra sát mốc giao ca (T30) | Ngoại lệ 15 phút ở Bước B mục 1 |
| B2 | Ca ghép đi làm 1 công, nghỉ phép 0,5 công | Giữ đúng đặc tả, xác nhận trước Sprint 4 |
| B3 | Tiền phạt (T49) | Engine tính, không lưu, service truyền 0 |
| B4 | Đi làm ngày lễ | Trạng thái đặc biệt chỉ dùng khi không có lần chấm |
| B5 | Đi làm ngày nghỉ tuần | `shift_id` trống, trạng thái `ot_cho` |
| B6 | Nhân viên Đã nghỉ | Thêm `left_date`, chỉ bỏ ca sau ngày đó |
| B7 | GPS bị chặn | Không cho chấm, hiện hướng dẫn bật quyền |
| B8 | Tính trong vùng | Khoảng cách ≤ bán kính, không cộng sai số; lưu `accuracy_m` |
