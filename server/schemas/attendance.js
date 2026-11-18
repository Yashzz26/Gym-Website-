/**
 * schemas/attendance.js — Validation Schemas for Attendance Operations (Day 17 Task 34)
 */

import { z } from 'zod';

export const checkInSchema = z.object({
  token: z
    .string({ required_error: 'QR token is required' })
    .min(1, 'QR token cannot be empty'),
  gymId: z.string().optional().default('fitmax-main'),
});

export const attendanceQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
    .optional(),
  userId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export default {
  checkInSchema,
  attendanceQuerySchema,
};
