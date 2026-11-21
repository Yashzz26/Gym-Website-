/**
 * routes/workouts.js — Workout Plans & Exercise Progress Routes (Day 20 Task 39)
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import {
  requireRole as defaultRequireRole,
  requireActiveStatus as defaultRequireActiveStatus,
} from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import {
  createWorkoutPlanSchema,
  updateWorkoutPlanSchema,
  workoutLogSchema,
} from '../schemas/workout.js';
import { workoutController as defaultController } from '../controllers/workoutController.js';

export const createWorkoutsRouter = ({
  controller = defaultController,
  verifyToken = defaultVerifyToken,
  requireRole = defaultRequireRole,
  requireActiveStatus = defaultRequireActiveStatus,
} = {}) => {
  const router = Router();

  const trainerOrOwnerGuard = [verifyToken, requireRole('trainer', 'owner'), requireActiveStatus];
  const userGuard = [verifyToken, requireRole('member', 'trainer', 'owner'), requireActiveStatus];

  // 1. Create Workout Plan (Trainer / Owner)
  router.post(
    '/plans',
    ...trainerOrOwnerGuard,
    validate({ body: createWorkoutPlanSchema }),
    controller.createPlan
  );

  // 2. Update Workout Plan (Trainer / Owner)
  router.put(
    '/plans/:planId',
    ...trainerOrOwnerGuard,
    validate({ body: updateWorkoutPlanSchema }),
    controller.updatePlan
  );

  // 3. Delete Workout Plan (Trainer / Owner)
  router.delete(
    '/plans/:planId',
    ...trainerOrOwnerGuard,
    controller.deletePlan
  );

  // 4. List Workout Plans (Member, Trainer, Owner)
  router.get(
    '/plans',
    ...userGuard,
    controller.listPlans
  );

  // 5. Get Single Workout Plan (Member, Trainer, Owner)
  router.get(
    '/plans/:planId',
    ...userGuard,
    controller.getPlanById
  );

  // 6. Log Workout Completion (Member, Trainer, Owner)
  router.post(
    '/logs',
    ...userGuard,
    validate({ body: workoutLogSchema }),
    controller.logCompletion
  );

  // 7. Get Workout Logs History (Member, Trainer, Owner)
  router.get(
    '/logs',
    ...userGuard,
    controller.listLogs
  );

  return router;
};

export const workoutsRouter = createWorkoutsRouter();
export default workoutsRouter;
