/**
 * routes/qr.js — QR Token Router
 *
 * Implements Day 16 Task 31 endpoints:
 * - GET  /api/qr/current  — Active QR token for reception display
 * - POST /api/qr/rotate   — Rotate/refresh token
 * - POST /api/qr/validate — Validate token
 * - POST /api/qr/consume  — Atomically consume token (replay rejection)
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import {
  requireRole as defaultRequireRole,
  requireActiveStatus as defaultRequireActiveStatus,
} from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { validateQrSchema, rotateQrSchema } from '../schemas/qr.js';
import { qrController as defaultController } from '../controllers/qrController.js';

export const createQrRouter = ({
  controller = defaultController,
  verifyToken = defaultVerifyToken,
  requireRole = defaultRequireRole,
  requireActiveStatus = defaultRequireActiveStatus,
} = {}) => {
  const router = Router();

  const allowStaff = requireRole('reception', 'owner');
  const staffGuard = [verifyToken, allowStaff, requireActiveStatus];
  const userGuard = [verifyToken, requireActiveStatus];

  // Fetch current active rotating token for entrance/reception display
  router.get('/current', ...staffGuard, controller.getCurrentToken);

  // Manually force-rotate a new token
  router.post(
    '/rotate',
    ...staffGuard,
    validate({ body: rotateQrSchema }),
    controller.rotateToken
  );

  // Validate token without consuming
  router.post(
    '/validate',
    ...userGuard,
    validate({ body: validateQrSchema }),
    controller.validateToken
  );

  // Atomically consume token (replay prevention verification)
  router.post(
    '/consume',
    ...userGuard,
    validate({ body: validateQrSchema }),
    controller.consumeToken
  );

  return router;
};

export const qrRouter = createQrRouter();
export default qrRouter;
