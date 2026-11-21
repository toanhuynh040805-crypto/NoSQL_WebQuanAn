# Sơ đồ hệ thống — Use Case, DFD, Activity, Sequence, ERD
Các sơ đồ Mermaid dưới đây phản ánh hệ thống ba NoSQL **đang có trong mã nguồn**. Bản phân tích sơ bộ cũ chỉ có Khách và Quản trị; bản này cập nhật thêm Phục vụ/Bếp/Thu ngân.

## 1. Use Case tổng quát (dạng sơ đồ tác nhân–chức năng)

```mermaid
flowchart LR
  KH["👤 Khách hàng"] --> A["Xem/Tìm kiếm món"]
  KH --> B["Giỏ hàng và đặt món"]
  KH --> C["Đặt bàn, lịch sử, đánh giá"]
  KH --> D["Gợi ý món"]
  PV["👤 Phục vụ"] --> E["Sơ đồ bàn, nhận bàn"]
  PV --> F["Gọi thêm, chỉnh món trước bếp"]
  BEP["👤 Bếp"] --> G["Chế biến, báo sẵn sàng"]
  TN["👤 Thu ngân"] --> H["Tạm tính, tiền mặt/VietQR"]
  QL["👤 Quản lý"] --> I["Quản lý dữ liệu và báo cáo"]
  QL --> J["Kiểm tra ba CSDL NoSQL"]
  B --> K["Theo dõi trạng thái"]
  F --> G
  G --> H
```

## 2. Use Case hệ thống Khách hàng

```mermaid
flowchart TD
  KH["Khách"] --> Login["Đăng ký / đăng nhập"]
  KH --> Menu["Xem món / tìm kiếm / lọc"]
  Menu --> Cart["Giỏ Redis"]
  Cart --> Order["Đặt món MongoDB"]
  Order --> Track["Theo dõi / lịch sử"]
  Track --> Review["Đánh giá món hoàn thành"]
  KH --> Booking["Đặt bàn / hủy lịch"]
  KH --> Recommend["Nhận gợi ý Neo4j"]
```

## 3. Use Case hệ thống Nhân viên và thu ngân

```mermaid
flowchart LR
  Waiter["Phục vụ"] --> Floor["Chọn bàn / nhận bàn"]
  Floor --> Lock["Giữ khóa Redis 5 phút"]
  Lock --> Call["Gọi món / gọi thêm"]
  Call --> Prepare["Bếp nhận và chế biến"]
  Kitchen["Bếp"] --> Prepare
  Prepare --> Served["Phục vụ mang món"]
  Waiter --> Served
  Served --> Bill["Thu ngân tạm tính"]
  Cashier["Thu ngân"] --> Bill
  Bill --> Paid["Tiền mặt / VietQR đối chiếu thủ công"]
  Paid --> Close["Đóng phiên và trả bàn"]
```

## 4. Use Case hệ thống Quản trị viên

```mermaid
flowchart LR
  Admin["Quản trị viên"] --> MenuCRUD["Quản lý danh mục / món"]
  Admin --> Account["Tài khoản và phân quyền"]
  Admin --> Inventory["Kho nguyên liệu"]
  Admin --> Promo["Khuyến mãi"]
  Admin --> Reports["Báo cáo đơn / doanh thu"]
  Admin --> DBView["Bảng MongoDB / Redis / Neo4j"]
  DBView --> Mongo["Đếm documents"]
  DBView --> Redis["Đếm keys / TTL"]
  DBView --> Neo4j["Đếm nodes / edges"]
```

## 5. DFD cấp 0 — Sơ đồ ngữ cảnh

```mermaid
flowchart LR
  KH["Khách hàng"] -->|"Tài khoản, giỏ, đặt món, đặt bàn"| System["P0 · Website quản lý quán ăn"]
  PV["Phục vụ"] -->|"Nhận bàn, gọi món"| System
  BEP["Bếp"] -->|"Tình trạng chế biến"| System
  TN["Thu ngân"] -->|"Xác nhận thu tiền"| System
  QL["Quản lý"] -->|"CRUD, yêu cầu báo cáo"| System
  System -->|"Thực đơn, trạng thái, gợi ý"| KH
  System -->|"Sơ đồ bàn"| PV
  System -->|"Danh sách món"| BEP
  System -->|"Hóa đơn"| TN
  System -->|"Báo cáo, số liệu CSDL"| QL
```

