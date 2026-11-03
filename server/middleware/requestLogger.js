/**
 * middleware/requestLogger.js — Structured HTTP request logger
 *
 * Attaches a unique Request ID to each incoming request and logs response completion
 * with HTTP method, URL, status code, duration, client IP, and request ID.
 * Output format is configurable via LOG_FORMAT ('json' or 'dev').
 */

import crypto from 'node:crypto';

export const requestLogger = (req, res, next) => {
  // 1. Assign or propagate Request ID
  const incomingId = req.headers['x-request-id'];
  req.id = (typeof incomingId === 'string' && incomingId.trim()) ? incomingId : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);

  // 2. Record start timestamp
  const startTime = process.hrtime.bigint();
  const format = process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'dev');

  // 3. Listen for response finish
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const roundedMs = Math.round(durationMs * 100) / 100;

    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: roundedMs,
      ip: req.ip || req.socket?.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    if (format === 'json') {
      console.log(JSON.stringify(logEntry));
    } else {
      const statusColor =
        res.statusCode >= 500
          ? '\x1b[31m' // Red
          : res.statusCode >= 400
          ? '\x1b[33m' // Yellow
          : res.statusCode >= 300
          ? '\x1b[36m' // Cyan
          : '\x1b[32m'; // Green
      const resetColor = '\x1b[0m';

      console.log(
        `[${logEntry.timestamp}] [${req.id.slice(0, 8)}] ${req.method} ${logEntry.url} ${statusColor}${res.statusCode}${resetColor} - ${roundedMs}ms`
      );
    }
  });

  next();
};

export default requestLogger;
