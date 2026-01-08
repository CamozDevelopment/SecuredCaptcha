import rateLimit from 'express-rate-limit';
import { redisClient } from '../config/database';
import { Response } from 'express';
import { AuthRequest } from './auth';

// General API rate limiter
export const generalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication endpoints rate limiter (stricter)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
});

// Challenge creation rate limiter
export const challengeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 challenges per minute per IP
  message: 'Too many challenge requests, please slow down.',
});

// Tier-based rate limiter
export const tierRateLimiter = async (
  req: AuthRequest,
  res: Response,
  next: Function
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userId = req.user.id;
    const now = new Date();
    const monthKey = `usage:${userId}:${now.getFullYear()}-${now.getMonth() + 1}`;

    // Get tier limits
    const tierLimits: { [key: string]: number } = {
      FREE: parseInt(process.env.FREE_TIER_LIMIT || '1000'),
      BASIC: parseInt(process.env.BASIC_TIER_LIMIT || '10000'),
      PRO: parseInt(process.env.PRO_TIER_LIMIT || '100000'),
      ENTERPRISE: parseInt(process.env.ENTERPRISE_TIER_LIMIT || '1000000'),
    };

    const limit = tierLimits[req.user.tier] || tierLimits.free;

    try {
      // Try to get count from Redis
      const count = await redisClient.get(monthKey);
      const currentUsage = count ? parseInt(count) : 0;

      if (currentUsage >= limit) {
        res.status(429).json({
          error: 'Monthly usage limit exceeded',
          tier: req.user.tier,
          limit,
          current: currentUsage,
          upgradeUrl: '/api/v1/billing/upgrade'
        });
        return;
      }

      // Increment counter
      await redisClient.incr(monthKey);
      await redisClient.expire(monthKey, 60 * 60 * 24 * 32); // Expire after 32 days
    } catch (redisError) {
      // Redis not available, continue without caching
      console.warn('Redis not available for rate limiting');
    }

    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    next();
  }
};
