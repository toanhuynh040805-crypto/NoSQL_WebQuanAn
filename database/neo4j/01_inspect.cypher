// READ ONLY — run queries one by one inside http://localhost:7474
SHOW CONSTRAINTS;
// How many nodes of each type?
MATCH (n) RETURN labels(n) AS NodeLabels, count(n) AS Total ORDER BY Total DESC;
// Are three relation types present in the current graph?
MATCH ()-[r]->() RETURN type(r) AS RelationshipType, count(r) AS Total ORDER BY Total DESC;
// Which food is associated with which category?
MATCH (f:Food)-[:BELONGS_TO]->(cat:Category)
RETURN f.name AS FoodName, f.price AS Price, cat.name AS Category
ORDER BY Category, FoodName LIMIT 15;
// Orders relations created by customer demo orders.
MATCH (customer:Customer)-[rel:ORDERED]->(f:Food)
RETURN customer.name AS CustomerName, f.name AS FoodName, rel.count AS Quantity
ORDER BY Quantity DESC LIMIT 10;
// Review relations created after customers review completed orders.
MATCH (customer:Customer)-[rel:REVIEWED]->(f:Food)
RETURN customer.name AS CustomerName, f.name AS FoodName, rel.rating AS Rating
LIMIT 10;
