# BÁO CÁO KẾT QUẢ THỰC HIỆN ĐỒ ÁN CUỐI KỲ
**Học phần:** Dữ liệu NoSQL  
**Đề tài:** WEBSITE QUẢN LÝ ĐẶT MÓN TẠI QUÁN ĂN SỬ DỤNG MONGODB, REDIS VÀ NEO4J  
**Đơn vị:** Trường Đại học Công Thương TP.HCM · Khoa Công nghệ Thông tin  
**Năm học:** 2026–2027  
**Nhóm:** [điền nhóm], **Giảng viên:** [điền], **Danh sách thành viên:** [điền đúng theo thực tế]

> Đây là **nội dung báo cáo kỹ thuật dựa trên repo** và yêu cầu giảng viên, chưa phải bản trình bày cuối đã có ảnh minh chứng/số liệu đo của nhóm. Các mục [CẦN BỔ SUNG] là dữ liệu thực tế không được tự tạo.

## TÓM TẮT

Đề tài xây dựng ứng dụng web hỗ trợ khách hàng xem món, giỏ hàng, đặt món, theo dõi đơn và nhận gợi ý, đồng thời hỗ trợ quán vận hành sơ đồ bàn, nhận khách, phục vụ, chế biến, thanh toán, quản trị thực đơn và thống kê. Hệ thống dùng React + Vite ở giao diện, Node.js/Express REST API ở server và ba CSDL NoSQL có vai trò khác biệt: **MongoDB** lưu dữ liệu nghiệp vụ bền vững; **Redis** lưu giỏ hàng/cache/lock/bảng xếp hạng; **Neo4j** lưu đồ thị quan hệ khách–món–danh mục để gợi ý. Không dùng CSDL quan hệ làm dữ liệu chính.

## CHƯƠNG 1. GIỚI THIỆU ĐỀ TÀI

### 1.1 Lý do chọn
Quản lý đặt món tạo dữ liệu giao dịch và danh mục cần lưu bền, giỏ tạm cần TTL, số liệu bán chạy cần thứ hạng, hành vi gọi/đánh giá món tạo các quan hệ nhiều bước. Không phải mọi loại truy vấn đều nên diễn giải như một bảng quan hệ. Ứng dụng giúp phân biệt mục đích các mô hình NoSQL.

### 1.2 Mục tiêu và phạm vi
- Khách: xem và tìm món, giỏ, đặt món, đánh giá, lịch sử, gợi ý.
- Nhân viên: nhận bàn, khóa quyền, order theo phiên, bếp, phục vụ, thu ngân.
- Quản lý: danh mục/món, kho, tài khoản, khuyến mãi, doanh thu và tab trực quan dữ liệu ba DB.
- Sử dụng MongoDB document, Redis key-value và Neo4j graph trong một backend.
- Giới hạn: thanh toán qua QR BIDV mới là hướng dẫn chuyển tiền, thu ngân đối soát thủ công; chưa tích hợp API ngân hàng, tách/gộp bàn, ca làm/GPS, realtime push.

### 1.3 Phương pháp
Khảo sát luồng nghiệp vụ; xây dựng SRS/Use Case/DFD; thiết kế MongoDB embedded document/Redis TTL/Neo4j edge; lập trình API và UI; khởi tạo dữ liệu demo; test phân quyền/giao dịch; so sánh kết quả ba DB trong môi trường Docker.

## CHƯƠNG 2. CƠ SỞ LÝ THUYẾT VÀ CÔNG NGHỆ

### 2.1 MongoDB – Document
MongoDB lưu collection BSON với cấu trúc linh hoạt. `Order.items` nhúng danh sách món với snapshot tên, giá, số lượng giúp duy trì lịch sử đúng ngay cả khi giá món thay đổi. Các quan hệ giữa Order–User, Food–Category, TableSession–Order dùng ObjectId reference. Mongoose schema áp dụng validation/index.

