/**
 * routes/users.js — User Profiles & Staff Management Routes
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import { requireOwner as defaultRequireOwner } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { ForbiddenError } from '../utils/errors.js';
import {
  createUserProfileSchema,
  updateProfileSchema,
} from '../schemas/user.js';
import { userController as defaultController } from '../controllers/userController.js';

export const FORBIDDEN_PROFILE_MUTATION_FIELDS = Object.freeze([
  'role',
  'approvalStatus',
  'status',
  'approvedBy',
  'approvedAt',
  'uid',
  'email',
  'createdAt',
]);

/**
 * Middleware that strictly blocks any attempt to mutate protected privilege/status fields.
 */
export const checkForbiddenProfileUpdates = (req, _res, next) => {
  if (req.body) {
    for (const field of FORBIDDEN_PROFILE_MUTATION_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        return next(
          new ForbiddenError(`Modifying protected field '${field}' is strictly forbidden.`)
        );
      }
    }
  }
  next();
};

/**
 * Factory for creating the users router.
 * Allows dependency injection for unit testing.
 *
 * @param {Object} [deps]
 * @param {import('../controllers/userController.js').userController} [deps.controller]
 * @param {import('express').RequestHandler} [deps.verifyToken]
 * @param {import('express').RequestHandler} [deps.requireOwner]
 * @returns {import('express').Router}
 */
export const createUsersRouter = ({
  controller = defaultController,
  verifyToken = defaultVerifyToken,
  requireOwner = defaultRequireOwner,
} = {}) => {
  const router = Router();

  // 1. Current user profile (read)
  router.get('/me', verifyToken, controller.getMe);

  // 2. Initial user profile creation (self-service)
  router.post(
    '/',
    verifyToken,
    validate({ body: createUserProfileSchema }),
    controller.createProfile
  );
  router.post(
    '/profile',
    verifyToken,
    validate({ body: createUserProfileSchema }),
    controller.createProfile
  );

  // 3. Current user profile (update)
  router.patch(
    '/me',
    verifyToken,
    checkForbiddenProfileUpdates,
    validate({ body: updateProfileSchema }),
    controller.updateMe
  );

  // 4. Staff Management (Owner only)
  // Must be defined before /:uid to avoid path collision
  router.get('/staff/pending', verifyToken, requireOwner, controller.getPendingStaff);
  router.post('/staff', verifyToken, requireOwner, controller.createStaffAccount);
  router.patch('/:uid/approve', verifyToken, requireOwner, controller.approveStaff);
  router.patch('/:uid/suspend', verifyToken, requireOwner, controller.suspendStaff);

  // 5. Individual user profile by UID (Self or Staff)
  router.get('/:uid', verifyToken, controller.getUserById);

  return router;
};

export const usersRouter = createUsersRouter();
export default usersRouter;
