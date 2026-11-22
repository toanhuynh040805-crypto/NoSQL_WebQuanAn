# Khách hàng và thanh toán chuyển khoản

## Thay đổi trong bản cập nhật

- Đưa các chức năng từ bản NoSQL đã làm trước đó vào repo `NoSQL_WebQuanAn`: sơ đồ bàn cho phục vụ, phiên bàn, khóa Redis, bếp, phiếu thu, công cụ kiểm tra DB và tài liệu môn học.
- Tab Khách hàng dành cho quản trị, thu ngân và phục vụ. Quản trị/thu ngân được tạo, sửa hồ sơ; chỉ quản trị được khóa/mở tài khoản; phục vụ chỉ xem. Mật khẩu chỉ nhận lúc tạo và được băm; ghi chú nội bộ không trả về cho phục vụ hoặc khách tự xem.
- Danh sách có tìm kiếm literal theo tên/email/SĐT, lọc hoạt động, phân trang và xuất CSV của trang đang xem. Hồ sơ gồm tổng chi tiêu đã thanh toán, số đơn, số tiền chưa thu, điểm, món thường gọi, 30 đơn và 20 lịch đặt bàn gần nhất.
- Khi nhận bàn có thể chọn khách thành viên có sẵn. Các lượt món do phục vụ tạo được gắn đúng tài khoản để xem lịch sử, chuyển khoản cả bàn và cộng điểm.
- Giữ nguyên thông tin ngân hàng BIDV trước đây. Biến `PAYMENT_BANK_*` trong `.env.example` dùng để cấu hình nếu cần. Không cần ghi đè `.env` đang dùng khi pull.
- QR được dựng cục bộ bằng thư viện QR vendored có giấy phép MIT, không phụ thuộc ảnh `img.vietqr.io`. QR có số tiền và nội dung duy nhất theo hóa đơn.
- Khách có nút báo đã chuyển; thu ngân nhận thông báo và đối chiếu ngân hàng. Đây chưa phải tích hợp ngân hàng tự động.
- Thu ngân được tiếp nhận bàn đang bị phục vụ giữ quyền bằng lựa chọn rõ ràng trong hộp thu tiền. Việc tiếp nhận có nhật ký; thao tác sửa món và thu tiền dùng cùng một khóa để tránh thay đổi tổng tiền lúc xác nhận.
- Phiếu thu có unique index theo hóa đơn, requestId và mã giao dịch ngân hàng. Gửi lại yêu cầu thu tiền trả phiếu thu cũ. Mã giao dịch được chuẩn hóa chữ hoa.
- Điểm chỉ cộng sau khi có phiếu thu, ghi nhận từng order trong cùng phép cập nhật User để gửi lại yêu cầu không cộng hai lần. Các điểm lịch sử đã lưu được giữ nguyên.
- Trạng thái đơn theo thứ tự; không cho nhảy từ chờ xác nhận sang hoàn thành, quay lùi hoặc hủy trực tiếp đơn đã trả tiền.
- Doanh thu dùng `paidAt`, múi giờ Asia/Ho_Chi_Minh, chỉ đơn đã thu. Đơn cũ thiếu `paidAt` dùng `createdAt`. Doanh thu món được phân bổ giảm giá. Có lọc khoảng ngày.

## API mới và luồng kiểm tra

| API | Quyền / Mục đích |
|---|---|
| GET `/api/customers?search=&state=all&page=1&limit=12` | Quản trị, thu ngân, phục vụ: danh sách và thống kê |
| GET `/api/customers/:id` | Hồ sơ, đơn, đặt bàn, món thường gọi |
| POST `/api/customers` | Quản trị/thu ngân: họ tên, email, mật khẩu ban đầu và thông tin liên hệ |
| PATCH `/api/customers/:id` | Quản trị/thu ngân: hồ sơ; `isActive` chỉ quản trị |
| POST `/api/payments/order/:id/report-transfer` | Khách sở hữu đơn báo đã chuyển, trạng thái vẫn pending |
| POST `/api/payments/session/:id/report-transfer` | Khách được gắn vào phiên bàn báo đã chuyển |
| GET `/api/payments/:scope/:id/quote` | Thông tin tiền, QR, thông báo chuyển khoản và người giữ quyền bàn |
| POST `/api/payments/:scope/:id/confirm` | Thu ngân/quản trị; `takeOverTableLock` để tiếp nhận bàn, phải xác nhận tiền thực nhận |

Luồng demo chi tiết: [DEMO_GIANG_VIEN.md](DEMO_GIANG_VIEN.md).

## Kiểm thử

`npm test`: kiểm tra tài liệu môn học, catalog ảnh, vai trò, ngân hàng/CRC, thứ tự trạng thái, biên ngày Việt Nam, QR cục bộ.

`node scripts/smoke-test.mjs` và `node scripts/customer-payment-smoke.mjs`: kiểm thử qua HTTP với ba DB thật. Chạy trên bộ dữ liệu test đã seed vì các script tạo giao dịch thử nghiệm. GitHub Actions tự tạo DB dùng một lần để chạy hai bộ kiểm thử này.

QR không tự xác nhận tiền. Việc kiểm tra API/CI không chứng minh có tiền thật về tài khoản; bước đối chiếu ngân hàng vẫn do thu ngân thực hiện.
