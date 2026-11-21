# Hướng dẫn đóng gói và nộp đồ án NoSQL

## 1. Danh sách file cần có

| Mục yêu cầu | File/directory |
|---|---|
| Source code | `frontend/`, `backend/`, `docker-compose.yml`, `.env.example`, `README.md` |
| SRS | `docs/SRS.md` |
| SDS | `docs/SDS.md` |
| Database Model | `docs/DATABASE_MODEL.md` |
| Use Case / DFD / Activity / Sequence | `docs/DIAGRAMS.md` (Mermaid) |
| MongoDB JSON, CRUD, tìm kiếm | `database/mongodb/` |
| Redis cache, Hash, Sorted Set, TTL | `database/redis/` |
| Neo4j node/edge/Cypher | `database/neo4j/` |
| Test Case, test tự động | `docs/TEST_CASES.md`, `scripts/`, `.github/workflows/` |
| Báo cáo kết quả | `docs/FINAL_REPORT.md` |
| Minh chứng | Danh sách tại `docs/EVIDENCE_CHECKLIST.md`; nhóm phải tự chụp |
| Báo cáo hoạt động nhóm | `docs/GROUP_ACTIVITY.md` |
| Cách mở 3 DB | `docs/NO_SQL_RUNBOOK.md` |
| Đối chiếu giảng viên | `docs/REQUIREMENTS_CHECKLIST.md` |

## 2. Quy trình trước khi nộp

1. Cập nhật code từ nhánh được nhóm thống nhất, kiểm tra không có file `.env` chứa bí mật trong Git.
2. Chạy `npm run install:all`, `npm run test:course`, `npm run build`; kiểm tra GitHub Actions ở commit cuối.
3. Khởi động Docker, chạy backend/frontend, kiểm tra `npm run verify:databases`.
4. Chạy demo người dùng/nhân viên/bếp/thu ngân; dùng đúng dữ liệu demo riêng.
5. Chụp ảnh cơ sở dữ liệu, lưu kết quả thật theo checklist; xuất sơ đồ Mermaid thành ảnh để đưa vào tài liệu trình bày.
6. Điền đầy đủ giảng viên, thành viên, phân công, lịch họp, thời điểm nộp SRS/DB Model.
7. Xuất SRS, SDS, Database Model, báo cáo ra định dạng DOCX/PDF nếu giảng viên yêu cầu, kiểm tra trang và chất lượng hình trước nộp.
8. Đóng gói source và scripts, bỏ `node_modules`, `dist`, `.env`, dữ liệu tài khoản nhạy cảm, container volume. **Không cần đưa volume Docker vào Git**.
9. Kiểm tra chính xác các mục bắt buộc của `HD_DoAn_NoSQL(1).docx` và xác nhận với giảng viên nếu có yêu cầu định dạng khác.

## 3. Phân biệt các thao tác dữ liệu

- `npm run verify:databases`: **chỉ đọc** số liệu ba DB.
- `npm run restore:menu`: **bổ sung** catalog món thiếu, không xóa orders/users/receipts.
- `npm run seed`: **xóa và tạo mới dữ liệu demo** MongoDB, Redis, Neo4j — **không chạy khi cần giữ dữ liệu**.
- `docker compose down -v`: xóa Docker volumes — **không dùng khi cần giữ dữ liệu**.

## 4. Mục không thể tự hoàn thành từ source code

Tên giảng viên, thành viên thực tế, số liệu đo thời gian truy vấn, hình chụp máy demo, ngày nộp theo tuần và báo cáo hoạt động nhóm có xác nhận phải do nhóm cung cấp. Không trình bày giá trị minh họa như thể đã thu thập được.
