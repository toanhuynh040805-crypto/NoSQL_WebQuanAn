import neo4j from 'neo4j-driver';
import { neo4jDriver } from '../config/database.js';

async function run(query, params = {}) {
  const session = neo4jDriver.session();
  try {
    return await session.executeWrite(tx => tx.run(query, params));
  } finally {
    await session.close();
  }
}

export async function ensureGraphConstraints() {
  await run('CREATE CONSTRAINT customer_id IF NOT EXISTS FOR (c:Customer) REQUIRE c.id IS UNIQUE');
  await run('CREATE CONSTRAINT food_id IF NOT EXISTS FOR (f:Food) REQUIRE f.id IS UNIQUE');
  await run('CREATE CONSTRAINT category_id IF NOT EXISTS FOR (c:Category) REQUIRE c.id IS UNIQUE');
}

export async function clearGraphData() {
  await run('MATCH (n) DETACH DELETE n');
}

export async function syncCatalogGraph(categories, foods) {
  for (const category of categories) {
    await run('MERGE (c:Category {id: $id}) SET c.name = $name', {
      id: category.id, name: category.name
    });
  }
  for (const food of foods) {
    await run(`
      MERGE (f:Food {id: $id}) SET f.name = $name, f.price = $price
      WITH f
      MATCH (c:Category {id: $categoryId})
      MERGE (f)-[:BELONGS_TO]->(c)
    `, { id: food.id, name: food.name, price: food.price, categoryId: food.category.id });
  }
}

export async function recordOrderGraph(user, order) {
  for (const item of order.items) {
    await run(`
      MERGE (c:Customer {id: $customerId}) SET c.name = $customerName
      MERGE (f:Food {id: $foodId}) SET f.name = $foodName
      MERGE (c)-[r:ORDERED]->(f)
      SET r.count = coalesce(r.count, 0) + $quantity, r.lastOrderedAt = datetime()
    `, {
      customerId: String(user.id), customerName: user.fullName,
      foodId: String(item.food), foodName: item.name, quantity: item.quantity
    });
  }
}

export async function recordReviewGraph(userId, foodId, rating) {
  await run(`
    MERGE (c:Customer {id: $userId})
    MERGE (f:Food {id: $foodId})
    MERGE (c)-[r:REVIEWED]->(f)
    SET r.rating = $rating, r.updatedAt = datetime()
  `, { userId: String(userId), foodId: String(foodId), rating });
}

export async function recommendFoodIds(userId, limit = 8) {
  const session = neo4jDriver.session({ defaultAccessMode: neo4j.session.READ });
  try {
    const result = await session.run(`
      MATCH (me:Customer {id: $userId})-[:ORDERED|REVIEWED]->(liked:Food)
      MATCH (other:Customer)-[:ORDERED|REVIEWED]->(liked)
      WHERE other <> me
      MATCH (other)-[:ORDERED|REVIEWED]->(candidate:Food)
      WHERE NOT (me)-[:ORDERED|REVIEWED]->(candidate)
      RETURN candidate.id AS id, count(DISTINCT other) AS score
      ORDER BY score DESC
      LIMIT $limit
    `, { userId: String(userId), limit: neo4j.int(limit) });
    return result.records.map(record => record.get('id'));
  } finally {
    await session.close();
  }
}

