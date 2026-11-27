/**
 * controllers/reportController.js — Controller for Owner Analytics Reports (Day 26 Task 51)
 */

import { reportService as defaultService } from '../services/reportService.js';

export const createReportController = (service = defaultService) => {
  return {
    async getDailyReport(req, res, next) {
      try {
        const { date, gymId } = req.query || {};
        const report = await service.getDailyReport(date, gymId);

        res.status(200).json({
          status: 'success',
          data: report,
        });
      } catch (err) {
        next(err);
      }
    },

    async getWeeklyReport(req, res, next) {
      try {
        const { endDate, days, gymId } = req.query || {};
        const report = await service.getWeeklyReport(endDate, days ? Number(days) : 7, gymId);

        res.status(200).json({
          status: 'success',
          data: report,
        });
      } catch (err) {
        next(err);
      }
    },

    async getExportData(req, res, next) {
      try {
        const { type, date, endDate, gymId } = req.query || {};
        const exportData = await service.getExportData({ type, date, endDate, gymId });

        res.status(200).json({
          status: 'success',
          data: exportData,
        });
      } catch (err) {
        next(err);
      }
    },
  };
};

export const reportController = createReportController();
export default reportController;
