/**
 * server.js — Gym Management System Express entry point
 *
 * Day 1: Foundation only.
 * - Loads environment variables
 * - Mounts base middleware (CORS, JSON body parser)
 * - Mounts the /api/health route
 * - Starts the HTTP server
 *
 * Middleware (auth, validation, rate-limiting) and feature routers
 * are added in subsequent development days.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import healthRouter from './routes/health.js';

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = express();

// CORS — allow requests from the React dev server (or configured origin).
// In production, set CORS_ORIGIN to the exact deployed frontend URL.
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(
  cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Parse JSON request bodies.
app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use('/api/health', healthRouter);

// 404 catch-all — must come after all route definitions.
app.use((_req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found.' });
});

// Global error handler — must have four parameters so Express recognises it.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'An unexpected error occurred.'
      : err.message || 'An unexpected error occurred.';

  console.error('[ERROR]', err);
  res.status(statusCode).json({ status: 'error', message });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(
    `[GymServer] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
  );
  console.log(`[GymServer] Health check → http://localhost:${PORT}/api/health`);
});

export default app;
