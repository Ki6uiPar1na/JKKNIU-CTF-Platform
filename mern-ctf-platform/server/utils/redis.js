import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) return null;
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

redis.on('error', () => {});

export async function connectRedis() {
  try { await redis.connect(); } catch {}
}

export function makeCacheKey(...parts) {
  return `ctf:${parts.join(':')}`;
}

const DEFAULT_TTL = 30;

export async function cacheGet(key) {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

export async function cacheSet(key, data, ttl = DEFAULT_TTL) {
  try { await redis.set(key, JSON.stringify(data), 'EX', ttl); } catch {}
}

export async function cacheDel(pattern) {
  try {
    let cursor = '0';
    const keys = [];
    do {
      const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');
    if (keys.length > 0) await redis.del(...keys);
  } catch {}
}

export default redis;
