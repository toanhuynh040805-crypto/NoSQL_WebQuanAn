# Kịch bản demo đồ án NoSQL

## Chuẩn bị trước khi báo cáo

Ứng dụng theo hướng 2 trong `HD_DoAn_NoSQL(1).docx`: sử dụng NoSQL làm nền tảng dữ liệu chính. Không kết nối SQL Server của KLCN.

```powershell
docker compose up -d
npm run install:all
npm run restore:menu
npm run verify:databases
npm test
npm run build
```

Mở hai terminal để chạy `npm run dev:backend` và `npm run dev:frontend`. Truy cập `http://localhost:5173`.

`npm run seed` xóa và tạo lại dữ liệu mẫu. Chỉ dùng khi chủ động tạo một bộ dữ liệu demo mới; không chạy sau mỗi lần pull. `restore:menu` bổ sung thực đơn mà giữ tài khoản và giao dịch hiện có.

Tài khoản demo dùng mật khẩu `123456`: quản trị `admin@quanan.vn`, phục vụ `staff@quanan.vn`, bếp `bep@quanan.vn`, thu ngân `thungan@quanan.vn`, khách `khach@quanan.vn`. Dùng các cửa sổ trình duyệt/profile riêng để giữ phiên đăng nhập độc lập.

## Các màn hình cần show theo thứ tự (khoảng 8–10 phút)

| Thứ tự | Đăng nhập / Màn hình | Thao tác trực tiếp | Nội dung giải thích |
|---|---|---|---|
| 1 | Quản trị → Vận hành → CSDL NoSQL | Mở bảng đếm thật của MongoDB, Redis, Neo4j | Ba hệ CSDL có vai trò khác nhau; số liệu được truy vấn từ DB đang chạy |
| 2 | Quản trị → Khách hàng | Thêm một khách với email và mật khẩu, tìm theo SĐT, sửa ghi chú, mở hồ sơ | MongoDB lưu hồ sơ document; dữ liệu nhập được kiểm tra; lịch sử được giữ khi khóa tài khoản |
| 3 | Phục vụ → Sơ đồ bàn & order | Chọn bàn trống, nhập số khách, tìm và chọn khách thành viên vừa tạo, nhận bàn | Một bàn chỉ có một phiên hoạt động; khách thành viên được gắn theo ID |
| 4 | Phục vụ → bàn đang mở | Thêm món và ghi chú, gửi bếp; mở bàn bằng một tài khoản phục vụ khác | Redis giữ quyền thao tác có TTL 5 phút; nhân viên khác không sửa đồng thời |
| 5 | Bếp | Chuyển món từ chờ chế biến → đang chế biến → sẵn sàng | Trạng thái phải đúng thứ tự; sau khi bếp bắt đầu thì không sửa số lượng |
| 6 | Phục vụ | Đánh dấu đã phục vụ | Hoàn thành phục vụ và thu tiền là hai trạng thái độc lập; chưa thu tiền thì chưa cộng điểm |
| 7 | Khách thành viên → Đơn của tôi | Mở Thanh toán / QR, quét QR, chọn Tôi đã chuyển khoản — báo thu ngân | QR chứa đúng tài khoản BIDV cũ, số tiền và nội dung; thông báo của khách chưa tự chuyển hóa đơn thành đã trả |
| 8 | Thu ngân → Sơ đồ bàn hoặc Vận hành → Đơn hàng | Mở Thu tiền, chọn Chuyển khoản; nếu bàn đang bị giữ, tích Tiếp nhận bàn; đối chiếu tiền và nhập mã giao dịch thực nhận | Chỉ thu ngân/quản trị được xác nhận. Có khóa chống xử lý trùng và mã giao dịch không dùng cho hai hóa đơn |
| 9 | Thu ngân → Sơ đồ bàn | Kết thúc phiên & trả bàn | Chỉ đóng bàn khi món đã phục vụ và các đơn đã thanh toán; giữ nhật ký hoạt động |
| 10 | Quản trị → Khách hàng và Báo cáo | Mở lại khách; xem lịch sử, tiền chi tiêu, điểm; lọc doanh thu ngày | Chi tiêu và điểm theo tiền đã thu; báo cáo theo ngày nhận tiền, múi giờ Việt Nam |
| 11 | Neo4j Browser | Chạy truy vấn đồ thị dưới đây | Minh chứng ba quan hệ ORDERED, REVIEWED, BELONGS_TO; giải thích gợi ý từ khách có lịch sử tương đồng |

Không cần chuyển tiền thật trong buổi trình diễn nghiệp vụ: có thể minh họa QR rồi thu bằng tiền mặt. Nếu thử nghiệm giả lập mã giao dịch trên bộ dữ liệu demo, phải nói rõ đó là dữ liệu kiểm thử. Ứng dụng hiện xác nhận chuyển khoản thủ công, chưa nhận webhook ngân hàng.

## Show MongoDB ở đâu

