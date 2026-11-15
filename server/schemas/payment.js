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

export const verifyRazorpayPaymentSchema = z.object({
  razorpay_payment_id: z
    .string({ required_error: 'Razorpay Payment ID is required' })
    .trim()
    .min(1, 'Razorpay Payment ID cannot be empty'),
  razorpay_order_id: z
    .string({ required_error: 'Razorpay Order ID is required' })
    .trim()
    .min(1, 'Razorpay Order ID cannot be empty'),
  razorpay_signature: z
    .string({ required_error: 'Razorpay Signature is required' })
    .trim()
    .min(1, 'Razorpay Signature cannot be empty'),
});


