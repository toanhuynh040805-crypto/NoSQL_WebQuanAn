# Website quản lý đặt món tại quán ăn

Dự án môn NoSQL sử dụng đồng thời ba mô hình dữ liệu:

- **MongoDB (document):** nguồn dữ liệu chính cho tài khoản, danh mục, món ăn, đơn hàng và đánh giá.
- **Redis (key-value):** giỏ hàng có thời hạn 24 giờ, cache danh mục, token đăng xuất và bảng xếp hạng món bán chạy.
- **Neo4j (graph):** đồ thị `Customer → Food → Category`; các quan hệ `ORDERED`, `REVIEWED`, `BELONGS_TO` được dùng để gợi ý món.

Source này là dự án độc lập. Dữ liệu minh họa và một số ảnh món ăn được điều chỉnh từ KLCN của nhóm; không kết nối hoặc thay đổi cơ sở dữ liệu SQL Server của KLCN.

## Chức năng đã triển khai

### Khách hàng

- Đăng ký, đăng nhập, đăng xuất.
- Xem, tìm kiếm, lọc thực đơn.
- Nhận gợi ý món từ Neo4j; tự chuyển sang món phổ biến nếu chưa đủ dữ liệu.
- Thêm, sửa số lượng, xóa món trong giỏ hàng Redis.
- Đặt món dùng tại quán hoặc mang về.
- Theo dõi trạng thái và lịch sử đơn.
- API đánh giá món trong đơn đã hoàn thành.
- Tự động chuyển giỏ khách sang tài khoản sau khi đăng nhập/đăng ký.
- Quản lý hồ sơ, đổi mật khẩu, điểm thành viên và món yêu thích.
- Đặt bàn, chọn khu vực, theo dõi hoặc hủy yêu cầu đặt bàn.
- Xem khuyến mãi, nhập mã giảm giá và chọn phương thức thanh toán.
- Nhận thông báo khi đơn hàng hoặc lịch đặt bàn thay đổi.

### Quản trị

- Dashboard khách hàng, món ăn, đơn đang xử lý, bàn, đặt bàn và doanh thu ngày.
- Quản lý đơn hàng, thanh toán, quy trình xác nhận → chế biến → sẵn sàng → hoàn thành.
- Quản lý món, ảnh món, danh mục, bàn, đặt bàn, khách hàng, nhân viên và phân quyền.
- Quản lý khuyến mãi và báo cáo doanh thu/món bán chạy theo thời gian.
- Quản lý kho nguyên liệu, nhập/xuất kho và cảnh báo sắp hết hàng.
- Màn hình bếp riêng, tự cập nhật danh sách món mỗi 10 giây.

### Vai trò hệ thống

| Vai trò | Phạm vi chính |
|---|---|
| `admin` | Toàn bộ hệ thống, thực đơn, người dùng, báo cáo |
| `staff` | Đơn hàng, đặt bàn và sơ đồ bàn |
| `kitchen` | Nhận món, bắt đầu chế biến và báo món sẵn sàng |
| `cashier` | Thanh toán, hoàn tất đơn và báo cáo doanh thu |
| `customer` | Đặt món, đặt bàn và các chức năng khách hàng |

## Kiến trúc

```text
React/Vite (5173)
       │ REST API + JWT
Node.js/Express (5000)
       ├── MongoDB (27017): dữ liệu nghiệp vụ
       ├── Redis   (6379): giỏ hàng, cache, leaderboard
       └── Neo4j   (7687): quan hệ và gợi ý món
```

## Chạy dự án

Yêu cầu: Node.js 20+, npm và Docker Desktop.

```bash
# 1. Tạo file cấu hình trên Windows PowerShell
Copy-Item .env.example .env

# 2. Khởi động ba cơ sở dữ liệu
docker compose up -d

# 3. Cài thư viện
npm run install:all

# 4. Tạo dữ liệu mẫu (chạy sau khi container đã sẵn sàng)
npm run seed

# 5. Mở hai terminal trong VS Code
npm run dev:backend
npm run dev:frontend
```

Truy cập:

- Website: <http://localhost:5173>
- API: <http://localhost:5000/api/health>
- Neo4j Browser: <http://localhost:7474> (`neo4j` / `restaurant123`)

Tài khoản mẫu sau khi seed:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Quản trị | `admin@quanan.vn` | `123456` |
| Khách hàng | `khach@quanan.vn` | `123456` |
| Phục vụ | `staff@quanan.vn` | `123456` |
| Bếp | `bep@quanan.vn` | `123456` |
| Thu ngân | `thungan@quanan.vn` | `123456` |

