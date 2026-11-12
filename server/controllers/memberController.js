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
        const membership = await service.getCurrentMembership(userId);

        res.status(200).json({
          status: 'success',
          data: membership,
        });
      } catch (err) {
        next(err);
      }
    },
  };
};

export const memberController = createMemberController();

