/**
 * schemas/reminder.js — Validation schemas for automated reminder jobs (Day 25 Task 50)
 */

import { z } from 'zod';

export const runRenewalReminderSchema = z.object({
  days: z.coerce.number().min(1).max(30).default(3),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'targetDate must be YYYY-MM-DD').optional(),
  dryRun: z.boolean().default(false),
});

export const runInactiveReminderSchema = z.object({
  daysInactive: z.coerce.number().min(1).max(90).default(7),
  minDaysBetweenReminders: z.coerce.number().min(1).max(30).default(7),
  dryRun: z.boolean().default(false),
});

export const runAllRemindersSchema = z.object({
  renewalDays: z.coerce.number().min(1).max(30).default(3),
  inactiveDays: z.coerce.number().min(1).max(90).default(7),
  dryRun: z.boolean().default(false),
});

export const reminderLogsQuerySchema = z.object({
  jobType: z.enum(['renewal_reminder', 'inactive_followup']).optional(),
  memberId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});
