// OPTIONAL DEMO: create example nodes distinct from real customer/food IDs.
// Re-running MERGE does not create duplicates. Only demoTag nodes are eligible
// for optional cleanup below; do not use MATCH (n) DETACH DELETE n.
MERGE (c:Customer {id: 'course-demo-customer-001'})
SET c.name = 'Khách demo NoSQL', c.demoTag = 'nosql-course'
MERGE (f:Food {id: 'course-demo-food-001'})
SET f.name = 'Món demo đồ thị', f.price = 25000, f.demoTag = 'nosql-course'
MERGE (g:Category {id: 'course-demo-category-001'})
SET g.name = 'Danh mục demo', g.demoTag = 'nosql-course'
MERGE (c)-[ordered:ORDERED]->(f)
SET ordered.count = 2
MERGE (c)-[reviewed:REVIEWED]->(f)
SET reviewed.rating = 5
MERGE (f)-[:BELONGS_TO]->(g);

MATCH p=(c:Customer {id: 'course-demo-customer-001'})-[r]->(f:Food)
RETURN p;
// Optional cleanup (uncomment only when finished and only for your demo nodes):
// MATCH (n {demoTag: 'nosql-course'}) DETACH DELETE n;
