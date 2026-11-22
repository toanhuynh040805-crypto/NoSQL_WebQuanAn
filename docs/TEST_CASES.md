# Kế hoạch kiểm thử và bảng test case đồ án NoSQL
**Học phần:** Dữ liệu NoSQL · **Đề tài:** Website đặt món/quản lý quán ăn  
**Cách ghi nhận:** `A` = có kiểm thử tự động trong repo, `M` = kiểm thử thủ công cần chụp minh chứng; **không đánh dấu PASS cho test chưa chạy**.

## 1. Môi trường và dữ liệu

- Node.js 20+ (CI: Node.js 22); Docker Compose MongoDB 7, Redis 7, Neo4j 5; React/Vite và Express.
- CSDL demo khởi tạo bởi `npm run seed` **chỉ trên DB tạm của CI hoặc DB riêng có thể xóa**. Không chạy lệnh reset trên DB cá nhân đang có dữ liệu cần giữ.
- Cài đặt `npm run install:all`; kiểm tra API `/api/health`; khởi động `npm run dev:backend` và `npm run dev:frontend`.
- Lưu kết quả mỗi test: thời gian, người test, dữ liệu vào, HTTP/ảnh đầu ra, trạng thái PASS/FAIL/BLOCKED. CI build xanh chỉ chứng minh những bài test đã khai báo chạy thành công.

## 2. Bảng kiểm thử chức năng

| ID | Module | Bước kiểm tra / đầu vào | Kết quả mong đợi | Cách xác nhận |
|---|---|---|---|---|
| TC01 | Kết nối | GET `/api/health` | 200 JSON `status=ok` | A |
| TC02 | Auth | Login email hợp lệ | Token + user role đúng | A |
| TC03 | Auth | Login mật khẩu sai | 401, không cấp token | M |
| TC04 | Phân quyền | Khách gọi `GET /api/staff/tables` | 403 | A |
| TC05 | Phân quyền | Staff gọi `GET /api/nosql/overview` | 403 | A |
| TC06 | Thực đơn | `GET /api/foods?limit=50` sau demo seed | Có 37 món nguồn KLCN, đúng ảnh mẫu | A + M |
| TC07 | Thực đơn | Lọc category + search | Trả đúng category/từ khóa, có phân trang | M |
| TC08 | Khôi phục | `npm run restore:menu` | Không mất users/orders/receipts, bổ sung món thiếu | A một phần, M dữ liệu |
| TC09 | Giỏ Redis | Khách thêm 1 món / chỉnh tăng số lượng | Giỏ lưu Redis hash, có TTL | M |
| TC10 | Giỏ Redis | Đăng nhập khi đã có giỏ guest | Merge đúng số lượng giỏ account | M |
| TC11 | Đơn Web | Đặt món từ giỏ Redis | MongoDB tạo đơn snapshot giá, xóa giỏ | A qua luồng smoke |
| TC12 | Đơn Web | Gọi lại khi giỏ rỗng | 400, không tạo đơn | M |
| TC13 | Bàn | Staff nhận bàn trống | Tạo TableSession, bàn occupied | A |
| TC14 | Bàn | Nhân viên thứ hai nhận cùng bàn | 409, không có 2 active sessions | A |
| TC15 | Bàn | Admin đổi thủ công trạng thái bàn có phiên | 409, vẫn occupied | A |
| TC16 | Khóa Redis | Staff nhận khóa 300 giây | Có owner và TTL | A |
| TC17 | Khóa Redis | Người khác gọi món bàn đang khóa | 423, không tạo đơn | M (2 tài khoản staff) |
| TC18 | Gọi món | Staff gửi món `clientRequestId` | Tạo 1 đơn, bếp nhận | A |
| TC19 | Gọi món | Gửi lại cùng `clientRequestId` | Không tạo đơn trùng | A |
| TC20 | Chỉnh món | Chỉnh số lượng khi `confirmed` | Cập nhật tổng tiền | A |
| TC21 | Chỉnh món | Chỉnh sau khi bếp `preparing` | 409 | A |
| TC22 | Bếp | `confirmed→preparing→ready` | Cập nhật trạng thái đúng | A |
| TC23 | Phục vụ | `ready→completed` | Nhân viên xác nhận phục vụ | A |
| TC24 | Thanh toán | Thu tiền mặt đủ tiền | Tạo Receipt, tính tiền thối | A |
| TC25 | Thanh toán | Thu tiền mặt thiếu tiền | Không ghi đã trả tiền | M |
| TC26 | Thanh toán | QR BIDV đúng account/amount/reference | Thông tin trùng tạm tính | A |
| TC27 | Thanh toán | Khách tự gọi API `confirm` | 403 | A |
| TC28 | Thanh toán | Chuyển khoản không xác nhận đã nhận | API từ chối | A |
| TC29 | Thanh toán | Thu ngân ghi chuyển khoản đã xác minh | Lưu phiếu thu, đơn paid | A |
| TC30 | Thanh toán | Gửi lại yêu cầu thanh toán | Trả biên nhận cũ, không thu trùng | A |
| TC31 | Bàn | Thu ngân đóng phiên khi staff đang khóa | 423 | A |
| TC32 | Bàn | Đóng phiên sau phục vụ và thanh toán | Closed, bàn về trạng thái hợp lệ | A |
| TC33 | Bàn | Chuyển phiên sang bàn trống đủ chỗ | Chuyển cả lịch sử Order, giữ số khách | A |
| TC34 | Đặt bàn | Lịch tương lai không khóa bàn hôm nay | Bàn còn available | A |
| TC35 | Đặt bàn | Xác nhận lịch trùng cùng bàn/khung | 409 | A |
| TC36 | MongoDB | Count collection, CRUD demo và aggregate | Có tối thiểu 2 collection, thao tác đúng | M + script |
| TC37 | Redis | Xem HASH/STRING/ZSET, TTL | Tối thiểu 2 kiểu key, TTL hợp lệ | M + script |
| TC38 | Neo4j | Đếm 3 node labels và 3 edge types | Customer/Food/Category và 3 edge types | A sau seed bổ sung + M |
| TC39 | Neo4j | Dữ liệu ORDERED sau đặt món khách | Graph có quan hệ theo Order | M |
| TC40 | Neo4j | Chạy truy vấn gợi ý cộng tác | Trả món khi dữ liệu phù hợp; fallback khi không | M |
| TC41 | Admin | Xem tab CSDL NoSQL | Tổng số document/key/node thật, không lộ dữ liệu nhạy cảm | A + M |
| TC42 | Hiệu năng | 30 lần GET `/api/categories` | Có số đo min/avg/p95, không tự giả định nhanh | M + benchmark |
| TC43 | Hệ thống | MongoDB/Redis/Neo4j bị tắt | Có cảnh báo/chẩn đoán được lỗi kết nối | M |
| TC44 | Giao diện | Desktop và mobile thử đặt món, sơ đồ bàn | Không che chữ, không tràn viewport | M |
| TC45 | An toàn | Đổi giá frontend gửi giả | Backend vẫn đọc giá MongoDB | M |

