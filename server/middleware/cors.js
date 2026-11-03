/**
 * middleware/cors.js — Environment-configured CORS middleware
 *
 * Configures Cross-Origin Resource Sharing based on CORS_ORIGIN environment variable.
 * Supports single origins, comma-separated lists, and development fallbacks.
 */

import cors from 'cors';

export const configureCors = () => {
  const envOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

  // Support multiple comma-separated origins, or single origin
  const allowedOrigins = envOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`CORS blocked request from unauthorized origin: ${origin}`)
      );
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    credentials: true,
    maxAge: 86400, // Cache preflight for 24 hours
  };

  return cors(corsOptions);
};

export default configureCors;
