/**
 * routes/members.js — Member Routes & Online Joining
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { selectPlanSchema } from '../schemas/member.js';
import { memberController as defaultController } from '../controllers/memberController.js';

export const createMembersRouter = ({
  controller = defaultController,
  verifyToken = defaultVerifyToken,
} = {}) => {
  const router = Router();

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

  return router;
};

export const membersRouter = createMembersRouter();
export default membersRouter;
