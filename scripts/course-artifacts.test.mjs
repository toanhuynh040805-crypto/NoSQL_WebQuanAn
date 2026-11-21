import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

const paths = [
  'docs/SRS.md', 'docs/SDS.md', 'docs/DATABASE_MODEL.md',
  'docs/DIAGRAMS.md', 'docs/NO_SQL_RUNBOOK.md',
  'docs/TEST_CASES.md', 'docs/FINAL_REPORT.md', 'docs/GROUP_ACTIVITY.md',
  'docs/REQUIREMENTS_CHECKLIST.md', 'docs/EVIDENCE_CHECKLIST.md',
  'database/mongodb/01_inspect.js', 'database/mongodb/02_crud_demo.js',
  'database/mongodb/sample_data.json', 'database/redis/01_inspect.rediscli',
  'database/redis/02_demo.rediscli', 'database/neo4j/01_inspect.cypher',
  'database/neo4j/02_demo.cypher'
];
test('all required NoSQL course deliverables exist in the repository', () => {
  for (const path of paths) assert.ok(existsSync(path), 'Missing required course deliverable: ' + path);
});
test('SRS and SDS document the 3 engines and restaurant role scenarios', () => {
  const srs = readFileSync('docs/SRS.md', 'utf8');
  const sds = readFileSync('docs/SDS.md', 'utf8');
  for (const term of ['MongoDB', 'Redis', 'Neo4j', 'Phục vụ', 'Thu ngân', 'Bếp']) {
    assert.ok(srs.includes(term), 'SRS should mention ' + term);
    assert.ok(sds.includes(term), 'SDS should mention ' + term);
  }
});
test('Mongoose, Redis and Neo4j source integration is present', () => {
  const db = readFileSync('backend/src/config/database.js', 'utf8');
  const compose = readFileSync('docker-compose.yml', 'utf8');
  for (const term of ['mongoose', 'redis', 'neo4j']) assert.ok(db.includes(term));
  for (const term of ['mongodb:', 'redis:', 'neo4j:']) assert.ok(compose.includes(term));
});
test('MongoDB sample data uses valid JSON', () => {
  const sample = JSON.parse(readFileSync('database/mongodb/sample_data.json','utf8'));
  assert.ok(Array.isArray(sample.foods) && sample.foods.length > 0);
  assert.ok(Array.isArray(sample.orders) && sample.orders[0].items.length > 0);
});
test('course scripts are safe by default: inspection is read-only', () => {
  const mongo = readFileSync('database/mongodb/01_inspect.js','utf8');
  const graph = readFileSync('database/neo4j/01_inspect.cypher','utf8');
  const redis = readFileSync('database/redis/01_inspect.rediscli','utf8');
  assert.ok(!/dropDatabase|deleteMany|\.remove\(/i.test(mongo));
  assert.ok(!/DETACH DELETE|DROP DATABASE/i.test(graph));
  assert.ok(!/FLUSHALL|FLUSHDB|DEL\s+/i.test(redis));
});
