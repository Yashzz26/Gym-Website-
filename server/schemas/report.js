/**
 * schemas/report.js — Validation schemas for Daily & Weekly Report APIs (Day 26 Task 51)
 */

import { z } from 'zod';

export const dailyReportQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  gymId: z.string().optional().default('fitmax-main'),
});

export const weeklyReportQuerySchema = z.object({
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'EndDate must be in YYYY-MM-DD format')
    .optional(),
  days: z.coerce.number().int().min(1).max(30).optional().default(7),
  gymId: z.string().optional().default('fitmax-main'),
});

export const reportExportQuerySchema = z.object({
  type: z.enum(['daily', 'weekly']).optional().default('daily'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'EndDate must be in YYYY-MM-DD format')
    .optional(),
  gymId: z.string().optional().default('fitmax-main'),
});
