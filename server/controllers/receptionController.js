/**
 * controllers/receptionController.js — Controller for Reception Desk endpoints
 */

import { receptionService as defaultService } from '../services/receptionService.js';

export const createReceptionController = (service = defaultService) => {
  return {
    async registerMember(req, res, next) {
      try {
        const staffUid = req.user?.uid || req.profile?.uid || 'reception-staff';
        const result = await service.registerMember(req.body, staffUid);

        res.status(201).json({
          status: 'success',
          message: 'Member registered successfully',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },

    async listMembers(req, res, next) {
      try {
        const members = await service.listMembers();
        res.status(200).json({
          status: 'success',
          results: members.length,
          data: members,
        });
      } catch (err) {
        next(err);
      }
    },
  };
};

export const receptionController = createReceptionController();

