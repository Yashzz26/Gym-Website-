/**
 * routes/attendance.js — Attendance Router (Day 17 Task 34)
 *
 * Implements endpoints:
 * - POST /api/attendance/check-in — Atomic member attendance check-in
 * - GET  /api/attendance/me       — Member check-in history & streak
 * - GET  /api/attendance/today    — Daily attendance summary for staff & owner
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import {
  requireRole as defaultRequireRole,
  requireActiveStatus as defaultRequireActiveStatus,
} from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { checkInSchema, attendanceQuerySchema } from '../schemas/attendance.js';
import { attendanceController as defaultController } from '../controllers/attendanceController.js';

export const createAttendanceRouter = ({
  controller = defaultController,
  verifyToken = defaultVerifyToken,
  requireRole = defaultRequireRole,
  requireActiveStatus = defaultRequireActiveStatus,
} = {}) => {
  const router = Router();

  const userGuard = [verifyToken, requireActiveStatus];
  const staffGuard = [verifyToken, requireRole('reception', 'trainer', 'owner'), requireActiveStatus];

  // 1. Member check-in via rotating QR token
  router.post(
    '/check-in',
    ...userGuard,
    validate({ body: checkInSchema }),
    controller.checkIn
  );

  // 2. Member's own attendance history & streak
  router.get(
    '/me',
    ...userGuard,
    controller.getMyHistory
  );

  // 3. Staff & Owner daily attendance overview
  router.get(
    '/today',
    ...staffGuard,
    validate({ query: attendanceQuerySchema }),
    controller.getTodayAttendance
  );

  return router;
};

export const attendanceRouter = createAttendanceRouter();
export default attendanceRouter;
