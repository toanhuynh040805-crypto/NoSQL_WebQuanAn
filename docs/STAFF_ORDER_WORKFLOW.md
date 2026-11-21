# Nghiệp vụ sơ đồ bàn và gọi món (chuyển từ KLCN sang NoSQL)

## Đã triển khai trong nhánh feat/klcn-staff-table-ordering

1. Phục vụ đăng nhập được chuyển thẳng tới `/staff/tables`; thu ngân cũng mở sơ đồ bàn; quản lý có link truy cập.
2. Hiển thị sơ đồ theo khu, màu trống/đặt/đang phục vụ, tổng số chỗ, lượng khách, lịch đặt đã xác nhận.
3. Phục vụ nhận bàn thường hoặc bàn đặt đã xác nhận (cho phép nhận khách thường khi đặt bàn còn xa; khóa giữ bàn khi lịch đặt đến trong 30 phút). Dùng MongoDB `table_sessions` và unique partial index để chống mở hai phiên hoạt động trên cùng một bàn.
4. Redis quản lý quyền thao tác bàn 5 phút (`table:lock:<sessionId>`), có nhận, gia hạn, trả quyền; nhân viên khác được xem nhưng không được gửi món khi khóa còn hiệu lực.
5. Chọn món, ghi chú, tăng giảm số lượng, gửi từng lượt order từ đúng bàn; MongoDB lưu snapshot giá tại lúc gọi. `clientRequestId` chống tạo trùng đơn khi gửi lại. Chỉnh/hủy số lượng dòng món chỉ được thực hiện trước khi bếp bắt đầu chế biến; có ưu tiên theo lượt món.
6. Bếp tiếp nhận các order đã xác nhận trong màn hình `/kitchen` (đang polling 10 giây). Khi bếp báo sẵn sàng, phục vụ xác nhận đã mang ra.
7. Thu ngân thanh toán **toàn bộ lượt món chưa thanh toán trong phiên bàn** bằng tiền mặt (nhập tiền khách đưa và tính tiền thối) hoặc chuyển khoản BIDV/VietQR (đối chiếu giao dịch thực nhận thủ công); lưu phiếu thu và chỉ được kết thúc phiên khi toàn bộ lượt món không hủy đã phục vụ và thanh toán. Nếu còn đặt bàn đã xác nhận thì bàn trở lại trạng thái đặt, thay vì trả trống bừa bãi.
8. Có chuyển bàn trống đủ chỗ (chuyển cả phiên và lịch sử đơn, kiểm tra lịch đặt gần nhất), không cho tự chuyển bàn đã nhận theo lịch đặt. Lưu nhật ký mở bàn, gọi món và đóng phiên ở `TableSession.activity`. Giữ nguyên đường gọi món cho khách hàng hiện có.

## Phân quyền

| Quyền | Phục vụ | Bếp | Thu ngân | Quản lý |
|---|---|---|---|---|
| Xem sơ đồ | Có | Không | Có | Có |
| Nhận bàn và gọi món | Có | Không | Không | Có |
| Chuyển món sang đang làm / sẵn sàng | Không (trong UI mới) | Có | Không | Có (màn hình bếp) |
| Đánh dấu đã phục vụ | Có | Không | Không | Có |
| Xác nhận thanh toán | Không | Không | Có | Có |
| Kết thúc phiên và trả bàn | Không | Không | Có | Có |

## Chạy thử an toàn

- Khởi động Docker và backend/frontend như README; nếu MongoDB hiện có dữ liệu cần giữ thì **không chạy `npm run seed`**.
- Đăng nhập `staff@quanan.vn` (tài khoản mẫu sau khi seed); mặc định mở `/staff/tables`.
- Chọn bàn trống -> nhận bàn -> giữ khóa 5 phút -> thêm món -> gửi bếp.
- Đăng nhập `bep@quanan.vn` ở trình duyệt khác, vào `/kitchen`: bắt đầu chế biến và báo sẵn sàng.
- Trở lại nhân viên phục vụ: đánh dấu đã phục vụ.
- Đăng nhập `thungan@quanan.vn`, chọn bàn -> xác nhận thu tiền -> kết thúc phiên -> sơ đồ bàn cập nhật.
- Thử hai nhân viên nhận cùng bàn hoặc gọi món khi nhân viên khác giữ khóa: phải bị chặn.
- Khi có phiên đang phục vụ, quản trị không thể tự đổi trạng thái bàn hoặc ngừng sử dụng bàn; thu ngân yêu cầu phục vụ trả quyền trước khi đóng phiên.

## Còn cần chuyển từ KLCN để đạt đầy đủ nghiệp vụ

- Session hóa các đơn do khách web/QR tạo để chia sẻ một phiên bàn duy nhất với phục vụ; mã QR an toàn gắn phiên bàn.
- Realtime WebSocket/SignalR tương đương cho bếp, phục vụ, thu ngân và thông báo (thay thế polling).
- Nhắc lịch tự động khi đến giờ/quá giờ; đã có kiểm tra trùng lịch và khung nhận bàn đặt ±30 phút, nhưng chưa có tác vụ nền gửi nhắc.
- Tách và gộp bàn với nhật ký, chặn gộp hai khách thành viên khác nhau, giữ tên thành viên khi tách (chuyển bàn thường đã được bổ sung).
- Ưu tiên món ở cấp từng món và cho từng bộ phận bếp/nước (hiện đã có ưu tiên ở cấp lượt order).
- In/PDF phiếu tạm tính và hóa đơn thanh toán, đặt cọc, trừ cọc, áp dụng điểm loyalty vào hóa đơn; thanh toán tiền mặt, VietQR và chống tạo biên nhận trùng đã bổ sung.
- Quản lý ca làm, khu vực phụ trách, GPS/check-in, phân quyền chi tiết; thống kê khách và báo cáo mở rộng.
- Audit logs bền vững, kiểm thử giao dịch cạnh tranh và stress tests, xử lý phục hồi khi đồng bộ Neo4j/Redis bị lỗi.

Ghi chú: Đây là phần **đã bổ sung thật** để bắt đầu chuyển nghiệp vụ, không tuyên bố toàn bộ KLCN đã được chuyển xong. Với đơn hàng khách web hiện có nhưng chưa gắn `TableSession`, cần xử lý trong luồng `/operations?tab=orders` cho đến khi triển khai hợp nhất phiên QR/web.

Tài liệu thanh toán: [PAYMENT_FLOW.md](PAYMENT_FLOW.md).
