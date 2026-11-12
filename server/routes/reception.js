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
import { receptionController as defaultController } from '../controllers/receptionController.js';

export const createReceptionRouter = ({
  controller = defaultController,
  verifyToken = defaultVerifyToken,
  requireRole = defaultRequireRole,
  requireActiveStatus = defaultRequireActiveStatus,
} = {}) => {
  const router = Router();

  const allowReceptionOrOwner = requireRole('reception', 'owner');

  // Register walk-in member
  router.post(
    '/members',
    verifyToken,
    allowReceptionOrOwner,
    requireActiveStatus,
    validate({ body: registerMemberSchema }),
    controller.registerMember
  );

  // List recent members
  router.get(
    '/members',
    verifyToken,
    allowReceptionOrOwner,
    requireActiveStatus,
    controller.listMembers
  );

  return router;
};

export const receptionRouter = createReceptionRouter();
export default receptionRouter;

