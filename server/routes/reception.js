/**
 * routes/reception.js — Reception Desk Router
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import {
  requireRole as defaultRequireRole,
  requireActiveStatus as defaultRequireActiveStatus,
} from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { registerMemberSchema } from '../schemas/reception.js';
import {
  recordManualPaymentSchema,
  listManualPaymentsQuerySchema,
} from '../schemas/manualPayment.js';
import { receptionController as defaultController } from '../controllers/receptionController.js';
import { manualPaymentController as defaultPaymentController } from '../controllers/manualPaymentController.js';

export const createReceptionRouter = ({
  controller = defaultController,
  paymentController = defaultPaymentController,
  verifyToken = defaultVerifyToken,
  requireRole = defaultRequireRole,
  requireActiveStatus = defaultRequireActiveStatus,
} = {}) => {
  const router = Router();

  const allowReceptionOrOwner = requireRole('reception', 'owner');
  const staffGuard = [verifyToken, allowReceptionOrOwner, requireActiveStatus];

  // Register walk-in member
  router.post(
    '/members',
    ...staffGuard,
    validate({ body: registerMemberSchema }),
    controller.registerMember
  );

  // List recent members
  router.get(
    '/members',
    ...staffGuard,
    controller.listMembers
  );

  // ----------------------------------------------------------------
  // Manual Payment Routes (Cash / Manual UPI) — Task 29 (Day 15)
  // ----------------------------------------------------------------

  // Record a new cash or manual UPI payment
  router.post(
    '/payments',
    ...staffGuard,
    validate({ body: recordManualPaymentSchema }),
    paymentController.recordPayment
  );

  // List manual payment records (filterable by memberId & method)
  router.get(
    '/payments',
    ...staffGuard,
    validate({ query: listManualPaymentsQuerySchema }),
    paymentController.listPayments
  );

  // Get a specific manual payment record
  router.get(
    '/payments/:paymentId',
    ...staffGuard,
    paymentController.getPayment
  );

  return router;
};

export const receptionRouter = createReceptionRouter();
export default receptionRouter;

