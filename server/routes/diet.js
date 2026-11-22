/**
 * routes/diet.js — Diet & Nutrition Plans Routes (Day 21 Task 41)
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import {
  requireRole as defaultRequireRole,
  requireActiveStatus as defaultRequireActiveStatus,
} from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import {
  createDietPlanSchema,
  updateDietPlanSchema,
} from '../schemas/diet.js';
import defaultDietController from '../controllers/dietController.js';

export const createDietRouter = ({
  controller = defaultDietController,
  verifyToken = defaultVerifyToken,
  requireRole = defaultRequireRole,
  requireActiveStatus = defaultRequireActiveStatus,
} = {}) => {
  const router = Router();

  const trainerOrOwnerGuard = [verifyToken, requireRole('trainer', 'owner'), requireActiveStatus];
  const authenticatedGuard = [verifyToken, requireRole('member', 'trainer', 'owner'), requireActiveStatus];

  // 1. Create Diet Plan (Trainer / Owner)
  router.post(
    '/plans',
    ...trainerOrOwnerGuard,
    validate({ body: createDietPlanSchema }),
    controller.createPlan
  );

  // 2. Update Diet Plan (Trainer / Owner)
  router.put(
    '/plans/:planId',
    ...trainerOrOwnerGuard,
    validate({ body: updateDietPlanSchema }),
    controller.updatePlan
  );

  // 3. Delete Diet Plan (Trainer / Owner)
  router.delete(
    '/plans/:planId',
    ...trainerOrOwnerGuard,
    controller.deletePlan
  );

  // 4. List Diet Plans (Member, Trainer, Owner)
  router.get(
    '/plans',
    ...authenticatedGuard,
    controller.listPlans
  );

  // 5. Get Active Diet Plan for a Member (Member, Trainer, Owner)
  router.get(
    '/members/:memberId/active',
    ...authenticatedGuard,
    controller.getMemberActivePlan
  );

  // 6. Get Single Diet Plan by ID (Member, Trainer, Owner)
  router.get(
    '/plans/:planId',
    ...authenticatedGuard,
    controller.getPlanById
  );

  return router;
};

export default createDietRouter();
