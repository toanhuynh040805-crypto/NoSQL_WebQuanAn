import mongoose from 'mongoose';
import neo4j from 'neo4j-driver';
import { connectDatabases, closeDatabases, redis, neo4jDriver } from '../config/database.js';

// Read-only report for the course demonstration. It never lists user contents or credentials.
async function inspect() {
  const db = mongoose.connection.db;
  const names = await db.listCollections({}, { nameOnly: true }).toArray();
  const collections = await Promise.all(names.map(async item => ({
    name: item.name,
    count: await db.collection(item.name).estimatedDocumentCount()
  })));
  const redisInfo = {
    ping: await redis.ping(),
    categoryCacheTtl: await redis.ttl('menu:categories'),
    leaderboardCount: await redis.zCard('leaderboard:foods')
  };
  const session = neo4jDriver.session({ defaultAccessMode: neo4j.session.READ });
  try {
    const nodeRows = await session.run('MATCH (n) RETURN labels(n)[0] AS type, count(n) AS total');
    const relationRows = await session.run('MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS total');
    return {
      checkedAt: new Date().toISOString(),
      mongodb: { name: db.databaseName, collections },
      redis: redisInfo,
      neo4j: {
        nodes: nodeRows.records.map(r => ({ type: r.get('type'), total: r.get('total').toNumber() })),
        relationships: relationRows.records.map(r => ({ type: r.get('type'), total: r.get('total').toNumber() }))
      }
    };
  } finally {
    await session.close();
  }
}

try {
  await connectDatabases();
  const report = await inspect();
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error('Database inspection failed:', error.message);
  process.exitCode = 1;
} finally {
  await closeDatabases();
}
