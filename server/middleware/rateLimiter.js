/**
 * middleware/rateLimiter.js — Rate limiting middleware
 *
 * Protects API routes from abuse and denial-of-service attempts.
 * Configured via RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX environment variables.
 * Bypasses health-check route so uptime probes are not throttled.
 */

import rateLimit from 'express-rate-limit';

export const configureRateLimiter = (options = {}) => {
  const isDev = (process.env.NODE_ENV || 'development') !== 'production';
  const defaultWindowMs = isDev ? 60 * 1000 : 15 * 60 * 1000; // 1 min in dev, 15 mins in prod
  const defaultMax = isDev ? 10000 : 100; // 10,000 in dev, 100 in prod

  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || defaultWindowMs;
  const max = Number(process.env.RATE_LIMIT_MAX) || defaultMax;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Exclude health check from rate limiting
      return req.originalUrl === '/api/health' || req.path === '/api/health';
    },
    handler: (req, res) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      return res.status(429).json({
        status: 'error',
        statusCode: 429,
        message: 'Too many requests from this IP address. Please try again later.',
        retryAfterSeconds: retryAfter,
        requestId: req.id || null,
      });
    },
    ...options,
  });
};

export default configureRateLimiter;

