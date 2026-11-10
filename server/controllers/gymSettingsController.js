/**
 * controllers/gymSettingsController.js — Controller for Gym Settings endpoints
 */

import { gymSettingsService as defaultService } from '../services/gymSettingsService.js';

export const createGymSettingsController = (service = defaultService) => {
  return {
    async getSettings(_req, res, next) {
      try {
        const settings = await service.getSettings();
        res.status(200).json({
          status: 'success',
          data: settings,
        });
      } catch (err) {
        next(err);
      }
    },

    async updateSettings(req, res, next) {
      try {
        const updatedBy = req.user?.uid || 'anonymous-owner';
        const settings = await service.updateSettings(req.body, updatedBy);

        res.status(200).json({
          status: 'success',
          message: 'Gym settings updated successfully',
          data: settings,
        });
      } catch (err) {
        next(err);
      }
    },
  };
};

export const gymSettingsController = createGymSettingsController();

