import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis.js';

const LOCK_TTL_SECONDS = 120; // Lock timeout while request processes
const CACHE_TTL_SECONDS = 86400; // 24 hours retention for completed responses

export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Only enforce idempotency on state-changing HTTP methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const idempotencyKey = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string;

  if (!idempotencyKey) {
    res.status(400).json({ error: 'Missing required Idempotency-Key header.' });
    return;
  }

  const redisKey = `idempotency:${idempotencyKey}`;

  try {
    const cachedData = await redis.get(redisKey);

    if (cachedData) {
      if (cachedData === 'IN_PROGRESS') {
        res.status(409).json({
          error: 'Concurrent Request',
          message: 'A transaction with this Idempotency-Key is currently being processed. Please retry shortly.',
        });
        return;
      }

      // Return cached response instantly
      const { statusCode, body } = JSON.parse(cachedData);
      res.status(statusCode).json(body);
      return;
    }

    // Acquire lock using atomic SET NX
    const acquired = await redis.set(redisKey, 'IN_PROGRESS', 'EX', LOCK_TTL_SECONDS, 'NX');

    if (!acquired) {
      res.status(409).json({ error: 'Concurrent Request in progress.' });
      return;
    }

    // Intercept res.json to capture and store the final response
    const originalJson = res.json.bind(res);

    res.json = (body: any): Response => {
      // Store payload in Redis only for successful HTTP statuses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redis.set(
          redisKey,
          JSON.stringify({ statusCode: res.statusCode, body }),
          'EX',
          CACHE_TTL_SECONDS
        ).catch((err) => console.error('Failed to cache idempotent response:', err));
      } else {
        // Release lock on error so client can retry with same key
        redis.del(redisKey).catch((err) => console.error('Failed to clear idempotency lock:', err));
      }

      return originalJson(body);
    };

    next();
  } catch (error) {
    console.error('Idempotency middleware error:', error);
    next(error);
  }
}
