/**
 * server.js — Gym Management System Express entry point
 *
 * Middleware Pipeline (wired in order):
 * 1. Request logging & Request ID generation (requestLogger)
 * 2. Cross-Origin Resource Sharing (configureCors)
 * 3. Rate limiting (configureRateLimiter)
 * 4. Body parsing (express.json, express.urlencoded)
 * 5. Feature routes (/api/health, /api/auth, ...)
 * 6. 404 Route-not-found handler (notFound)
 * 7. Centralized structured error handler (errorHandler)
 */

import 'dotenv/config';
import express from 'express';
import url from 'node:url';

// Middleware imports
import { requestLogger } from './middleware/requestLogger.js';
import { configureCors } from './middleware/cors.js';
import { configureRateLimiter } from './middleware/rateLimiter.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route imports
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import settingsRouter from './routes/settings.js';

// ---------------------------------------------------------------------------
// App Factory
// ---------------------------------------------------------------------------

export const createApp = () => {
  const app = express();

  // 1. Structured request logging and Request ID tagging
  app.use(requestLogger);

  // 2. CORS configured from environment variables
  app.use(configureCors());

  // 3. Rate limiting (applies to all routes except excluded health checks)
  app.use(configureRateLimiter());

  // 4. Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 5. Routes
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/settings', settingsRouter);

  return app;
};

// ---------------------------------------------------------------------------
// Default App Instance with Error Handlers
// ---------------------------------------------------------------------------

const app = createApp();

// 6. Catch-all for undefined routes
app.use(notFound);

// 7. Centralized structured error handler
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start server (only if executed directly, avoiding duplicate listeners in tests)
// ---------------------------------------------------------------------------

const isMainModule = Boolean(
  process.argv[1] &&
  (url.fileURLToPath(import.meta.url) === process.argv[1] ||
   url.fileURLToPath(import.meta.url).replace(/\\/g, '/') === process.argv[1].replace(/\\/g, '/'))
);

if (isMainModule) {
  const PORT = Number(process.env.PORT) || 5000;
  app.listen(PORT, () => {
    console.log(
      `[GymServer] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
    );
    console.log(`[GymServer] Health check → http://localhost:${PORT}/api/health`);
  });
}

export default app;
