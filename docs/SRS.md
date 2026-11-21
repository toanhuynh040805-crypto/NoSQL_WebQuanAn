# SRS — Đặc tả yêu cầu phần mềm
**Đề tài:** Website quản lý đặt món tại quán ăn sử dụng MongoDB, Redis và Neo4j  
**Học phần:** Dữ liệu NoSQL · **Năm học:** 2026–2027  
**Phiên bản tài liệu:** 1.0 · **Ngày đối chiếu mã nguồn:** 21/11/2026  
**Tình trạng:** Mô tả phần đã triển khai và phần mở rộng còn thiếu, không thay thế biên bản nghiệm thu của giảng viên.

## 1. Mục đích, nguồn và phạm vi

Tài liệu này tiếp nối `Tai_lieu_phan_tich_thiet_ke_so_bo_Website_dat_mon_NoSQL.docx`, giữ nguyên đề tài và quy trình xem món → giỏ hàng → đặt món → quản lý đơn → gợi ý. Phạm vi đã phát triển thêm bàn/đặt bàn, phục vụ, bếp, thu ngân, kho và thanh toán mô phỏng nhận tiền thật theo cách xác nhận thủ công. Chọn **hướng 2** trong `HD_DoAn_NoSQL(1).docx`: ứng dụng sử dụng hoàn toàn NoSQL để lưu dữ liệu chính, không dựa vào SQL Server/KLCN.

### 1.1 Mục tiêu

- Xây dựng website đặt món cho khách dùng tại quán hoặc mang về, có đăng nhập, lịch sử và đánh giá.
- Cho phép nhân viên xem sơ đồ bàn, nhận bàn, gọi món theo nhiều lượt; bếp chế biến; thu ngân thu tiền và trả bàn.
- Minh họa ba mô hình NoSQL: MongoDB (document/nguồn dữ liệu nghiệp vụ), Redis (key-value có TTL, cache và khóa), Neo4j (graph/quan hệ và gợi ý).
- Có mã nguồn chạy được, dữ liệu mẫu, scripts minh chứng, test case và hồ sơ SRS/SDS/Database Model để báo cáo môn học.

### 1.2 Trong và ngoài phạm vi

**Đã có mã nguồn:** đăng nhập/đăng ký, thực đơn, giỏ, đơn hàng, đánh giá, gợi ý, đặt bàn, sơ đồ bàn, phiên phục vụ, bếp, thu ngân, tiền mặt, VietQR BIDV hướng dẫn chuyển khoản, kho, người dùng, khuyến mãi, báo cáo cơ bản.

**Chưa hoàn thiện:** hợp nhất đơn từ mã QR và nhân viên vào cùng phiên; tách/gộp bàn; chấm công GPS/ca làm; realtime push thay polling; đặt cọc/trừ cọc; thanh toán tự đối soát qua ngân hàng; xuất PDF/in hóa đơn; phân tích hiệu năng có số đo thực nghiệm. Những mục này là hướng mở rộng, không được mô tả là chức năng đã nghiệm thu.

## 2. Tác nhân và phân quyền

| Tác nhân | Vai trò trong mã nguồn | Phạm vi chính |
|---|---|---|
| Khách chưa đăng nhập | Không có token | Xem thực đơn, giỏ hàng tạm Redis |
| Khách hàng | `customer` | Đăng ký/đăng nhập, giỏ, đặt món/đặt bàn, theo dõi, đánh giá, ưu đãi |
| Nhân viên phục vụ | `staff` | Sơ đồ bàn, nhận bàn, giữ khóa 5 phút, gọi món, cập nhật đã phục vụ |
| Nhân viên bếp | `kitchen` | Xem đơn, chuyển sang chế biến/sẵn sàng |
| Thu ngân | `cashier` | Xem bàn và hóa đơn, xác nhận tiền mặt/chuyển khoản, đóng phiên |
| Quản lý | `admin` | Quản lý người dùng, món, danh mục, bàn, kho, khuyến mãi, thống kê, xem CSDL NoSQL |

Quyền phải được xác thực ở backend qua JWT và `requireRole`, không chỉ ẩn nút trên giao diện.

## 3. Danh sách yêu cầu chức năng

Ký hiệu: **Đã có** = đã tìm thấy route/model và có thể kiểm thử; **Một phần** = có luồng nhưng thiếu nghiệp vụ mở rộng; **Chưa có** = chưa được triển khai.

