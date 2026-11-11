/**
 * routes/plans.js — Membership Plans Router
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import {
  requireOwner as defaultRequireOwner,
  requireActiveStatus as defaultRequireActiveStatus,
} from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import {
  createPlanSchema,
  updatePlanSchema,
  updatePlanStatusSchema,
} from '../schemas/plan.js';
import { planController as defaultController } from '../controllers/planController.js';

export const createPlansRouter = ({
  controller = defaultController,
  verifyToken = defaultVerifyToken,
  requireOwner = defaultRequireOwner,
  requireActiveStatus = defaultRequireActiveStatus,
} = {}) => {
  const router = Router();

  // 1. List membership plans (Public read; owners can pass ?activeOnly=false)
  router.get('/', (req, res, next) => {
    // If bearer token is provided, try verifying it to detect owner role; otherwise pass through
    if (req.headers.authorization) {
      return verifyToken(req, res, () => {
        controller.listPlans(req, res, next);
      });
    }
    controller.listPlans(req, res, next);
  });

  // 2. Get single plan by ID
  router.get('/:id', controller.getPlan);

  // 3. Create membership plan (Owner only)
  router.post(
    '/',
    verifyToken,
    requireOwner,
    requireActiveStatus,
    validate({ body: createPlanSchema }),
    controller.createPlan
  );

  // 4. Update membership plan (Owner only)
  router.put(
    '/:id',
    verifyToken,
    requireOwner,
    requireActiveStatus,
    validate({ body: updatePlanSchema }),
    controller.updatePlan
  );

  router.patch(
    '/:id',
    verifyToken,
    requireOwner,
    requireActiveStatus,
    validate({ body: updatePlanSchema }),
    controller.updatePlan
  );

  // 5. Activate / deactivate membership plan (Owner only)
  router.patch(
    '/:id/status',
    verifyToken,
    requireOwner,
    requireActiveStatus,
    validate({ body: updatePlanStatusSchema }),
    controller.setPlanStatus
  );

  return router;
};

export default createPlansRouter();
