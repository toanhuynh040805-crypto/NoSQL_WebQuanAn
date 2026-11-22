# Kết quả kiểm thử CI đã xác minh

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