- Kết nối MongoDB Compass: `mongodb://localhost:27017`, database `restaurant_nosql`.
- Mở `users`: hồ sơ khách; `orders`: danh sách món nhúng, giá tại lúc đặt, lịch sử trạng thái, `paymentStatus`.
- Mở `tablesessions`: khách thành viên, hoạt động nhận/gọi/chuyển/đóng bàn; `paymentreceipts`: phiếu thu và mã giao dịch ngân hàng.
- Code: `backend/src/models/`, `backend/src/routes/customers.js`, `backend/src/routes/payments.js`.
- Script CRUD, lọc/sắp xếp và thống kê: `database/mongodb/`.

```javascript
// Chạy trong mongosh, chỉ đọc dữ liệu.
use restaurant_nosql
db.orders.find({}, {orderCode:1, customer:1, tableSession:1, totalAmount:1, paymentStatus:1, paidAt:1}).sort({createdAt:-1}).limit(5)
db.paymentreceipts.find({}, {receiptCode:1, method:1, amount:1, bankTransactionRef:1, verifiedAt:1}).sort({createdAt:-1}).limit(5)
db.users.find({role:'customer'}, {fullName:1, phone:1, loyaltyPoints:1}).limit(5)
```

## Show Redis ở đâu

Mở terminal tại thư mục dự án:

```powershell
docker compose exec redis redis-cli PING
docker compose exec redis redis-cli --scan --pattern "cart:*"
docker compose exec redis redis-cli --scan --pattern "table:lock:*"
docker compose exec redis redis-cli TTL menu:categories
docker compose exec redis redis-cli ZREVRANGE leaderboard:foods 0 4 WITHSCORES
```

Sau khi thêm món vào giỏ, dùng key thật đã liệt kê để chạy `HGETALL <key>` và `TTL <key>`. Khi nhân viên đang giữ bàn, chạy `GET table:lock:<sessionId>` và `TTL table:lock:<sessionId>`.

- Giỏ hàng: Hash, TTL 24 giờ, `backend/src/services/cart.js`.
- Cache danh mục: String JSON, TTL 300 giây, `backend/src/services/cache.js`.
- Món được gọi nhiều: Sorted Set `leaderboard:foods` (thống kê lượt gọi, có thể khác doanh thu đã thu).
- Quyền thao tác bàn: `table:lock:*`, TTL 300 giây, `backend/src/routes/staff.js`.
- Khóa thao tác thanh toán và sửa món: `payment:confirm:*`, TTL 30 giây; Lua chỉ giải phóng đúng khóa của lượt xử lý.

## Show Neo4j ở đâu

Mở `http://localhost:7474`, đăng nhập theo `.env` (cấu hình demo mặc định `neo4j` / `restaurant123`).

```cypher
MATCH p=(c:Customer)-[r:ORDERED|REVIEWED]->(f:Food)-[:BELONGS_TO]->(cat:Category)
RETURN p LIMIT 40;

MATCH ()-[r]->()
RETURN type(r) AS quanHe, count(r) AS soLuong;

MATCH (me:Customer {id:'THAY_ID_KHACH_HANG_MONGODB'})-[:ORDERED|REVIEWED]->(liked:Food)
MATCH (other:Customer)-[:ORDERED|REVIEWED]->(liked)
WHERE other <> me
MATCH (other)-[:ORDERED|REVIEWED]->(candidate:Food)
WHERE NOT (me)-[:ORDERED|REVIEWED]->(candidate)
RETURN candidate.name AS monGoiY, count(DISTINCT other) AS diem
ORDER BY diem DESC LIMIT 8;
```

Code truy vấn và đồng bộ: `backend/src/services/graph.js`; API: `backend/src/routes/recommendations.js`. Khi thiếu lịch sử tương đồng, ứng dụng bổ sung món phổ biến. Đó là fallback, không được trình bày là kết quả cộng tác Neo4j nếu `strategy` trả về `popular`.

## Đối chiếu đề và phần nhóm cần bổ sung

Đã có SRS, SDS, Database Model, script cho từng DB, test case, CI, khung báo cáo và báo cáo hoạt động nhóm trong `docs/`. Bốn nhóm dữ liệu được minh họa: hồ sơ/thực đơn document; giao dịch và lịch sử sự kiện; giỏ/cache/khóa TTL; quan hệ và gợi ý. Repo dùng ba hệ MongoDB, Redis, Neo4j. Hướng dẫn không ghi mọi dự án phải dùng đủ bốn hệ; nếu giảng viên diễn giải “bốn loại dữ liệu” khác cách phân nhóm này, cần thống nhất lại phạm vi với giảng viên.

Trước khi nộp, nhóm phải điền tên thành viên và phân công thật, chụp ảnh demo thực tế, chạy benchmark trên máy nhóm rồi ghi số đo. Các mốc nộp SRS tuần 6, model tuần 7 và báo cáo tuần 11 không thể được chứng minh chỉ bằng mã nguồn.
