/**
 * routes/trainers.js — Trainer Assignments & Member Management Router (Day 19 Task 37)
 *
 * Implements endpoints:
 * - POST  /api/trainers/assign           — Assign member to trainer (Owner/Reception)
 * - POST  /api/trainers/unassign         — Unassign member from trainer (Owner/Reception)
 * - GET   /api/trainers/members          — List assigned members (Trainer/Owner)
 * - GET   /api/trainers/members/:memberId— Get specific member details (Enforces trainer assignment)
 * - PATCH /api/trainers/members/:memberId/progress — Update member fitness goal & progress
 * - GET   /api/trainers                  — List active gym trainers
 * - GET   /api/trainers/assignments      — List assignment records
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import {
  requireRole as defaultRequireRole,
  requireActiveStatus as defaultRequireActiveStatus,
} from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import {
  assignMemberSchema,
  unassignMemberSchema,
  updateMemberProgressSchema,
} from '../schemas/trainer.js';
import { trainerController as defaultController } from '../controllers/trainerController.js';

export const createTrainersRouter = ({
  controller = defaultController,
  verifyToken = defaultVerifyToken,
  requireRole = defaultRequireRole,
  requireActiveStatus = defaultRequireActiveStatus,
} = {}) => {
  const router = Router();

  // Guards
  const staffGuard = [verifyToken, requireRole('owner', 'reception'), requireActiveStatus];
  const trainerOrOwnerGuard = [verifyToken, requireRole('trainer', 'owner'), requireActiveStatus];
  const allStaffGuard = [verifyToken, requireRole('owner', 'reception', 'trainer'), requireActiveStatus];

  // 1. Assign member to trainer
  router.post(
    '/assign',
    ...staffGuard,
    validate({ body: assignMemberSchema }),
    controller.assignMember
  );

  // 2. Unassign member from trainer
  router.post(
    '/unassign',
    ...staffGuard,
    validate({ body: unassignMemberSchema }),
    controller.unassignMember
  );

  // 3. Trainer's assigned members list
  router.get(
    '/members',
    ...trainerOrOwnerGuard,
    controller.getMyAssignedMembers
  );

  // 4. Single assigned member details (enforces trainer assignment)
  router.get(
    '/members/:memberId',
    ...trainerOrOwnerGuard,
    controller.getAssignedMemberById
  );

  // 5. Update assigned member's fitness progress / goal
  router.patch(
    '/members/:memberId/progress',
    ...trainerOrOwnerGuard,
    validate({ body: updateMemberProgressSchema }),
    controller.updateMemberProgress
  );

  // 6. List all available gym trainers
  router.get(
    '/',
    ...allStaffGuard,
    controller.listTrainers
  );

  // 7. List assignment history / records
  router.get(
    '/assignments',
    ...allStaffGuard,
    controller.listAssignments
  );

  return router;
};

export const trainersRouter = createTrainersRouter();
export default trainersRouter;