## Khi website không hiển thị thực đơn

- API `/api/foods?limit=50` phải có `foods`; `/api/categories` phải trả về các danh mục.
- Nếu trả mảng trống, dữ liệu món ăn trong **MongoDB của máy đang chạy** chưa có. Khi backend khởi động mà collection món **hoàn toàn trống**, ứng dụng tự tạo 37 món KLCN và 7 danh mục (không sửa món đã có).
- Để khôi phục an toàn cả những món thiếu trong DB mà không xóa tài khoản, đơn hàng, phiếu thu và các phiên bàn, chạy **`npm run restore:menu`** từ thư mục dự án rồi tải lại web.
- **Không dùng `npm run seed` để sửa lỗi mất món** nếu muốn giữ dữ liệu hiện có: đây là lệnh reset demo, xóa dữ liệu hoạt động.
- Nếu API báo lỗi kết nối, hãy kiểm tra Docker Desktop, `docker compose ps`, terminal backend, và `http://localhost:5000/api/health`. Trên Vite, `/api` và `/images` được chuyển tiếp tới backend cổng 5000.
- Tên và ảnh món lấy từ bộ dữ liệu KLCN lưu trong `backend/src/data/menuCatalog.js`; ảnh tương ứng nằm trong `backend/public/images/menu`.

## Điều hướng theo tài khoản nhân viên

- Truy cập `/` sẽ đưa tài khoản **phục vụ** và **thu ngân** đến `/staff/tables`, tài khoản **bếp** đến `/kitchen`, tài khoản **quản lý** đến `/operations`.
- Khách/khách chưa đăng nhập vẫn thấy thực đơn ở `/`; quản trị có thể xem thực đơn bằng đường dẫn `/menu`.
- Nhân viên không còn thấy nút giỏ hàng/đặt món của khách trong thanh điều hướng. Thu ngân dùng sơ đồ bàn để thu tiền.

## Luồng dữ liệu đặt món

1. Khách chọn món; API lưu từng mục vào hash Redis `cart:user:<id>` hoặc `cart:guest:<id>`.
2. Khi xác nhận, API đọc giỏ Redis và lấy lại giá hiện hành từ MongoDB để tránh tin giá từ trình duyệt.
3. Đơn hàng và bản chụp tên/giá món được ghi vào collection `orders` của MongoDB.
4. Redis tăng điểm trong sorted set `leaderboard:foods` và xóa giỏ hàng.
5. Neo4j tăng quan hệ `(Customer)-[:ORDERED]->(Food)` để làm dữ liệu gợi ý.

## Một số API chính

| Phương thức | Endpoint | Chức năng |
|---|---|---|
| `POST` | `/api/auth/register` | Đăng ký |
| `POST` | `/api/auth/login` | Đăng nhập |
| `GET` | `/api/foods` | Xem/tìm/lọc món |
| `GET` | `/api/recommendations` | Gợi ý món |
| `GET` | `/api/cart` | Đọc giỏ Redis |
| `PUT` | `/api/cart/items/:foodId` | Thêm/sửa món trong giỏ |
| `POST` | `/api/orders` | Tạo đơn từ giỏ |
| `GET` | `/api/orders/mine` | Lịch sử đơn |
| `POST` | `/api/reviews` | Đánh giá món |
| `GET` | `/api/admin/dashboard` | Thống kê quản trị |

## Quy trình bàn phục vụ (nâng cấp từ KLCN)

- Phục vụ, thu ngân và quản lý có trang **/staff/tables** với sơ đồ bàn, lịch đặt, phiên bàn, gọi món trực tiếp và thanh toán.
- Mỗi bàn chỉ có một phiên active; khóa quyền chỉnh sửa bằng Redis trong 5 phút.
- Gọi món theo lượt (staff orders), bếp xử lý, phục vụ xác nhận đã mang món ra, thu ngân xác nhận thanh toán trước khi kết thúc phiên.
- Hướng dẫn và phần KLCN còn thiếu: [docs/STAFF_ORDER_WORKFLOW.md](docs/STAFF_ORDER_WORKFLOW.md).
- **Thanh toán tiền mặt hoặc chuyển khoản BIDV (VietQR)**: thu ngân mở hóa đơn chung của bàn, nhập tiền khách đưa/tiền thối hoặc xác nhận chuyển khoản sau khi tra cứu khoản tiền thực nhận; lưu `PaymentReceipt` và khóa gọi thêm sau khi thu tiền.
- Khách đặt từ Web chọn tiền mặt hoặc chuyển khoản khi đặt món, xem QR trong **Đơn của tôi**; doanh thu báo cáo chỉ tính đơn đã thanh toán.
- Xem chi tiết ngân hàng và các bước bảo đảm an toàn: [docs/PAYMENT_FLOW.md](docs/PAYMENT_FLOW.md).

