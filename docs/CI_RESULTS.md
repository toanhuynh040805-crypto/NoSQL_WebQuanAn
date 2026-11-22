# Kết quả kiểm thử CI đã xác minh

## Cập nhật khách hàng và chuyển khoản — 22/11/2026

- Nhánh: `main`, commit mã nguồn: `a9514e0a02058c74c89d7f301f1ce0b4e055d597`.
- Run đã kiểm tra: https://github.com/toanhuynh040805-crypto/NoSQL_WebQuanAn/actions/runs/45036674540
- `verify`: **success**. Kiểm tra cú pháp backend, 16 bài kiểm tra tài liệu/catalog/vai trò/ngân hàng/workflow/ngày báo cáo/QR và build frontend.
- `integration`: **success**. Dựng MongoDB, Redis, Neo4j thật trong Docker dùng một lần; seed và kiểm tra dữ liệu; hai bộ kiểm thử HTTP đều đạt.
- Bộ kiểm thử mới đã chạy: tạo/sửa/khóa/mở khách hàng, phân quyền và ẩn ghi chú, tìm kiếm literal, gắn khách vào phiên bàn, lịch sử/chi tiêu, báo chuyển khoản vẫn pending, thu ngân tiếp nhận bàn, chống dùng mã ngân hàng cho hai hóa đơn, phát lại thanh toán và checkout, cộng điểm đúng một lần và tăng doanh thu đúng số tiền.
- Kiểm tra QR bổ sung tại máy thực hiện: tạo ma trận QR từ payload VietQR và giải mã lại bằng OpenCV; nội dung đọc được trùng payload đầu vào.

Kết quả xác nhận kỹ thuật trên dữ liệu kiểm thử, không phải giao dịch ngân hàng thật. Hướng dẫn demo: [DEMO_GIANG_VIEN.md](DEMO_GIANG_VIEN.md).

## 1. Lần chạy đã hoàn tất thành công

- **Repository:** `toanhuynh040805-crypto/NoSQL_WebQuanAn`
- **Branch:** `feat/nosql-course-completion`
- **Commit được kiểm tra:** `25a50d24135da7564348e738ba86e0215a242be2`
- **GitHub Actions run:** https://github.com/toanhuynh040805-crypto/NoSQL_WebQuanAn/actions/runs/44875488402
- **Kết luận từ GitHub Actions:** `success` cho cả hai job `verify` và `integration`.

### Job `verify` — PASSED

| Bước | Kết quả |
|---|---|
| Kiểm tra entry-point backend | PASS |
| Kiểm tra cú pháp các file JS backend | PASS |
| Kiểm tra VietQR BIDV và checksum CRC | PASS |
| Kiểm tra mapping trang theo vai trò | PASS |
| Kiểm tra file hồ sơ đồ án/nguồn mẫu JSON/script | PASS |
| Build React frontend | PASS |

### Job `integration` — PASSED

| Bước | Kết quả |
|---|---|
| Tạo dữ liệu demo trên 3 database Docker tạm | PASS |
| Lệnh khôi phục catalog món KLCN không reset | PASS |
| Script đọc MongoDB/Redis/Neo4j khi đã có dữ liệu | PASS |
| Smoke test phục vụ–bếp–thu ngân–đặt bàn, quyền xem CSDL và 3 quan hệ Neo4j | PASS |

## 2. Giới hạn của kết quả

Kết quả CI chạy bằng Docker/Node trên GitHub Actions, **không đồng nghĩa** website trên máy khác đã được kiểm tra tất cả trường hợp. Những test case đánh dấu M trong `TEST_CASES.md` vẫn cần nhóm tự thao tác và chụp kết quả. Chưa có số liệu benchmark truy vấn/cache từ máy thuyết trình trong repo.

**Nếu tiếp tục commit thay đổi**, dùng run tương ứng commit cuối để cập nhật bảng này. Không ghi PASS cho commit chưa kiểm tra.

## 3. Minh chứng vẫn cần bổ sung trước khi nộp

- Ảnh Docker ba container, MongoDB Compass collection, Redis TTL và Sorted Set, Neo4j graph ba quan hệ.
- Số liệu benchmark thật của máy nhóm và thời điểm đo.
- Thành viên, nhật ký làm việc và ngày nộp theo yêu cầu giảng viên.
