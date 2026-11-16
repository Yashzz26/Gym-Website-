/**
 * schemas/manualPayment.js — Validation Schemas for Cash & Manual UPI Payments
 *
 * Manual payments are recorded by authorized reception or owner staff only.
 * Amount is accepted as paise (integer) and must be >= 100 paise (₹1.00).
 */

import { z } from 'zod';

/** Allowed payment methods for manual (non-Razorpay) payments */
export const MANUAL_PAYMENT_METHODS = ['cash', 'upi'];

/**
 * Schema for recording a new cash or manual UPI payment.
 * Staff supply the member ID, plan ID and cash amount collected.
 * Server fetches plan price for audit; amount is cross-validated against plan.
 */
export const recordManualPaymentSchema = z.object({
  memberId: z
    .string({ required_error: 'Member ID is required' })
    .trim()
    .min(1, 'Member ID cannot be empty'),

  planId: z
    .string({ required_error: 'Membership plan ID is required' })
    .trim()
    .min(1, 'Plan ID cannot be empty'),

  method: z.enum(MANUAL_PAYMENT_METHODS, {
    required_error: 'Payment method is required',
    invalid_type_error: `Payment method must be one of: ${MANUAL_PAYMENT_METHODS.join(', ')}`,
  }),

  /**
   * Amount received in integer paise.
   * Must match the plan price stored on the server.
   * Minimum 100 paise (₹1). No floating-point values permitted.
   */
  amountPaise: z
    .number({
      required_error: 'Amount in paise is required',
      invalid_type_error: 'Amount must be a number',
    })
    .int('Amount must be a whole number (integer paise, no decimals)')
    .min(100, 'Amount must be at least 100 paise (₹1.00)'),

  /** Optional UPI reference/transaction ID for manual UPI payments */
  upiReference: z
    .string()
    .trim()
    .max(100, 'UPI reference cannot exceed 100 characters')
    .optional(),

  /** Optional staff remarks / notes for this payment */
  remarks: z
    .string()
    .trim()
    .max(500, 'Remarks cannot exceed 500 characters')
    .optional(),

  /**
   * Whether this is a membership renewal or a new membership.
   * When true, server extends from existing membership end date.
   */
  isRenewal: z.boolean().optional().default(false),
});

/**
 * Schema for listing manual payments (query parameters).
 */
export const listManualPaymentsQuerySchema = z.object({
  memberId: z.string().trim().optional(),
  method: z.enum([...MANUAL_PAYMENT_METHODS, 'all']).optional().default('all'),
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a positive integer')
    .transform(Number)
    .refine((n) => n >= 1 && n <= 100, 'Limit must be between 1 and 100')
    .optional()
    .default('20'),
  startAfter: z.string().trim().optional(),
});