| Mã | Yêu cầu | Tác nhân | Hiện trạng |
|---|---|---|---|
| FR01 | Đăng ký, đăng nhập, đăng xuất và chặn token đã đăng xuất | Khách, nhân viên | Đã có |
| FR02 | Xem, tìm, lọc, sắp xếp thực đơn theo nhóm | Mọi người | Đã có |
| FR03 | Thêm/sửa/xóa giỏ tạm và giỏ tài khoản trên Redis | Khách | Đã có |
| FR04 | Gộp giỏ khách chưa đăng nhập khi đăng nhập | Khách | Đã có |
| FR05 | Đặt món dùng tại quán hoặc mang về | Khách | Đã có |
| FR06 | Xem tiến độ, lịch sử và hủy đơn khi hợp lệ | Khách | Đã có |
| FR07 | Đánh giá món thuộc đơn đã hoàn thành | Khách | Đã có |
| FR08 | Gợi ý món theo quan hệ Neo4j và dự phòng món phổ biến | Khách | Đã có |
| FR09 | Quản lý hồ sơ, đổi mật khẩu, món yêu thích, điểm | Khách | Đã có |
| FR10 | Đặt bàn, hủy đặt, quản lý xác nhận | Khách, phục vụ, quản lý | Đã có |
| FR11 | Kiểm tra trùng thời gian đặt và giữ bàn gần giờ nhận | Phục vụ, quản lý | Một phần |
| FR12 | Sơ đồ bàn theo khu/trạng thái | Phục vụ, thu ngân, quản lý | Đã có |
| FR13 | Nhận bàn thường/đã đặt, một phiên đang hoạt động mỗi bàn | Phục vụ | Đã có |
| FR14 | Khóa thao tác bàn 5 phút; gia hạn/trả khóa | Phục vụ | Đã có |
| FR15 | Gọi món theo lượt tại bàn, ghi chú, ưu tiên lượt | Phục vụ | Đã có |
| FR16 | Chỉnh số lượng/hủy dòng món trước khi bếp chế biến | Phục vụ | Đã có |
| FR17 | Chuyển phiên sang bàn trống đủ sức chứa | Phục vụ | Đã có (bàn thường) |
| FR18 | Xem danh sách và cập nhật tình trạng chế biến | Bếp | Đã có (polling 10 giây) |
| FR19 | Xác nhận đã phục vụ | Phục vụ | Đã có |
| FR20 | Tạm tính tiền tất cả đơn trong một phiên | Thu ngân | Đã có |
| FR21 | Xác nhận nhận tiền mặt, tính tiền thừa, lưu phiếu thu | Thu ngân | Đã có |
| FR22 | Hiển thị QR BIDV số tiền/nội dung hóa đơn; thu ngân đối chiếu | Thu ngân, khách | Đã có (thủ công) |
| FR23 | Chặn thu trùng, chặn gọi thêm sau thanh toán, trả bàn | Thu ngân | Đã có |
| FR24 | Quản lý danh mục/món và hình ảnh | Quản lý | Đã có |
| FR25 | Quản lý tài khoản và vai trò | Quản lý | Đã có |
| FR26 | Quản lý kho, tồn và cảnh báo | Quản lý | Đã có |
| FR27 | Quản lý mã khuyến mãi | Quản lý | Đã có |
| FR28 | Dashboard doanh thu và món bán chạy | Quản lý, thu ngân | Đã có cơ bản |
| FR29 | Kiểm tra số dữ liệu đang lưu ở MongoDB/Redis/Neo4j | Quản lý | Đã bổ sung |
| FR30 | QR tại bàn dùng chung phiên với nhân viên | Khách, phục vụ | Chưa có |
| FR31 | Tách/gộp bàn, ràng buộc thành viên | Phục vụ, quản lý | Chưa có |
| FR32 | Quản lý ca/khu phụ trách và chấm công GPS | Nhân viên, quản lý | Chưa có |
| FR33 | Đồng bộ WebSocket realtime ở tất cả bộ phận | Mọi người | Chưa có |
| FR34 | Đối soát tự động ngân hàng, hoàn tiền/cọc | Thu ngân | Chưa có |

## 4. Bốn nhóm dữ liệu được xử lý

Yêu cầu giảng viên ghi **ít nhất bốn loại dữ liệu khác nhau** (không đồng nghĩa bắt buộc bốn DBMS). Các nhóm có trong code:

1. **Tài liệu cấu trúc nghiệp vụ** — user, food, category, review trên MongoDB.
2. **Giao dịch và lịch sử theo thời gian** — order, statusHistory, TableSession.activity, PaymentReceipt trên MongoDB.
3. **Key-value biến động/TTL** — giỏ hàng, cache, token block, khóa bàn và sorted-set bảng xếp hạng trên Redis.
4. **Đồ thị quan hệ** — Customer/Food/Category; ORDERED/REVIEWED/BELONGS_TO trên Neo4j.

