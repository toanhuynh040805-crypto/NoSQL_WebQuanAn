# Neo4j — Graph database

**Giao diện:** http://localhost:7474 · **Bolt:** `7687`. Tài khoản demo trong `docker-compose.yml`: `neo4j` / `restaurant123` (chỉ dev).

**Backend triển khai:** `backend/src/services/graph.js`. Ba nhãn node: `Customer`, `Food`, `Category`; ba quan hệ: `ORDERED`, `REVIEWED`, `BELONGS_TO`.

Mở `01_inspect.cypher` và chạy từng câu trong Neo4j Browser. Script này chỉ đọc. Script `02_demo.cypher` tùy chọn tạo **các node có ID bắt đầu bằng `course-demo-`** và quan hệ chỉ giữa các node này, phục vụ hình minh chứng.

Để xem đồ thị thực:
```cypher
MATCH p=(c:Customer)-[:ORDERED]->(f:Food)
RETURN p LIMIT 15;
```

```cypher
MATCH p=(f:Food)-[:BELONGS_TO]->(c:Category)
RETURN p LIMIT 15;
```

Có thể dùng Cypher Browser để chụp minh chứng. **Không chạy** `MATCH (n) DETACH DELETE n` trên dữ liệu cần giữ.
