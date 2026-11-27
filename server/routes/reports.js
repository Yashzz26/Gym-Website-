/**
 * routes/reports.js — Express Router for Owner Daily & Weekly Reports (Day 26 Task 51)
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import {
  requireRole as defaultRequireRole,
  requireActiveStatus as defaultRequireActiveStatus,
} from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import {
  dailyReportQuerySchema,
  weeklyReportQuerySchema,
  reportExportQuerySchema,
} from '../schemas/report.js';
import { reportController as defaultController } from '../controllers/reportController.js';

export const createReportsRouter = ({
  controller = defaultController,
  verifyToken = defaultVerifyToken,
  requireRole = defaultRequireRole,
  requireActiveStatus = defaultRequireActiveStatus,
} = {}) => {
  const router = Router();
  const allowOwner = requireRole('owner');

  // Daily revenue, attendance, dues and renewal report
  router.get(
    '/daily',
    verifyToken,
    allowOwner,
    requireActiveStatus,
    validate({ query: dailyReportQuerySchema }),
    controller.getDailyReport
  );

  // Weekly rolling trend report
  router.get(
    '/weekly',
    verifyToken,
    allowOwner,
    requireActiveStatus,
    validate({ query: weeklyReportQuerySchema }),
    controller.getWeeklyReport
  );

  // Tabular / CSV export data
  router.get(
    '/export',
    verifyToken,
    allowOwner,
    requireActiveStatus,
    validate({ query: reportExportQuerySchema }),
    controller.getExportData
  );

  return router;
};

export const reportsRouter = createReportsRouter();
export default reportsRouter;
