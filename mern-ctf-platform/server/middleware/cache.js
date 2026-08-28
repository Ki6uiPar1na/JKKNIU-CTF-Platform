import { cacheGet, cacheSet, makeCacheKey } from '../utils/redis.js';

export function cache(ttl = 30) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    const key = makeCacheKey(req.originalUrl);

    const cached = await cacheGet(key);
    if (cached) return originalJson(cached);

    res.json = (data) => {
      if (data.success !== false) cacheSet(key, data, ttl);
      originalJson(data);
    };
    next();
  };
}