Đây là cách nhóm diễn giải “bốn loại dữ liệu” theo nội dung hệ thống; cần xác nhận với giảng viên nếu môn học yêu cầu thêm cơ sở dữ liệu dạng wide-column/time-series riêng.

## 5. Đặc tả ca sử dụng trọng tâm

### UC01 — Đăng nhập
- **Tác nhân:** Tất cả tài khoản; **tiền điều kiện:** tài khoản tồn tại và hoạt động.
- **Đầu vào:** Email, mật khẩu.
- **Luồng chính:** Nhập → kiểm tra định dạng → đối chiếu bcrypt → cấp JWT → điều hướng theo vai trò.
- **Ngoại lệ:** Sai thông tin hoặc tài khoản bị khóa: HTTP 401; thiếu token với API bảo vệ: HTTP 401.
- **Hậu điều kiện:** Có token hợp lệ; khi đăng xuất token bị thêm vào Redis blocklist TTL.

### UC02 — Khách đặt món
- **Tiền điều kiện:** Đăng nhập, có giỏ Redis, món còn phục vụ.
- **Luồng chính:** Chọn món → Redis lưu số lượng → gửi đơn → server đọc lại giá từ MongoDB → tạo `Order` chứa snapshot tên/giá/số lượng → cập nhật leaderboard Redis và quan hệ Neo4j → khách theo dõi trạng thái.
- **Ngoại lệ:** Giỏ trống, món đã ngừng, bàn không hợp lệ, mã giảm giá không hợp lệ.
- **Hậu điều kiện:** Có đơn MongoDB, giỏ được xóa nếu tạo đơn thành công; cập nhật đồ thị cho đơn khách hàng theo code.

### UC03 — Nhân viên nhận bàn và gọi món
- **Tác nhân:** `staff` hoặc `admin`; **tiền điều kiện:** bàn trống hoặc lịch đặt được xác nhận trong khung nhận bàn.
- **Luồng chính:** Chọn khu/bàn → số khách → nhận bàn → tạo `TableSession` → Redis khóa phiên 5 phút → chọn món và ghi chú → gửi từng lượt đơn gắn `tableSession`.
- **Ngoại lệ:** Bàn bận, số khách vượt sức chứa, đặt bàn chưa đến giờ, khóa thuộc nhân viên khác, gửi trùng `clientRequestId`.
- **Hậu điều kiện:** Bàn đang phục vụ, đơn xuất hiện trong màn bếp; lịch sử phiên có sự kiện nhận/gọi.

### UC04 — Bếp chế biến và phục vụ
- **Tác nhân:** `kitchen`, `staff`.
- **Luồng chính:** Bếp xem đơn đã xác nhận → `preparing` → `ready` → phục vụ xác nhận `completed`.
- **Ngoại lệ:** Không đủ quyền; đơn đã hoàn thành/hủy; chỉnh món sau khi đã chế biến phải bị chặn.
- **Hậu điều kiện:** Trạng thái có lịch sử; hóa đơn có thể được thu nếu toàn bộ lượt hợp lệ đã phục vụ.

### UC05 — Thu ngân thanh toán và trả bàn
- **Tác nhân:** `cashier` hoặc `admin`.
- **Luồng chính:** Chọn bàn → xem tổng tiền chưa thu → lựa chọn tiền mặt/chuyển khoản → xác nhận đã nhận tiền → server tạo `PaymentReceipt` duy nhất → cập nhật `Order.paymentStatus`, `TableSession.paymentState` → đóng phiên/trả bàn.
- **Ngoại lệ:** Món chưa phục vụ; khóa bàn còn thuộc nhân viên phục vụ; tổng tiền thay đổi; tiền mặt không đủ; chuyển khoản chưa đối chiếu; mã giao dịch trùng.
- **Hậu điều kiện:** Lưu phiếu thu, khóa chỉnh món, bàn trả trống/đặt tùy lịch.
- **Lưu ý:** QR **không** tự xác nhận đã nhận tiền; chỉ thu ngân kiểm tra sổ ngân hàng thủ công.

### UC06 — Gợi ý món
- **Tác nhân:** Khách; **tiền điều kiện:** menu có món.
- **Luồng chính:** Backend tìm quan hệ `ORDERED`/`REVIEWED` của khách và khách tương tự bằng Cypher → ánh xạ ID về các món MongoDB → khi thiếu dữ liệu dùng Redis leaderboard rồi MongoDB bán chạy.
- **Ngoại lệ:** Khách chưa đăng nhập hoặc ít dữ liệu: dùng gợi ý phổ biến.
- **Hậu điều kiện:** Trả danh sách món; không tạo đơn hàng.

