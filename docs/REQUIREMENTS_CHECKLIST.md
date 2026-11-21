# Checklist đối chiếu đúng yêu cầu giảng viên — NoSQL
**Nguồn đối chiếu:** `HD_DoAn_NoSQL(1).docx` do nhóm cung cấp (3 trang), được giữ theo nguyên văn nội dung chính. Không tự bổ sung yêu cầu ngoài nguồn thành “bắt buộc”.

| Tiêu chí chính xác từ hướng dẫn | Minh chứng ở repo | Đánh giá theo code |
|---|---|---|
| Nhóm 2–3 sinh viên | [GROUP_ACTIVITY.md](GROUP_ACTIVITY.md) | **Chưa xác thực tên/nhóm thực tế** |
| Tuần 6: Nộp SRS | [SRS.md](SRS.md) | Có tài liệu; **chưa có minh chứng đã nộp đúng tuần** |
| Tuần 7: Nộp Database Model | [DATABASE_MODEL.md](DATABASE_MODEL.md) | Có tài liệu; **chưa có minh chứng đã nộp đúng tuần** |
| Tuần 11: Báo cáo | [FINAL_REPORT.md](FINAL_REPORT.md) | Có nội dung; **chưa xác nhận đã thuyết trình/nộp** |
| Chọn 1 trong 2 hướng | [SDS.md](SDS.md) | **Hướng 2:** sử dụng hoàn toàn NoSQL làm dữ liệu chính |
| Xử lý ít nhất 4 loại dữ liệu khác nhau | [DATABASE_MODEL.md](DATABASE_MODEL.md) §1 | Có 4+ nhóm dữ liệu; cách phân loại cần giảng viên xác nhận |
| Xây dựng SRS và SDS có tính năng bổ sung | [SRS.md](SRS.md), [SDS.md](SDS.md) | Đã tạo tài liệu theo mã nguồn 5 vai trò |
| Source code | `backend/`, `frontend/`, Docker Compose | Có |
| Scripts từng loại database | `database/mongodb`, `database/redis`, `database/neo4j` | Có script đọc & demo an toàn |
| Tài liệu đặc tả, thiết kế | `docs/DIAGRAMS.md`, `docs/DATABASE_MODEL.md` | Có source Mermaid, cần xuất hình theo format nộp |
| Tài liệu kiểm thử | [TEST_CASES.md](TEST_CASES.md), GitHub Actions | Có test case/CI; ảnh thực tế **cần bổ sung** |
| Báo cáo kết quả thực hiện | [FINAL_REPORT.md](FINAL_REPORT.md) | Có dự thảo; số đo và screenshot cần nhóm bổ sung |
| Báo cáo hoạt động nhóm | [GROUP_ACTIVITY.md](GROUP_ACTIVITY.md) | Có bảng mẫu; tên, phân công, xác nhận chưa có |
| MongoDB: ít nhất 2 collection, JSON sample, CRUD, filter/search/sort/statistics | 12 model, `database/mongodb`, `backend/src/routes/catalog.js` | Có |
| Redis: ít nhất 2 nhóm key/value, cache/cart/leaderboard/OTP và TTL | `backend/src/services/cart.js`, `cache.js`, `database/redis` | Có |
| Neo4j: ít nhất 2 loại node, 3 quan hệ và lệnh tạo/truy vấn | `backend/src/services/graph.js`, `database/neo4j`, demo review trong `seed.js` | Có code và dữ liệu demo 3 quan hệ; kiểm tra thật qua `verify:databases` |
| Cassandra: keyspace, log table, partition/clustering key | **Không sử dụng Cassandra** | Mục “yêu cầu tối thiểu Cassandra” chỉ áp dụng nếu dùng Cassandra; hướng 2 hướng dẫn gợi ý Cassandra cho log, **không có chỉ thị rõ phải dùng cả bốn** |

### Lưu ý về cách hiểu đề

- Hướng 1: web có RDBMS, tích hợp NoSQL và ít nhất một CSDL tự tìm hiểu. **Không phải hướng đang làm**.
- Hướng 2: web hoàn toàn NoSQL, không có RDBMS chính. Repo này dùng MongoDB + Redis + Neo4j.
- “Ít nhất bốn loại dữ liệu” được thể hiện qua (1) document, (2) lịch sử giao dịch/sự kiện, (3) key-value TTL/xếp hạng, (4) quan hệ đồ thị. Đây là **phân loại dữ liệu**, không phải khẳng định bốn loại CSDL bắt buộc.
- Không tự cho rằng bài đã đạt trọn vẹn chỉ vì CI build/test xanh. Các mốc nộp, thành viên, ảnh và số đo cần nhóm điền bằng chứng.

## Tình trạng trước khi nộp

- [x] Có source code ứng dụng và ba NoSQL DB.
- [x] Có SRS, SDS, Database Model, sơ đồ và API.
- [x] Có scripts demo/kiểm tra cho MongoDB, Redis, Neo4j.
- [x] Có test case và GitHub Actions.
- [ ] Đo hiệu năng thực tế và điền report.
- [ ] Chụp ảnh minh chứng mỗi database và màn hình.
- [ ] Điền tên giảng viên, danh sách 2–3 thành viên và xác nhận hoạt động nhóm.
- [ ] Kiểm tra trạng thái GitHub Actions đúng commit cuối và xác nhận ngày nộp với giảng viên.