**Quan trọng:** QR chỉ là hướng dẫn chuyển tiền, **chưa tích hợp đối soát ngân hàng tự động**, thu ngân cần xác minh giao dịch thực tế.

## Hồ sơ nộp môn NoSQL và nơi xem trực tiếp ba database

Bộ hồ sơ nộp cuối kỳ đã được bổ sung theo yêu cầu giảng viên:

| Mục | File |
|---|---|
| Yêu cầu phần mềm | [SRS](docs/SRS.md) |
| Thiết kế phần mềm | [SDS](docs/SDS.md) |
| Database Model MongoDB/Redis/Neo4j | [Database Model](docs/DATABASE_MODEL.md) |
| Use Case, DFD cấp 0/1, Activity, Sequence và ERD | [Sơ đồ](docs/DIAGRAMS.md) |
| Scripts, JSON mẫu của từng CSDL | [MongoDB](database/mongodb), [Redis](database/redis), [Neo4j](database/neo4j) |
| Test case và bằng chứng | [Test Cases](docs/TEST_CASES.md), [Bằng chứng cần chụp](docs/EVIDENCE_CHECKLIST.md) |
| Báo cáo kết quả và hoạt động nhóm | [Báo cáo](docs/FINAL_REPORT.md), [Hoạt động nhóm](docs/GROUP_ACTIVITY.md) |
| Đối chiếu đề giảng viên | [Checklist](docs/REQUIREMENTS_CHECKLIST.md) |
| Chuẩn bị nộp | [Hướng dẫn nộp](docs/SUBMISSION_GUIDE.md) |
| **Mở và chỉ ra MongoDB / Redis / Neo4j** | **[Hướng dẫn xem 3 cơ sở dữ liệu](docs/NO_SQL_RUNBOOK.md)** |

**Ngay trên website:** đăng nhập tài khoản quản trị → **Vận hành → CSDL NoSQL**
(đường dẫn `http://localhost:5173/operations?tab=nosql`) để xem số lượng tài liệu MongoDB, key/TTL Redis và node/quan hệ Neo4j đọc trực tiếp. Chỉ admin được xem.

**Trong code:**
- Docker khai báo ba máy chủ ở `docker-compose.yml`, cấu hình `.env.example`, kết nối `backend/src/config/database.js`.
- MongoDB `backend/src/models/` và `routes/`, tên database `restaurant_nosql`, cổng 27017.
- Redis `backend/src/services/cart.js`, `cache.js`, `routes/staff.js`, cổng 6379.
- Neo4j `backend/src/services/graph.js`, `routes/recommendations.js`, Bolt cổng 7687, Browser cổng 7474.

Kiểm tra môi trường phát triển bằng lệnh **chỉ đọc** (cần ba container đang hoạt động):
```powershell
npm run verify:databases
npm run test:course
```

Sau khi backend chạy, muốn tự đo thời gian phản hồi HTTP của API danh mục:
```powershell
node scripts/benchmark-nosql.mjs
```
Lưu số liệu chạy thật vào báo cáo; không được coi số liệu minh họa là kết quả đo. Trong tài liệu hướng dẫn, Cassandra được nêu như lựa chọn phù hợp với log/time-series; phần yêu cầu chung không khẳng định bắt buộc dùng đủ bốn DBMS. Nhóm vẫn cần xác nhận với giảng viên cách diễn giải “ít nhất bốn loại dữ liệu” và nộp đủ minh chứng.

## Ngoài phạm vi bản đồ án hiện tại

- Tích hợp cổng thanh toán thật và xử lý callback từ nhà cung cấp thanh toán.
- Tích hợp đơn vị giao hàng, bản đồ và theo dõi tài xế theo thời gian thực.
- Kết nối máy in bếp, máy in hóa đơn và hóa đơn điện tử theo môi trường triển khai thực tế.
- Mở rộng kiểm thử tự động và giám sát hệ thống, sao lưu trước khi triển khai production.
- Chuẩn hóa báo cáo thực nghiệm: thời gian truy vấn, cache hit/miss, truy vấn Cypher và ảnh minh chứng ba CSDL.

