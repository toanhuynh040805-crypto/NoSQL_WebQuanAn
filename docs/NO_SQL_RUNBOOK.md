# Hướng dẫn mở và chứng minh MongoDB – Redis – Neo4j
**Mục tiêu:** Giảng viên hỏi “MongoDB, Redis, Neo4j nằm ở đâu?” → có thể chỉ **file mã nguồn**, **container**, **dữ liệu thật** và **luồng chức năng dùng nó**.

## 1. Nơi chúng nằm trong dự án

| CSDL | Khai báo container | Kết nối backend | Logic truy vấn | Nơi xem thật |
|---|---|---|---|---|
| MongoDB | `docker-compose.yml` service `mongodb`, image mongo:7 | `backend/src/config/database.js` (mongoose) | `backend/src/models/*.js`, `routes/catalog.js`, `routes/orders.js` | MongoDB Compass/mongosh, `restaurant_nosql` |
| Redis | `docker-compose.yml` service `redis`, redis:7-alpine | `backend/src/config/database.js` (node-redis) | `backend/src/services/cart.js`, `cache.js`, `routes/staff.js` | Redis CLI, DB 0 |
| Neo4j | `docker-compose.yml` service `neo4j`, neo4j:5-community | `backend/src/config/database.js` (neo4j-driver) | `backend/src/services/graph.js`, `routes/recommendations.js` | Neo4j Browser trên http://localhost:7474 |

Tài khoản demo Neo4j từ Docker Compose: `neo4j` / `restaurant123` **chỉ trong môi trường phát triển**. MongoDB cổng `27017`, DB `restaurant_nosql`; Redis `6379`; Neo4j Bolt `7687`, giao diện `7474`. Cấu hình `.env` có thể thay đổi các giá trị này.

**GitHub không chứa dữ liệu đang được ghi thật.** Docker lưu vào volume `mongo_data`, `redis_data`, `neo4j_data` (tên Docker volume có thể có tiền tố tên thư mục project).

## 2. Khởi động và kiểm tra trạng thái

Trên Windows PowerShell tại thư mục `E:\NoSQL_WebQuanAn`:

```powershell
docker compose up -d
docker compose ps
docker compose logs --tail 25 mongodb redis neo4j
```

Nếu đã có dữ liệu kinh doanh cần giữ, **không chạy** `docker compose down -v` hoặc `npm run seed`.

Chạy backend và frontend ở hai PowerShell:

```powershell
npm run dev:backend
npm run dev:frontend
```

Kiểm tra API:
```powershell
Invoke-RestMethod http://localhost:5000/api/health
```

## 3. Mở MongoDB — cách 1: Docker mongosh

```powershell
docker exec restaurant-mongodb mongosh restaurant_nosql --quiet --eval "db.getCollectionNames()"
docker exec restaurant-mongodb mongosh restaurant_nosql --quiet --eval "db.foods.countDocuments({})"
docker exec restaurant-mongodb mongosh restaurant_nosql --quiet --eval "db.orders.find({}, {orderCode:1, status:1, totalAmount:1, _id:0}).limit(5).toArray()"
docker exec restaurant-mongodb mongosh restaurant_nosql --quiet --eval "db.tablesessions.find({}, {tableNumber:1, status:1, guestCount:1, _id:0}).limit(5).toArray()"
```

**Cách 2: MongoDB Compass.** New Connection → `mongodb://localhost:27017` → mở database `restaurant_nosql` → collection `foods`, `orders`, `users`, `reviews`, `paymentreceipts`. Không sửa/xóa dữ liệu khi đang demo.

Script MongoDB `database/mongodb/01_inspect.js`: trên PowerShell có thể chuyển nội dung qua stdin:
```powershell
Get-Content -Raw .\database\mongodb\01_inspect.js | docker exec -i restaurant-mongodb mongosh restaurant_nosql --quiet
```

## 4. Mở Redis — dùng Redis CLI

```powershell
docker exec restaurant-redis redis-cli PING
docker exec restaurant-redis redis-cli --scan --pattern "cart:*"
docker exec restaurant-redis redis-cli TTL menu:categories
docker exec restaurant-redis redis-cli ZREVRANGE leaderboard:foods 0 9 WITHSCORES
docker exec restaurant-redis redis-cli --scan --pattern "table:lock:*"
```

