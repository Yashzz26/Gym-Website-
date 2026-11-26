/**
 * controllers/attendanceController.js — Controller for Member Attendance Operations (Day 17 Task 34)
 */

import { attendanceService as defaultService } from '../services/attendanceService.js';

export const createAttendanceController = (service = defaultService) => {
  return {
    /**
     * POST /api/attendance/check-in
     * Record an atomic attendance check-in for the authenticated member.
     */
    async checkIn(req, res, next) {
      try {
        const { token, gymId = 'fitmax-main' } = req.body;
        const userId = req.user.uid;
        const userEmail = req.user.email || null;

        const checkInResult = await service.recordCheckIn(userId, token, gymId, userEmail);

        res.status(201).json({
          status: 'success',
          message: 'Attendance recorded successfully',
          data: checkInResult,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/attendance/me
     * Fetch member's own past attendance records and streaks.
     */
    async getMyHistory(req, res, next) {
      try {
        const userId = req.user.uid;
        const userEmail = req.user.email || null;
        const limit = Number(req.query.limit) || 30;

        const history = await service.getMemberHistory(userId, limit, userEmail);

        res.status(200).json({
          status: 'success',
          results: history.length,
          data: history,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/attendance/today
     * Fetch daily attendance summary (Staff & Owner).
     */
    async getTodayAttendance(req, res, next) {
      try {
        const { date, gymId = 'fitmax-main' } = req.query;
        const summary = await service.getTodayAttendance(date, gymId);

        res.status(200).json({
          status: 'success',
          data: summary,
        });
      } catch (err) {
        next(err);
      }
    },
  };
};

export const attendanceController = createAttendanceController();
export default attendanceController;
