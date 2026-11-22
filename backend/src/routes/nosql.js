import mongoose from 'mongoose';
import neo4j from 'neo4j-driver';
import { Router } from 'express';
import { redis, neo4jDriver } from '../config/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// Demo-only, read-only overview. Never return actual account data or DB credentials.
async function countRedisKeys(pattern) {
  let count = 0;
  for await (const batch of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
    count += Array.isArray(batch) ? batch.length : 1;
  }
  return count;
}

async function graphCounts() {
  const session = neo4jDriver.session({ defaultAccessMode: neo4j.session.READ });
  try {
    const nodes = await session.run('MATCH (n) RETURN labels(n)[0] AS label, count(n) AS total ORDER BY label');
    const relationships = await session.run('MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS total ORDER BY type');
    return {
      nodes: nodes.records.map(record => ({
        name: record.get('label'), count: record.get('total').toNumber()
      })),
      relationships: relationships.records.map(record => ({
        name: record.get('type'), count: record.get('total').toNumber()
      }))
    };
  } finally {
    await session.close();
  }
}

router.get('/overview', asyncHandler(async (_req, res) => {
  const collectionNames = [
    'users', 'categories', 'foods', 'orders', 'reviews', 'diningtables',
    'reservations', 'tablesessions', 'paymentreceipts', 'promotions',
    'inventoryitems', 'notifications'
  ];
  const mongo = await Promise.all(collectionNames.map(async name => ({
    name, count: await mongoose.connection.db.collection(name).estimatedDocumentCount()
  })));
  const [cartKeys, lockKeys, blockedTokens, menuCacheTtl, leaderboardLength, graph] = await Promise.all([
    countRedisKeys('cart:*'), countRedisKeys('table:lock:*'), countRedisKeys('token:block:*'),
    redis.ttl('menu:categories'), redis.zCard('leaderboard:foods'), graphCounts()
  ]);
  res.json({
    checkedAt: new Date().toISOString(),
    mongodb: { database: mongoose.connection.db.databaseName, collections: mongo },
    redis: {
      cartKeys, tableLockKeys: lockKeys, revokedTokenKeys: blockedTokens,
      menuCacheTtlSeconds: menuCacheTtl, leaderboardItems: leaderboardLength
    },
    neo4j: graph
  });
}));

export default router;