### 2.2 Redis – Key-value
Redis được dùng vì truy cập nhanh, hỗ trợ hash/strings/sorted set và TTL. Giỏ hàng `cart:*` có hạn 24 giờ; menu category cache 300 giây; token logout có TTL; khóa thao tác bàn 5 phút; `leaderboard:foods` lưu điểm bán chạy. Redis không phải sổ ghi giao dịch thu tiền chính thức.

### 2.3 Neo4j – Graph
Neo4j dùng node `Customer`, `Food`, `Category`; quan hệ `ORDERED`, `REVIEWED`, `BELONGS_TO`. Truy vấn Cypher có thể suy ra món từ khách tương tự. Backend ánh xạ food ID từ graph sang MongoDB để trả dữ liệu món đầy đủ. Quan hệ `ORDERED_WITH`/`LIKES` của thiết kế sơ bộ chưa được triển khai thực tế.

### 2.4 Hệ công nghệ
- Frontend React + Vite; backend Node.js + Express + JWT/bcrypt.
- Mongoose, node-redis, neo4j-driver là ba connector trong `backend/src/config/database.js`.
- Docker Compose chứa MongoDB 7, Redis 7-alpine, Neo4j 5-community; frontend 5173, API 5000.

## CHƯƠNG 3. PHÂN TÍCH VÀ THIẾT KẾ

### 3.1 Tác nhân và chức năng
Các vai trò đã code: Customer, Staff, Kitchen, Cashier, Admin. Xem bảng FR01–FR34 và điều kiện trước/sau, ngoại lệ ở [SRS.md](SRS.md).

### 3.2 Sơ đồ hệ thống
Use Case tổng quát và theo vai trò, DFD cấp 0/1, Activity, Sequence trình bày ở [DIAGRAMS.md](DIAGRAMS.md).

### 3.3 Kiến trúc và database model
Kiến trúc 3 tầng React → REST API → MongoDB/Redis/Neo4j. Phần thiết kế 12 collections MongoDB, khóa Redis, node/edge Neo4j, unique index và ERD logic: [DATABASE_MODEL.md](DATABASE_MODEL.md), [SDS.md](SDS.md).

### 3.4 Bốn nhóm dữ liệu
(1) Hồ sơ/danh mục/review document; (2) đơn/phiếu thu/lịch sử thời gian; (3) key-value/cache/TTL/leaderboard; (4) quan hệ đồ thị gợi ý. Nêu rõ sự khác nhau giữa **loại dữ liệu** và **số lượng hệ quản trị**, trình bày cùng minh chứng.

## CHƯƠNG 4. TRIỂN KHAI VÀ KẾT QUẢ

### 4.1 Các module đã triển khai
Ứng dụng có khách hàng, thực đơn 37 món/7 nhóm KLCN minh họa, giỏ Redis, đặt món, sơ đồ bàn, bếp, thu ngân thanh toán tiền mặt/chuyển khoản có xác minh thủ công, quản lý kho, khuyến mãi và báo cáo. Tính năng mở rộng còn thiếu xem [KLCN_FEATURE_PARITY.md](KLCN_FEATURE_PARITY.md).

### 4.2 Dữ liệu thực tế cần minh chứng
| Chứng cứ | Cách kiểm tra | Kết quả |
|---|---|---|
| MongoDB collections và tổng document | Compass hoặc `npm run verify:databases` | [CẦN CHỤP] |
| Redis giỏ/cache/TTL/leaderboard | Redis CLI | [CẦN CHỤP] |
| Neo4j node và quan hệ | Neo4j Browser | [CẦN CHỤP] |
| UI quản lý tab “CSDL NoSQL” | `/operations?tab=nosql` | [CẦN CHỤP] |
| Luồng phục vụ → bếp → thu ngân | Nhiều tài khoản browser | [CẦN CHỤP] |
| Kết quả GitHub Actions | Link workflow theo commit nộp | [CẦN GẮN] |

