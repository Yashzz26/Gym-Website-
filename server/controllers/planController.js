/**
 * controllers/planController.js — Controller for Membership Plans endpoints
 */

import { planService as defaultService } from '../services/planService.js';

export const createPlanController = (service = defaultService) => {
  return {
    async listPlans(req, res, next) {
      try {
        const isOwner = req.profile?.role === 'owner';
        // If not owner, only return active plans
        const activeOnly = !isOwner || req.query.activeOnly === 'true';
        const plans = await service.listPlans({ activeOnly });

        res.status(200).json({
          status: 'success',
          results: plans.length,
          data: plans,
        });
      } catch (err) {
        next(err);
      }
    },

    async getPlan(req, res, next) {
      try {
        const plan = await service.getPlanById(req.params.id);
        res.status(200).json({
          status: 'success',
          data: plan,
        });
      } catch (err) {
        next(err);
      }
    },

    async createPlan(req, res, next) {
      try {
        const ownerUid = req.user?.uid || 'anonymous-owner';
        const plan = await service.createPlan(req.body, ownerUid);

        res.status(201).json({
          status: 'success',
          message: 'Membership plan created successfully',
          data: plan,
        });
      } catch (err) {
        next(err);
      }
    },

    async updatePlan(req, res, next) {
      try {
        const ownerUid = req.user?.uid || 'anonymous-owner';
        const plan = await service.updatePlan(req.params.id, req.body, ownerUid);

        res.status(200).json({
          status: 'success',
          message: 'Membership plan updated successfully',
          data: plan,
        });
      } catch (err) {
        next(err);
      }
    },

    async setPlanStatus(req, res, next) {
      try {
        const ownerUid = req.user?.uid || 'anonymous-owner';
        const plan = await service.setPlanStatus(req.params.id, req.body.isActive, ownerUid);

        res.status(200).json({
          status: 'success',
          message: `Membership plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`,
          data: plan,
        });
      } catch (err) {
        next(err);
      }
    },
  };
};

export const planController = createPlanController();

