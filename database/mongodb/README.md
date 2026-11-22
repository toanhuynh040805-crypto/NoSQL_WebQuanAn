# MongoDB — document database

**Cơ sở dữ liệu:** `restaurant_nosql` · **cổng:** `27017` · **Mongoose:** `backend/src/models`

## Chạy script trên PowerShell

```powershell
Get-Content -Raw .\database\mongodb\01_inspect.js | docker exec -i restaurant-mongodb mongosh restaurant_nosql --quiet
```

`01_inspect.js` chỉ đọc và đếm số document. `02_crud_demo.js` là script CRUD **tùy chọn**, chỉ thao tác collection riêng `nosql_course_examples`, dọn bản ghi thử sau khi hoàn tất:

```powershell
Get-Content -Raw .\database\mongodb\02_crud_demo.js | docker exec -i restaurant-mongodb mongosh restaurant_nosql --quiet
```

`sample_data.json` thể hiện mẫu cấu trúc JSON cho Category, Food, Order (nhúng items), Review; không chứa hash mật khẩu hay thông tin khách thật. Dữ liệu demo thực tế của ứng dụng được tạo bởi `backend/src/data/seed.js` **chỉ khi DB demo có thể reset**. Không chạy seed để chỉ kiểm tra MongoDB.