### 4.3 Kết quả truy vấn và hiệu năng
- Chạy `node scripts/benchmark-nosql.mjs` khi API hoạt động và ghi min/avg/p95, phiên bản máy, dữ liệu đầu vào. **Không có con số hiệu năng đo thật sẵn trong tài liệu này**.
- Đánh giá cache với trạng thái cold (key `menu:categories` chưa tồn tại) so với warm (cache đã có), kèm ảnh/console. Không xóa cache của môi trường thật chỉ để đo nếu đang có người dùng.
- Trình bày graph node/edge thực, số quan hệ theo truy vấn và 1 ví dụ gợi ý. Không khẳng định gợi ý cá nhân hóa thành công với tài khoản chưa có hành vi.

### 4.4 Kiểm thử
Đã có CI kiểm tra cú pháp, build frontend, unit test cấu hình VietQR/catalog/role và kịch bản integration chạy MongoDB/Redis/Neo4j demo. Bảng kiểm thử chi tiết gồm các trường hợp tự động và chưa đo thủ công ở [TEST_CASES.md](TEST_CASES.md). **Cần cập nhật log PASS theo commit cuối và ảnh đầu ra tại máy báo cáo**.

## CHƯƠNG 5. ĐÁNH GIÁ VÀ HƯỚNG PHÁT TRIỂN

### 5.1 Kết quả đạt được
- Tách rõ vai trò ba công nghệ NoSQL trong một ứng dụng thực tế.
- MongoDB giữ dữ liệu chính, Redis tối ưu key tạm có TTL, Neo4j minh họa quan hệ khách–món–danh mục.
- Có nhiều vai trò và quy trình quán: gọi món nhiều lượt, bếp xử lý, thu ngân tạo phiếu thu.
- Có môi trường Docker và kiểm thử tích hợp, script truy vấn/dữ liệu mẫu để trình bày.

### 5.2 Hạn chế
- Neo4j chưa hỗ trợ toàn bộ đồ thị mở rộng như LIKES và ORDERED_WITH.
- Đồng bộ ba DB chưa có hàng đợi retry/outbox; khi một hệ mất kết nối, một số luồng cần xử lý phục hồi thủ công.
- Giao diện bếp dùng polling; phân ca và ca làm/GPS chưa triển khai; chưa hợp nhất QR khách với TableSession.
- VietQR chỉ tạo lệnh chuyển khoản, đối soát thủ công; chưa có webhook ngân hàng hay hệ thống hoàn tiền.
- Chưa có kiểm thử tải, sao lưu định kỳ và đo hiệu năng được chấp nhận để dùng sản xuất.

### 5.3 Hướng phát triển
Hoàn thiện event outbox và retry, WebSocket/SSE, hợp nhất QR theo phiên, tách/gộp bàn, ca làm/địa điểm, hóa đơn in/PDF, đặt cọc/điểm, API đối soát ngân hàng qua nhà cung cấp được phép; bổ sung test tải, backup và phân tích cache/graph performance.

## KẾT LUẬN

Đồ án minh họa được cách tổ chức dữ liệu nghiệp vụ dạng document trong MongoDB, cấu trúc key-value/TTL trong Redis và đồ thị quan hệ trong Neo4j. Điểm mạnh là hệ thống đã liên kết ba nguồn dữ liệu với chức năng đặt món và quản lý bàn. Để báo cáo cuối kỳ khách quan, nhóm phải đính kèm **ảnh minh chứng thực tế, kết quả đo trên máy, nhật ký phân công** và chỉ công nhận đã hoàn thành những chức năng có code/test phù hợp.

## TÀI LIỆU DỰ ÁN
- `HD_DoAn_NoSQL(1).docx` — hướng dẫn yêu cầu đồ án của giảng viên, tài liệu nhóm đã cung cấp.
- `Tai_lieu_phan_tich_thiet_ke_so_bo_Website_dat_mon_NoSQL.docx` — bản thiết kế sơ bộ của nhóm.
- Mã nguồn `NoSQL_WebQuanAn` / `NoSQL_Nhom`, README và các docs liên quan.
- [SRS](SRS.md), [SDS](SDS.md), [Database Model](DATABASE_MODEL.md), [Diagrams](DIAGRAMS.md), [Runbook](NO_SQL_RUNBOOK.md).
