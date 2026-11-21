# Redis — Key-value, Hash, Sorted Set và TTL

**Cổng:** `6379`. **Code thực tế:** `backend/src/services/cart.js`, `cache.js`, `routes/auth.js`, `routes/staff.js`.

## Kiểm tra an toàn

```powershell
docker exec restaurant-redis redis-cli PING
docker exec restaurant-redis redis-cli TTL menu:categories
docker exec restaurant-redis redis-cli ZREVRANGE leaderboard:foods 0 9 WITHSCORES
docker exec restaurant-redis redis-cli --scan --pattern "cart:*"
```

Script đọc lệnh:
```powershell
Get-Content -Raw .\database\redis\01_inspect.rediscli | docker exec -i restaurant-redis redis-cli
```

Script minh họa dữ liệu **riêng** `nosql:demo:*` có thời hạn 120 giây; không sửa giỏ/leaderboard của ứng dụng:
```powershell
Get-Content -Raw .\database\redis\02_demo.rediscli | docker exec -i restaurant-redis redis-cli
```

## Vai trò của dữ liệu

- Hash giỏ hàng `cart:user:<id>`, `cart:guest:<id>`: TTL 24 giờ.
- String JSON `menu:categories`: cache TTL 300 giây.
- Sorted Set `leaderboard:foods`: bảng xếp hạng thật.
- String `table:lock:<sessionId>`: khóa thao tác TTL 300 giây.
- String `payment:confirm:<scope>:<id>`: khóa thanh toán TTL 30 giây.
- String `token:block:<jti>`: TTL tới khi JWT hết hạn.

Dùng `SCAN` thay cho `KEYS *` khi xem danh sách khóa. Không dùng `FLUSHDB`, `DEL cart:*` hay lệnh xóa toàn DB.
