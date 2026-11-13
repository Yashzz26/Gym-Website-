/**
 * routes/memberships.js — Membership Lifecycle and Renewal Routes
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import {
  requireRole as defaultRequireRole,
  requireActiveStatus as defaultRequireActiveStatus,
} from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { createMembershipSchema, renewMembershipSchema } from '../schemas/membership.js';
import { membershipController as defaultController } from '../controllers/membershipController.js';

export const createMembershipsRouter = ({
  controller = defaultController,
  verifyToken = defaultVerifyToken,
  requireRole = defaultRequireRole,
  requireActiveStatus = defaultRequireActiveStatus,
} = {}) => {
  const router = Router();

  const allowStaff = requireRole('reception', 'owner');

  // Create a new membership (Staff/Owner)
  router.post(
    '/',
    verifyToken,
    allowStaff,
    requireActiveStatus,
    validate({ body: createMembershipSchema }),
    controller.createMembership
  );

  // Renew an existing membership (Staff or Self)
  router.post(
    '/:id/renew',
    verifyToken,
    validate({ body: renewMembershipSchema }),
    controller.renewMembership
  );

  // Get single membership by ID (Staff or Self)
  router.get(
    '/:id',
    verifyToken,
    controller.getMembership
  );

  // Get full membership history and active membership for a user (Staff or Self)
  router.get(
    '/user/:userId',
    verifyToken,
    controller.getUserMemberships
  );

  return router;
};

export const membershipsRouter = createMembershipsRouter();
export default membershipsRouter;
