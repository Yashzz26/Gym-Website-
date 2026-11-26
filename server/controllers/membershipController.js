/**
 * controllers/membershipController.js — Controller for Membership Lifecycle & Renewals
 */

import { membershipService as defaultService } from '../services/membershipService.js';
import { ForbiddenError } from '../utils/errors.js';

export const createMembershipController = (service = defaultService) => {
  return {
    async createMembership(req, res, next) {
      try {
        const creatorUid = req.user?.uid || 'staff-creator';
        const result = await service.createMembership(creatorUid, req.body);

        res.status(201).json({
          status: 'success',
          message: 'Membership created successfully',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },

    async renewMembership(req, res, next) {
      try {
        const user = req.user;
        const role = req.profile?.role || user?.claims?.role || 'member';
        const isStaff = ['owner', 'reception', 'trainer'].includes(role);
        const { id: membershipId } = req.params;

        const result = await service.renewMembership(
          user.uid,
          membershipId,
          req.body,
          !isStaff
        );

        res.status(200).json({
          status: 'success',
          message: 'Membership renewed successfully',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },

    async getMembership(req, res, next) {
      try {
        const user = req.user;
        const role = req.profile?.role || user?.claims?.role || 'member';
        const isStaff = ['owner', 'reception', 'trainer'].includes(role);
        const { id: membershipId } = req.params;

        const result = await service.getMembershipById(membershipId);

        if (!isStaff && result.userId !== user.uid) {
          let belongsToSelf = false;
          if (user.email && typeof service.getUserMemberships === 'function') {
            const own = await service.getUserMemberships(user.uid, user.email).catch(() => null);
            belongsToSelf = Boolean(own?.history?.some((m) => m.membershipId === result.membershipId));
          }
          if (!belongsToSelf) {
            throw new ForbiddenError('You can only view your own membership records');
          }
        }

        res.status(200).json({
          status: 'success',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },

    async getUserMemberships(req, res, next) {
      try {
        const user = req.user;
        const role = req.profile?.role || user?.claims?.role || 'member';
        const isStaff = ['owner', 'reception', 'trainer'].includes(role);
        const { userId } = req.params;

        if (!isStaff && userId !== user.uid) {
          throw new ForbiddenError('You can only view your own membership history');
        }

        const isSelf = userId === user.uid;
        const result = await service.getUserMemberships(userId, isSelf ? user.email : null);

        res.status(200).json({
          status: 'success',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },

    async getExpiringMemberships(req, res, next) {
      try {
        const days = req.query.days ? parseInt(req.query.days, 10) : 7;
        const includeExpired = req.query.includeExpired === 'true';

        const result = await service.getExpiringMemberships({ days, includeExpired });

        res.status(200).json({
          status: 'success',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },
  };
};

export const membershipController = createMembershipController();
