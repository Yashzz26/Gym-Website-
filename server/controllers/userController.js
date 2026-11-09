/**
 * controllers/userController.js — User Profile Controller
 *
 * Implements route handlers for user profiles and staff management.
 */

import { default as defaultUserService } from '../services/userService.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

export const createUserController = (userService = defaultUserService) => ({
  /**
   * GET /api/users/me
   * Returns authenticated user's profile.
   */
  async getMe(req, res, next) {
    try {
      const user = await userService.getUserById(req.user.uid);
      res.status(200).json({
        status: 'success',
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/users/profile & POST /api/users
   * Initializes profile for newly authenticated user.
   */
  async createProfile(req, res, next) {
    try {
      const user = await userService.createUserProfile(
        req.user.uid,
        req.user.email,
        req.body
      );
      res.status(201).json({
        status: 'success',
        message: 'User profile created successfully',
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/users/me
   * Updates current user's profile with strict field guarding.
   */
  async updateMe(req, res, next) {
    try {
      // Pass both sanitized req.body and raw input to detect forbidden mutations
      const user = await userService.updateUserProfile(
        req.user.uid,
        req.body,
        req.body
      );
      res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/users/:uid
   * Returns user by UID. Allowed for self, or staff roles (owner, reception, trainer).
   */
  async getUserById(req, res, next) {
    try {
      const targetUid = req.params.uid;
      const isSelf = req.user.uid === targetUid;

      // Check role if not reading own profile
      if (!isSelf) {
        const callerRole = req.profile?.role;
        if (!['owner', 'reception', 'trainer'].includes(callerRole)) {
          throw new ForbiddenError('You are not authorized to view other user profiles');
        }
      }

      const user = await userService.getUserById(targetUid);
      res.status(200).json({
        status: 'success',
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/users/staff/pending
   * Owner-only: List all staff accounts awaiting approval.
   */
  async getPendingStaff(req, res, next) {
    try {
      const pendingStaff = await userService.listPendingStaff();
      res.status(200).json({
        status: 'success',
        results: pendingStaff.length,
        data: { staff: pendingStaff },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/users/:uid/approve
   * Owner-only: Approve a pending staff account.
   */
  async approveStaff(req, res, next) {
    try {
      const staffUid = req.params.uid;
      const { assignedRole } = req.body || {};
      const user = await userService.approveStaffAccount(
        staffUid,
        req.user.uid,
        assignedRole
      );
      res.status(200).json({
        status: 'success',
        message: 'Staff account approved successfully',
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/users/:uid/suspend
   * Owner-only: Suspend a staff account.
   */
  async suspendStaff(req, res, next) {
    try {
      const staffUid = req.params.uid;
      const { reason } = req.body || {};
      const user = await userService.suspendStaffAccount(
        staffUid,
        req.user.uid,
        reason
      );
      res.status(200).json({
        status: 'success',
        message: 'Staff account suspended successfully',
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/users/staff
   * Owner-only: Create pre-approved staff account.
   */
  async createStaffAccount(req, res, next) {
    try {
      const { uid, email, displayName, role } = req.body;
      const user = await userService.createStaffAccountByOwner(
        uid,
        email,
        displayName,
        role,
        req.user.uid
      );
      res.status(201).json({
        status: 'success',
        message: 'Staff account created successfully by owner',
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  },
});

export const userController = createUserController();
export default userController;
