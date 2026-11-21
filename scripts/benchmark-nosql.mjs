// Simple local HTTP benchmark; do not claim it measures MongoDB or Redis independently.
// Run after npm run dev:backend, with the usual local demo database.
import { performance } from 'node:perf_hooks';

const url = process.env.BENCHMARK_URL || 'http://127.0.0.1:5000/api/categories';
const iterations = Number(process.env.BENCHMARK_REQUESTS || 30);
if (!Number.isInteger(iterations) || iterations < 3 || iterations > 500) {
  throw new Error('BENCHMARK_REQUESTS must be between 3 and 500');
}
const samples = [];
for (let i = 0; i < iterations; i++) {
  const start = performance.now();
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('Request ' + (i + 1) + ' failed with HTTP ' + response.status);
  await response.text();
  samples.push(performance.now() - start);
}
const sorted = [...samples].sort((a, b) => a - b);
const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
const percent = q => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
console.log(JSON.stringify({
  endpoint: url, requests: iterations,
  minMs: Number(sorted[0].toFixed(2)),
  averageMs: Number(avg.toFixed(2)),
  p95Ms: Number(percent(0.95).toFixed(2)),
  maxMs: Number(sorted.at(-1).toFixed(2)),
  measuredAt: new Date().toISOString(),
  note: 'HTTP end-to-end timings, including network/JS. No isolated cache hit or database timing.'
}, null, 2));
