# Đối chiếu chức năng KLCN → website NoSQL

Nguồn đối chiếu: repository KLCN `toanhuynh040805-crypto/KhoaLuan_AppQuanLyQuanAn_Toan` (Backend .NET / WinForms / Flutter / Web), và yêu cầu phát triển Web NoSQL.

> Mục đích: chuyển nghiệp vụ, **không** thay thế cơ sở dữ liệu SQL Server của KLCN. NoSQL_WebQuanAn là ứng dụng độc lập sử dụng MongoDB, Redis và Neo4j.

## Ma trận chuyển chức năng (21/11/2026)

| Nhóm | Nghiệp vụ KLCN | Web NoSQL |
|---|---|---|
| Khách | Tài khoản, xem thực đơn/ảnh, đặt món, lịch sử | **Có** (đã có trước) |
| Khách | Đặt bàn, theo dõi/hủy, khách nhận thông báo | **Có cơ bản**, đã thêm kiểm tra trùng khung giờ và giữ bàn gần giờ hẹn |
| Khách | Điểm thành viên, khuyến mãi, đánh giá | **Có cơ bản**; áp dụng điểm khi thanh toán **chưa có** |
| Khách | QR theo bàn và gọi thêm trên cùng phiên | **Chưa**; Web/QR chưa được kết nối với phiên TableSession của nhân viên |
| Phục vụ | Sơ đồ theo khu, trạng thái bàn, nhận bàn thường/đặt | **Đã bổ sung** /staff/tables |
| Phục vụ | Chọn bàn rồi gọi món, ghi chú, gọi thêm nhiều lượt | **Đã bổ sung** |
| Phục vụ | Khóa thao tác tránh hai nhân viên sửa cùng một bàn | **Đã bổ sung** Redis TTL 5 phút |
| Phục vụ | Chỉnh số lượng/hủy món trước bếp, ưu tiên món | **Đã bổ sung** ở cấp dòng món và ưu tiên ở cấp lượt order |
| Phục vụ | Chuyển bàn và lưu nhật ký | **Đã bổ sung** cho bàn thường, chuyển toàn bộ đơn thuộc phiên |
| Phục vụ | Tách/gộp bàn, ràng buộc thành viên, thống nhất nhật ký | **Chưa** |
| Phục vụ | Giao bàn theo ca/khu; kiểm tra quyền chính xác khu T1 A/T1 B | **Chưa** |
| Bếp/nước | Nhận món và thay đổi trạng thái chế biến | **Có** theo lượt order, polling 10 giây |
| Bếp/nước | Tách station bếp/nước, ưu tiên từng món, đẩy realtime | **Chưa đầy đủ** |
| Thu ngân | Xem món bàn, nhận tiền mặt/chuyển khoản, kết thúc phiên | **Đã bổ sung** bảng tổng hóa đơn, tiền thối, VietQR BIDV và biên nhận có người xác nhận; chuyển khoản hiện đối soát thủ công |
| Thu ngân | Phiếu tạm tính có QR, hóa đơn sau thanh toán, tiền cọc, hoàn tiền | **Đã có** bảng tạm tính/VietQR và phiếu thu MongoDB; **chưa có** PDF/in hóa đơn, cọc, trừ cọc, hoàn tiền |
| Quản lý | Dashboard, danh mục, thực đơn, nhân viên, kho, khuyến mãi | **Có cơ bản** |
| Quản lý | Phân quyền chi tiết, CRUD ca làm, điều phối khu vực, chấm công GPS | **Chưa** |
| Quản lý | Thống kê khách, báo cáo doanh thu, phân tích hiệu quả | **Có cơ bản**; thống kê khách chi tiết **chưa có** |
| Toàn hệ thống | Thông báo liên nền tảng realtime, lịch sử thao tác, audit | **Một phần**; thông báo hiện lưu MongoDB, bếp polling, phiên bàn có activity log |
| Khảo sát NoSQL | Gợi ý dựa trên khách/món/danh mục | **Có** bằng Neo4j |
| Khảo sát NoSQL | Cache, giỏ hàng, khóa phiên, leaderboard | **Có** bằng Redis |
| Khảo sát NoSQL | Dữ liệu nghiệp vụ document | **Có** bằng MongoDB |

## Nguyên tắc kỹ thuật khi tiếp tục

- Chỉ một `TableSession` trạng thái `active` trên mỗi bàn. Đơn ở nhiều lượt luôn gắn đúng `tableSession` và giữ snapshot giá.
- Cần tích hợp giỏ của khách và QR vào `TableSession` để phục vụ, bếp và thu ngân thấy một nguồn dữ liệu chung.
- Không bao giờ tự đổi bàn thành `available` chỉ do một đơn hoàn tất nếu bàn còn phiên hoặc lịch đặt đang đến.
- Tách/gộp/chuyển phải giữ lịch sử và tiền của từng món, không làm mất quan hệ `Order`, `Reservation`, `Customer`.
- Với hoạt động quan trọng (thu tiền, đóng bàn, chuyển bàn), cần khóa/giao dịch an toàn và bài kiểm thử cạnh tranh; không dựa vào việc chỉ ẩn nút phía giao diện.
- Thực thi `npm run seed` sẽ **xóa dữ liệu demo đang có**. Không dùng lệnh này trên dữ liệu cần giữ.

## Thứ tự công việc kế tiếp

1. Hợp nhất đơn Web/QR vào phiên bàn chung, bảo vệ token QR; thêm đặt cọc, trừ cọc, khuyến mãi/điểm thành viên theo hóa đơn (tiền mặt/chuyển khoản BIDV đã có xác nhận thủ công).
2. Tách/gộp/chuyển có ràng buộc thành viên, số lượng, bàn đích và kiểm thử 2 nhân viên.
3. Realtime sự kiện trạng thái bàn/đơn/bếp/thu ngân, chia bếp/nước ở cấp món.
4. Ca làm, giao khu chính xác, chấm công GPS, thông báo đặt bàn đến giờ/quá giờ.
5. Hoàn thiện báo cáo/biểu đồ/audit log; đồng bộ SRS, SDS, DFD, Use Case, mô hình MongoDB/Redis/Neo4j và kiểm thử.

**Ghi chú:** Ma trận này phân biệt rõ phần đã có code và phần chưa chuyển; không coi build thành công là đã kiểm chứng đầy đủ nghiệp vụ.

Chi tiết: [PAYMENT_FLOW.md](PAYMENT_FLOW.md).
