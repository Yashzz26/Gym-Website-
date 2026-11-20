/**
 * controllers/trainerController.js — Controller for Trainer Assignments & Assigned Members (Day 19 Task 37)
 */

import { trainerService as defaultService } from '../services/trainerService.js';

export const createTrainerController = (service = defaultService) => {
  return {
    /**
     * POST /api/trainers/assign
     * Assign a member to a trainer (Owner or Reception).
     */
    async assignMember(req, res, next) {
      try {
        const assignerUid = req.user.uid;
        const assignment = await service.assignMember(assignerUid, req.body);

        res.status(201).json({
          status: 'success',
          message: 'Member assigned to trainer successfully',
          data: assignment,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /api/trainers/unassign
     * Unassign a member from their trainer (Owner or Reception).
     */
    async unassignMember(req, res, next) {
      try {
        const unassignerUid = req.user.uid;
        const result = await service.unassignMember(unassignerUid, req.body);

        res.status(200).json({
          status: 'success',
          message: 'Member unassigned from trainer successfully',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/trainers/members
     * Fetch list of assigned members for the requesting trainer (or owner query).
     */
    async getMyAssignedMembers(req, res, next) {
      try {
        const userRole = req.profile?.role || req.user?.role || 'trainer';
        const targetTrainerId =
          userRole === 'owner' && req.query.trainerId
            ? req.query.trainerId
            : req.user.uid;

        const members = await service.getAssignedMembers(targetTrainerId, {
          uid: req.user.uid,
          role: userRole,
        });

        res.status(200).json({
          status: 'success',
          results: members.length,
          data: members,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/trainers/members/:memberId
     * Fetch detailed profile, progress & attendance for a single assigned member.
     * Enforces trainer access only to assigned members!
     */
    async getAssignedMemberById(req, res, next) {
      try {
        const userRole = req.profile?.role || req.user?.role || 'trainer';
        const memberDetails = await service.getAssignedMemberDetails(
          req.params.memberId,
          {
            uid: req.user.uid,
            role: userRole,
          }
        );

        res.status(200).json({
          status: 'success',
          data: memberDetails,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * PATCH /api/trainers/members/:memberId/progress
     * Update fitness goal, current weight, target weight or notes.
     */
    async updateMemberProgress(req, res, next) {
      try {
        const userRole = req.profile?.role || req.user?.role || 'trainer';
        const updated = await service.updateMemberProgress(
          req.params.memberId,
          req.body,
          {
            uid: req.user.uid,
            role: userRole,
          }
        );

        res.status(200).json({
          status: 'success',
          message: 'Member fitness progress updated successfully',
          data: updated,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/trainers
     * List all available trainers in the gym.
     */
    async listTrainers(req, res, next) {
      try {
        const trainers = await service.listTrainers();

        res.status(200).json({
          status: 'success',
          results: trainers.length,
          data: trainers,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/trainers/assignments
     * List all assignment records.
     */
    async listAssignments(req, res, next) {
      try {
        const filter = { ...req.query };
        const userRole = req.profile?.role || req.user?.role || 'trainer';

        // Trainers can only query their own assignments
        if (userRole === 'trainer') {
          filter.trainerId = req.user.uid;
        }

        const assignments = await service.listAssignments(filter);

        res.status(200).json({
          status: 'success',
          results: assignments.length,
          data: assignments,
        });
      } catch (err) {
        next(err);
      }
    },
  };
};

export const trainerController = createTrainerController();
export default trainerController;
