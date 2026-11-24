/**
 * routes/members.js — Member Routes & Online Joining
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import {
  requireRole as defaultRequireRole,
  requireActiveStatus as defaultRequireActiveStatus,
} from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { selectPlanSchema } from '../schemas/member.js';
import { memberController as defaultController } from '../controllers/memberController.js';

export const createMembersRouter = ({
  controller = defaultController,
  verifyToken = defaultVerifyToken,
  requireRole = defaultRequireRole,
  requireActiveStatus = defaultRequireActiveStatus,
} = {}) => {
  const router = Router();
  const allowStaff = requireRole('owner', 'reception');

  // Select membership plan online
  router.post(
    '/select-plan',
    verifyToken,
    validate({ body: selectPlanSchema }),
    controller.selectPlan
  );

  router.post(
    '/join',
    verifyToken,
    validate({ body: selectPlanSchema }),
    controller.selectPlan
  );

  // Retrieve current member membership status
  router.get('/my-membership', verifyToken, controller.getMyMembership);

  // Inactive members query (Task 45, Day 23)
  router.get(
    '/inactive',
    verifyToken,
    allowStaff,
    requireActiveStatus,
    controller.getInactiveMembers
  );

  // Record follow-up outreach log (Task 45/46, Day 23)
  router.post(
    '/:id/follow-up',
    verifyToken,
    allowStaff,
    requireActiveStatus,
    controller.recordFollowUp
  );

  return router;
};

export const membersRouter = createMembersRouter();
export default membersRouter;