Kết quả `TTL` có thể là `-2` (key chưa có/đã hết hạn), `-1` (key tồn tại nhưng không có TTL), hoặc số giây còn lại. Redis `cart:*` có thể trống nếu chưa có ai thêm món. Mở trình duyệt và thêm món sẽ xuất hiện giỏ (guest cần header x-cart-id). Vào tài khoản phục vụ, nhận/giữ quyền thao tác bàn sẽ xuất hiện `table:lock:*`.

## 5. Mở Neo4j Browser

Truy cập **http://localhost:7474** → đăng nhập dev `neo4j` / `restaurant123` → chạy riêng từng câu:

```cypher
MATCH (n) RETURN labels(n) AS Loai, count(n) AS SoLuong;
```

```cypher
MATCH ()-[r]->() RETURN type(r) AS QuanHe, count(r) AS SoLuong;
```

```cypher
MATCH (f:Food)-[:BELONGS_TO]->(c:Category)
RETURN f.name AS MonAn, c.name AS DanhMuc LIMIT 12;
```

```cypher
MATCH p=(c:Customer)-[:ORDERED]->(f:Food)
RETURN p LIMIT 10;
```

Chuyển sang chế độ Graph để thấy node và đường quan hệ. Nếu chưa có ORDERED, phải tạo đơn từ tài khoản khách hoặc dùng data demo riêng (không chạy reset dữ liệu thật).

## 6. Xem cả ba DB ngay trong website

Đăng nhập `admin@quanan.vn` (nếu tài khoản demo tồn tại) → **Vận hành → CSDL NoSQL** hoặc đường dẫn:

```text
http://localhost:5173/operations?tab=nosql
```

Màn hình chỉ đọc cho quản trị, hiển thị document count MongoDB, key/TTL Redis, node/relationship count Neo4j. Nhấn **Làm mới** sau khi đặt món để thấy số liệu thay đổi. Nếu không vào được, kiểm tra backend của nhánh mới và JWT admin.

Để kiểm tra bằng terminal ở môi trường đã cài thư viện:

```powershell
npm run verify:databases
```

Script này chỉ đọc và không hiển thị mật khẩu, hash hoặc nội dung tài khoản cá nhân.

## 7. Kịch bản trình diễn ba hệ trong 5 phút

1. **0:00–0:40:** Mở Docker Desktop, `docker compose ps`, chỉ ba container.
2. **0:40–1:30:** Quản lý → CSDL NoSQL, chỉ DB/collection và số node/quan hệ.
3. **1:30–2:10:** MongoDB Compass hoặc mongosh: `foods`, `orders`, `tablesessions`.
4. **2:10–2:50:** Khách thêm món: Redis có giỏ, TTL; mở Sorted Set leaderboard.
5. **2:50–3:40:** Gọi món: MongoDB có đơn mới, Redis cập nhật; với đơn khách đã xác thực, Neo4j ghi `ORDERED`.
6. **3:40–4:30:** Neo4j Browser hiển thị `BELONGS_TO`, `ORDERED`, `REVIEWED` nếu đã có đánh giá.
7. **4:30–5:00:** Kết luận: MongoDB là dữ liệu chính; Redis nhanh có TTL; Neo4j xử lý quan hệ.

**Minh chứng phải là ảnh/số liệu do nhóm thực sự đo/chụp.** Không ghi vào báo cáo những con số performance chưa chạy.

## 8. Giới hạn và lưu ý an toàn

- GitHub Actions dùng Docker database tạm riêng; dữ liệu trên máy người dùng có thể khác.
- Không công bố file `.env` chứa JWT secret hoặc mật khẩu đã thay đổi.
- Không chạy `FLUSHDB`, `DETACH DELETE`, `db.dropDatabase()`, `docker compose down -v` hoặc `npm run seed` trên DB cần giữ.
- Nếu có dùng script tạo demo Neo4j/MongoDB, script có nhãn rõ và chỉ tạo ví dụ riêng; đọc kỹ trước khi chạy.
