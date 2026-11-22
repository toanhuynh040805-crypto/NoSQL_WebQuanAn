# Bộ minh chứng nên chuẩn bị để nộp/bảo vệ NoSQL
Đây là **danh sách ảnh cần tự chụp** từ dữ liệu chạy thực tế. Không có screenshot/số đo giả trong repo.

## 1. Cấu trúc thư mục hình minh chứng (tạo khi đã chụp)

```text
evidence/
  01-docker-three-databases.png
  02-mongodb-collections.png
  03-mongodb-foods-and-orders.png
  04-mongodb-crud-demo.png
  05-redis-cart-ttl.png
  06-redis-leaderboard.png
  07-neo4j-node-count.png
  08-neo4j-three-relations.png
  09-neo4j-graph-visualization.png
  10-admin-nosql-overview.png
  11-customer-menu-order.png
  12-staff-floor-order.png
  13-kitchen-workflow.png
  14-cashier-payment.png
  15-github-actions-passed.png
  16-benchmark-result.png
```

Các ảnh ở trên là **tên gợi ý**, không phải các tệp đã được tạo sẵn.

## 2. Cách chụp đúng

| Hình | Mở đâu | Điều cần thấy |
|---|---|---|
| 01 | Docker Desktop hoặc `docker compose ps` | Ba container MongoDB, Redis, Neo4j đang chạy |
| 02 | MongoDB Compass: `restaurant_nosql` | Danh sách các collection |
| 03 | Compass: `foods` và `orders` | Món, đơn, cấu trúc `items[]`; che dữ liệu nhạy cảm |
| 04 | `database/mongodb/02_crud_demo.js` | CREATE/READ/UPDATE/DELETE và aggregate |
| 05 | Redis CLI sau khi có giỏ | `SCAN cart:*`, `TTL` |
| 06 | Redis CLI | `ZREVRANGE leaderboard:foods` |
| 07 | Neo4j Browser | 3 nhãn node và số lượng |
| 08 | Neo4j Browser | `BELONGS_TO`, `ORDERED`, `REVIEWED` |
| 09 | Neo4j Browser Graph | Node Customer→Food→Category và đường nối |
| 10 | Quản lý → `/operations?tab=nosql` | Số lượng live của 3 DB |
| 11 | Khách → trang thực đơn/giỏ/đơn | Chức năng khách |
| 12 | Phục vụ → `/staff/tables` | Sơ đồ bàn, phiên, món gọi |
| 13 | Bếp → `/kitchen` | Các trạng thái chế biến |
| 14 | Thu ngân → sơ đồ bàn/hóa đơn | Tiền mặt hoặc QR BIDV; che dữ liệu ngân hàng nếu không cần |
| 15 | GitHub Actions tại SHA nộp | Jobs verify/integration xanh |
| 16 | PowerShell `node scripts/benchmark-nosql.mjs` | Số đo thật min/avg/p95 |

## 3. Hướng dẫn ghi chú hình trong báo cáo

Ví dụ: **Hình 4.2. Sơ đồ collection trong cơ sở dữ liệu MongoDB**. Dưới hình thêm: *Nguồn: Nhóm thực hiện, chụp từ MongoDB Compass ngày [ngày đo thực tế]*.

Không lấy số liệu từ hình người khác và không đưa mật khẩu, token, hash, số điện thoại khách vào hình. Số liệu đếm MongoDB/Redis/Neo4j có thể thay đổi sau mỗi lần seed hoặc chạy demo, vì vậy ghi thời điểm đo và môi trường.

## 4. Các công cụ chụp/đo

- MongoDB: `docker exec restaurant-mongodb mongosh ...` hoặc Compass.
- Redis: `docker exec restaurant-redis redis-cli ...`.
- Neo4j: http://localhost:7474.
- Website: http://localhost:5173.
- CI: GitHub repo → Actions → chọn run theo commit cuối.
- Benchmark: `node scripts/benchmark-nosql.mjs`. Đây là thời gian HTTP đầu-cuối, không phải thời gian DB riêng.
