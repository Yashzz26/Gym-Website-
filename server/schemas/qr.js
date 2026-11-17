/**
 * schemas/qr.js — Validation Schemas for QR Token Operations (Day 16 Task 31)
 */

import { z } from 'zod';

export const validateQrSchema = z.object({
  token: z
    .string({ required_error: 'QR token is required' })
    .min(1, 'QR token cannot be empty'),
  gymId: z.string().optional(),
});

export const rotateQrSchema = z.object({
  gymId: z.string().optional(),
  ttlSeconds: z.number().int().min(10).max(3600).optional(),
});
