/**
 * controllers/workoutController.js — Controller for Workout Plans & Exercise Logs (Day 20 Task 39)
 */

import { workoutService as defaultService } from '../services/workoutService.js';

export const createWorkoutController = (service = defaultService) => {
  return {
    /**
     * POST /api/workouts/plans
     * Create a workout plan for an assigned member (Trainer / Owner).
     */
    async createPlan(req, res, next) {
      try {
        const creatorUid = req.user.uid;
        const userRole = req.profile?.role || req.user?.role || 'trainer';

        const plan = await service.createWorkoutPlan(creatorUid, req.body, {
          uid: creatorUid,
          role: userRole,
        });

        res.status(201).json({
          status: 'success',
          message: 'Workout plan created successfully',
          data: plan,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * PUT /api/workouts/plans/:planId
     * Update an existing workout plan (Trainer / Owner).
     */
    async updatePlan(req, res, next) {
      try {
        const userRole = req.profile?.role || req.user?.role || 'trainer';
        const plan = await service.updateWorkoutPlan(req.params.planId, req.body, {
          uid: req.user.uid,
          role: userRole,
        });

        res.status(200).json({
          status: 'success',
          message: 'Workout plan updated successfully',
          data: plan,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * DELETE /api/workouts/plans/:planId
     * Delete a workout plan (Trainer / Owner).
     */
    async deletePlan(req, res, next) {
      try {
        const userRole = req.profile?.role || req.user?.role || 'trainer';
        const result = await service.deleteWorkoutPlan(req.params.planId, {
          uid: req.user.uid,
          role: userRole,
        });

        res.status(200).json({
          status: 'success',
          message: 'Workout plan deleted successfully',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/workouts/plans
     * List workout plans (filterable by memberId, weekDay).
     */
    async listPlans(req, res, next) {
      try {
        const userRole = req.profile?.role || req.user?.role || 'member';
        const plans = await service.getWorkoutPlans(req.query, {
          uid: req.user.uid,
          role: userRole,
        });

        res.status(200).json({
          status: 'success',
          results: plans.length,
          data: plans,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/workouts/plans/:planId
     * Fetch single workout plan by ID.
     */
    async getPlanById(req, res, next) {
      try {
        const userRole = req.profile?.role || req.user?.role || 'member';
        const plan = await service.getWorkoutPlanById(req.params.planId, {
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
     * POST /api/workouts/logs
     * Log daily exercise completion (Member / Trainer).
     */
    async logCompletion(req, res, next) {
      try {
        const userRole = req.profile?.role || req.user?.role || 'member';
        const log = await service.logWorkoutCompletion(req.user.uid, req.body, {
          uid: req.user.uid,
          role: userRole,
        });

        res.status(200).json({
          status: 'success',
          message: 'Workout progress recorded successfully',
          data: log,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/workouts/logs
     * Get workout completion history.
     */
    async listLogs(req, res, next) {
      try {
        const userRole = req.profile?.role || req.user?.role || 'member';
        const logs = await service.getWorkoutLogs(req.query, {
          uid: req.user.uid,
          role: userRole,
        });

        res.status(200).json({
          status: 'success',
          results: logs.length,
          data: logs,
        });
      } catch (err) {
        next(err);
      }
    },
  };
};

export const workoutController = createWorkoutController();
export default workoutController;
