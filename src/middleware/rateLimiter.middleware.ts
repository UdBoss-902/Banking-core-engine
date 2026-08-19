import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis.js';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max allowed requests per window
}

export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, maxRequests } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identifier = req.ip || req.headers['x-forwarded-for'] || 'global_client';
    const redisKey = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      const pipeline = redis.pipeline();

      // Clear timestamps outside the current window
      pipeline.zremrangebyscore(redisKey, 0, windowStart);
      // Count requests in current sliding window
      pipeline.zcard(redisKey);
      // Add current request timestamp
      pipeline.zadd(redisKey, now, `${now}:${Math.random()}`);
      // Refresh TTL on key
      pipeline.expire(redisKey, Math.ceil(windowMs / 1000));

      const results = await pipeline.exec();

      if (!results) {
        return next();
      }

      const requestCount = (results[1][1] as number) || 0;

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - requestCount - 1));

      if (requestCount >= maxRequests) {
        res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Maximum ${maxRequests} requests allowed per ${windowMs / 1000} seconds.`,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Rate Limiter Middleware error:', error);
      // Fail open to avoid blocking legitimate traffic during Redis degradation
      next();
    }
  };
}
