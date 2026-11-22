/**
 * controllers/dietController.js — Controller for Diet & Nutrition Plans (Day 21 Task 41)
 */

import defaultDietService from '../services/dietService.js';

export const createDietController = (service = defaultDietService) => {
  return {
    /**
     * POST /api/diet/plans
     * Create a diet plan for an assigned member (Trainer / Owner).
     */
    async createPlan(req, res, next) {
      try {
        const creatorUid = req.user.uid;
        const userRole = req.profile?.role || req.user?.role || 'trainer';

        const plan = await service.createDietPlan(creatorUid, req.body, {
          uid: creatorUid,
          role: userRole,
        });

        res.status(201).json({
          status: 'success',
          message: 'Diet plan created successfully',
          data: plan,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * PUT /api/diet/plans/:planId
     * Update an existing diet plan (Trainer / Owner).
     */
    async updatePlan(req, res, next) {
      try {
        const userRole = req.profile?.role || req.user?.role || 'trainer';
        const plan = await service.updateDietPlan(req.user.uid, req.params.planId, req.body, {
          uid: req.user.uid,
          role: userRole,
        });

        res.status(200).json({
          status: 'success',
          message: 'Diet plan updated successfully',
          data: plan,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * DELETE /api/diet/plans/:planId
     * Delete a diet plan (Trainer / Owner).
     */
    async deletePlan(req, res, next) {
      try {
        const userRole = req.profile?.role || req.user?.role || 'trainer';
        const result = await service.deleteDietPlan(req.params.planId, {
          uid: req.user.uid,
          role: userRole,
        });

        res.status(200).json({
          status: 'success',
          message: 'Diet plan deleted successfully',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/diet/plans
     * List diet plans.
     */
    async listPlans(req, res, next) {
      try {
        const userRole = req.profile?.role || req.user?.role || 'member';
        const filters = {
          memberId: req.query.memberId,
        };

        const plans = await service.getDietPlans(
          { uid: req.user.uid, role: userRole },
          filters
        );

        res.status(200).json({
          status: 'success',
          data: plans,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/diet/plans/:planId
     * Retrieve a single diet plan by ID.
     */
    async getPlanById(req, res, next) {
      try {
        const userRole = req.profile?.role || req.user?.role || 'member';
        const plan = await service.getDietPlanById(req.params.planId, {
          uid: req.user.uid,
          role: userRole,
        });

        res.status(200).json({
          status: 'success',
          data: plan,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/diet/members/:memberId/active
     * Retrieve the active diet plan for a member.
     */
    async getMemberActivePlan(req, res, next) {
      try {
        const userRole = req.profile?.role || req.user?.role || 'member';
        const plan = await service.getMemberActiveDietPlan(req.params.memberId, {
          uid: req.user.uid,
          role: userRole,
        });

        res.status(200).json({
          status: 'success',
          data: plan,
        });
      } catch (err) {
        next(err);
      }
    },
  };
};

export default createDietController();
