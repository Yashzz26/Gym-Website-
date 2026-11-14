/**
 * schemas/payment.js — Validation Schemas for Payments & Razorpay Orders
 */

import { z } from 'zod';

export const createRazorpayOrderSchema = z.object({
  planId: z
    .string({ required_error: 'Plan ID is required' })
    .trim()
    .min(1, 'Plan ID cannot be empty'),
  isRenewal: z
    .boolean()
    .optional()
    .default(false),
  notes: z
    .record(z.string(), z.any())
    .optional(),
});