### UC07 — Quản trị dữ liệu
- **Tác nhân:** `admin`; **tiền điều kiện:** token admin hợp lệ.
- **Luồng chính:** Mở Vận hành → quản lý danh mục/món/người dùng/kho; backend kiểm tra role, ghi MongoDB; vô hiệu cache liên quan.
- **Ngoại lệ:** ID không hợp lệ, trùng slug, danh mục chứa món, thao tác ngoài quyền.
- **Hậu điều kiện:** Dữ liệu nghiệp vụ được cập nhật; cache danh mục được làm mới khi cần.

### UC08 — Xem ba hệ NoSQL
- **Tác nhân:** `admin`; **tiền điều kiện:** ba dịch vụ được kết nối.
- **Luồng chính:** Chọn **Vận hành → CSDL NoSQL** → `GET /api/nosql/overview` → trả số document theo collection MongoDB, số key/TTL Redis, số node/quan hệ Neo4j.
- **Ngoại lệ:** Vai trò khác bị từ chối HTTP 403; mất kết nối DB báo lỗi API.
- **Hậu điều kiện:** Không thay đổi dữ liệu.

## 6. Quy tắc nghiệp vụ

- **BR01:** Server lấy giá món từ MongoDB, không tin số tiền do browser gửi.
- **BR02:** Một bàn chỉ có tối đa một `TableSession` active (unique partial index); khách web/QR chưa thống nhất phiên.
- **BR03:** Nhân viên cần giữ lock Redis 300 giây khi chỉnh/gọi món; hết TTL có thể nhận lại.
- **BR04:** Chỉ chỉnh/hủy món trong đơn nhân viên trước khi bếp chế biến.
- **BR05:** Đã thanh toán thì không được gọi/chỉnh thêm trong phiên.
- **BR06:** Phiếu thu một hóa đơn chỉ có một record; yêu cầu thanh toán lặp không được tạo phiếu thu thứ hai.
- **BR07:** Chuyển khoản chỉ được thu ngân xác nhận sau khi kiểm tra khoản nhận thực tế.
- **BR08:** Không chạy `npm run seed` trên cơ sở dữ liệu cần giữ; dùng `restore:menu` để bổ sung danh mục/món.
- **BR09:** Điểm thành viên và khuyến mãi phải được kiểm thử lại ở trường hợp trùng/hoàn tiền trước khi sử dụng thật.

## 7. Yêu cầu phi chức năng

| Mã | Tiêu chí | Cách kiểm chứng |
|---|---|---|
| NFR01 | API yêu cầu xác thực phải có JWT, phân quyền backend | Test HTTP 401/403 |
| NFR02 | Mật khẩu dùng bcrypt, không đưa mật khẩu/hash vào API | Xem `auth.js` và kiểm tra response |
| NFR03 | Không rò rỉ mật khẩu DB hay dữ liệu nhạy cảm trong bảng tổng quan | Kiểm tra API `/api/nosql/overview` |
| NFR04 | Ngăn tạo phiên bàn và thanh toán trùng trong yêu cầu lặp | Test cạnh tranh và chỉ số unique |
| NFR05 | Có dữ liệu khởi tạo để demo cục bộ | `npm run seed` chỉ với database demo |
| NFR06 | Container có volume bền vững | Kiểm tra `docker-compose.yml` |
| NFR07 | Màn hình bếp cập nhật gần thời gian thực | Polling 10 giây hiện tại; chưa phải WebSocket |
| NFR08 | Hiệu năng truy vấn có số đo và cache hit/miss | **Chưa có số đo**; cần đo tại máy trình bày |
| NFR09 | Giao diện responsive cơ bản | Kiểm tra thủ công desktop/mobile |
| NFR10 | Chỉ chấp nhận dữ liệu đúng schema | Zod/Mongoose, test đầu vào không hợp lệ |

## 8. Tiêu chí nghiệm thu và giới hạn

Đạt chuẩn **demo môn học** khi chạy cả ba DB, có thể xác minh document/keys/nodes từ nguồn thật, thực hiện luồng đặt món và thanh toán thử, chạy được script/test có bằng chứng, nộp đủ SRS/SDS/DB Model/test/report/nhật ký nhóm. Chưa khẳng định đáp ứng môi trường quán thật, thanh toán tự động, backup doanh nghiệp hay kiểm thử tải cao.

**Tài liệu đi kèm:** [SDS.md](SDS.md), [DATABASE_MODEL.md](DATABASE_MODEL.md), [DIAGRAMS.md](DIAGRAMS.md), [TEST_CASES.md](TEST_CASES.md), [NO_SQL_RUNBOOK.md](NO_SQL_RUNBOOK.md).
