/**
 * controllers/memberController.js — Controller for Member and Online Joining endpoints
 */

import { memberService as defaultService } from '../services/memberService.js';

export const createMemberController = (service = defaultService) => {
  return {
    async selectPlan(req, res, next) {
      try {
        const userId = req.user?.uid;
        const result = await service.selectPlan(userId, req.body);

        res.status(201).json({
          status: 'success',
          message: 'Plan selected successfully. Membership status is payment_pending.',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },

    async getMyMembership(req, res, next) {
      try {
        const userId = req.user?.uid;
        const email = req.user?.email || null;
        const membership = await service.getCurrentMembership(userId, email);

        res.status(200).json({
          status: 'success',
          data: membership,
        });
      } catch (err) {
        next(err);
      }
    },

    async getInactiveMembers(req, res, next) {
      try {
        const daysInactive = req.query.daysInactive ? parseInt(req.query.daysInactive, 10) : 7;
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;

        const result = await service.getInactiveMembers({ daysInactive, limit });
        res.status(200).json({
          status: 'success',
          data: result.members,
          summary: result.summary,
          total: result.total,
          daysInactiveThreshold: result.daysInactiveThreshold,
        });
      } catch (err) {
        next(err);
      }
    },

    async recordFollowUp(req, res, next) {
      try {
        const memberId = req.params.id;
        const staffId = req.user?.uid;
        const result = await service.recordMemberFollowUp(memberId, staffId, req.body);
        res.status(201).json({
          status: 'success',
          message: 'Follow-up outreach recorded successfully',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },
  };
};

export const memberController = createMemberController();