**A không có nghĩa PASS ở mọi máy.** Cần đối chiếu log workflow của commit mới, ảnh chạy ứng dụng và report thực tế tại thời điểm nộp.

## 3. Lệnh chạy test

```powershell
npm run install:all
npm run test:course
node --test scripts/menu-catalog.test.mjs scripts/payment-bank.test.mjs scripts/role-home.test.mjs
npm run verify:databases
```

Test tích hợp end-to-end chạy ở GitHub Actions `.github/workflows/build.yml` trên Docker test database riêng. Nếu tự chạy `node scripts/smoke-test.mjs`, cần API và bộ dữ liệu demo chính xác (script tạo đơn, ghi thanh toán thử; không chạy trong dữ liệu cần giữ).

## 4. Mẫu biên bản kiểm thử

| ID | Ngày | Người test | Dữ liệu đầu vào | Kết quả thực tế/ảnh | PASS/FAIL/BLOCKED |
|---|---|---|---|---|---|
| TC01 | [điền] | [điền] | GET /api/health | [mã HTTP/screenshot] | [điền] |
| TC36 | [điền] | [điền] | mongosh / MongoDB Compass | [ảnh count/CRUD] | [điền] |
| TC37 | [điền] | [điền] | redis-cli / TTL | [ảnh] | [điền] |
| TC38 | [điền] | [điền] | Neo4j Browser | [ảnh graph] | [điền] |

## 5. Mục đích kiểm thử sau khi bổ sung

- Chứng minh từng hệ CSDL có dữ liệu thực sự chứ không chỉ liệt kê trong bài báo cáo.
- Chứng minh REST API phân quyền và trạng thái đơn/bàn/thanh toán có ràng buộc.
- Minh bạch chức năng đã tự động kiểm thử và chức năng còn chờ kiểm thử thủ công, đúng tính chất đồ án môn học.
