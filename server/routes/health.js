/**
 * routes/health.js — health-check endpoint
 *
 * GET /api/health
 * Returns server status, uptime and current timestamp.
 * Used to verify the server is running and reachable.
 */

import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'gym-management-server',
    version: '0.1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

export default router;