## 6. DFD cấp 1 — Phân rã 8 tiến trình gốc, bổ sung nghiệp vụ bàn/thu tiền

```mermaid
flowchart LR
  A["P1 Quản lý tài khoản"] --> M[("D1 MongoDB: users")]
  B["P2 Quản lý thực đơn"] <--> C[("D2 MongoDB: categories/foods")]
  B <--> R[("D6 Redis: cache")]
  D["P3 Giỏ hàng"] <--> R
  E["P4 Xử lý đặt món"] --> O[("D3 MongoDB: orders")]
  E --> R
  F["P5 Quản lý đơn/bàn"] <--> O
  F <--> T[("D4 MongoDB: tables/sessions/reservations")]
  G["P6 Đánh giá"] --> V[("D5 MongoDB: reviews")]
  H["P7 Thống kê"] <--> O
  H <--> R
  I["P8 Gợi ý món"] <--> N[("D7 Neo4j: graph")]
  E --> N
  G --> N
  J["P9 Thu tiền"] --> P[("D8 MongoDB: paymentreceipts")]
  J --> O
  J --> R
```

**Lưu ý:** Đây là DFD logic đã mở rộng từ tám tiến trình trong tài liệu sơ bộ lên thêm P9 thu tiền; không phải biểu đồ mô tả chi tiết từng lời gọi API.

## 7. Activity — Từ nhận bàn đến thanh toán

```mermaid
flowchart TD
  Start([Bắt đầu]) --> Choose[Chọn khu và bàn]
  Choose --> Available{Bàn có thể nhận?}
  Available -->|Không| Error[Thông báo bàn bận/đặt lịch]
  Error --> Choose
  Available -->|Có| Open[Tạo TableSession, khóa Redis]
  Open --> Select[Phục vụ chọn món]
  Select --> Send[Đơn confirmed tại MongoDB]
  Send --> Kitchen[Bếp preparing rồi ready]
  Kitchen --> Served[Phục vụ completed]
  Served --> Extra{Gọi thêm món?}
  Extra -->|Có| Select
  Extra -->|Không| Release[Trả quyền khóa bàn]
  Release --> Pay[Thu ngân kiểm tra và xác nhận]
  Pay --> Verify{Đủ tiền và đúng hóa đơn?}
  Verify -->|Không| Pay
  Verify -->|Có| Receipt[MongoDB tạo PaymentReceipt]
  Receipt --> Close[Đóng phiên / cập nhật trạng thái bàn]
  Close --> End([Kết thúc])
```

## 8. Sequence — Gợi ý cá nhân hóa

```mermaid
sequenceDiagram
  actor KH as Khách
  participant FE as React
  participant BE as API
  participant N as Neo4j
  participant R as Redis
  participant M as MongoDB
  KH->>FE: Xem Gợi ý hôm nay
  FE->>BE: GET /api/recommendations
  opt Có tài khoản
    BE->>N: Cypher cộng tác ORDERED/REVIEWED
    N-->>BE: Food ids theo score
  end
  alt Không có kết quả graph
    BE->>R: ZREVRANGE leaderboard:foods
    R-->>BE: Food ids phổ biến
  end
  BE->>M: Food.find(ids và isAvailable)
  M-->>BE: Tên, giá, ảnh, danh mục
  BE-->>FE: Danh sách món gợi ý
```

## 9. ERD logic và graph

Xem [DATABASE_MODEL.md](DATABASE_MODEL.md) để có sơ đồ ERD logic, node, edge và các index cụ thể. Có thể xuất hình từ Mermaid khi đưa vào Word/PDF; không dùng sơ đồ này thay thế code hoặc dữ liệu thực.
