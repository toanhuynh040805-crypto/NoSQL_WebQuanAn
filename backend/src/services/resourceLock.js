import { randomUUID } from 'node:crypto';
import { redis } from '../config/database.js';
import { AppError } from '../utils/errors.js';

export async function withResourceLock(key, work) {
  const owner = randomUUID();
  if (!await redis.set(key, owner, { NX: true, EX: 30 })) throw new AppError(423, 'Dữ liệu đang được xử lý. Vui lòng thử lại sau vài giây');
  try { return await work(); }
  finally {
    await redis.eval('if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
      { keys: [key], arguments: [owner] }).catch(error => console.error('[Lock release]', error.message));
  }
}
