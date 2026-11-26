/**
 * controllers/reminderController.js — Controller for Automated Reminder Jobs (Day 25 Task 50)
 */

import { reminderAutomationService as defaultService } from '../services/reminderAutomationService.js';

export const createReminderController = (service = defaultService) => {
  return {
    async runRenewalReminders(req, res, next) {
      try {
        const actorId = req.user?.uid || 'manual_trigger';
        const result = await service.runRenewalReminderJob({
          ...req.body,
          actorId,
        });

        res.status(200).json({
          status: 'success',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },

    async runInactiveReminders(req, res, next) {
      try {
        const actorId = req.user?.uid || 'manual_trigger';
        const result = await service.runInactiveMemberReminderJob({
          ...req.body,
          actorId,
        });

        res.status(200).json({
          status: 'success',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },

    async runAllReminders(req, res, next) {
      try {
        const actorId = req.user?.uid || 'manual_trigger';
        const result = await service.runAllDailyReminderJobs({
          ...req.body,
          actorId,
        });

        res.status(200).json({
          status: 'success',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },

    async getReminderLogs(req, res, next) {
      try {
        const logs = await service.getReminderLogs(req.query || {});
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

export const reminderController = createReminderController();
