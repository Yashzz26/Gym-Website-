/**
 * schemas/whatsapp.js — Validation schemas for WhatsApp Cloud API Foundation (Day 24 Task 48)
 */

import { z } from 'zod';

export const previewTemplateSchema = z.object({
  to: z
    .string({ required_error: 'Recipient phone number is required' })
    .trim()
    .min(7, 'Phone number is too short')
    .max(25, 'Phone number is too long'),
  templateName: z
    .string({ required_error: 'Template name is required' })
    .trim()
    .min(1, 'Template name cannot be empty'),
  languageCode: z.enum(['en_US', 'hi']).default('en_US'),
  variables: z.array(z.union([z.string(), z.number()]).transform((v) => String(v))).default([]),
  buttonParams: z.array(z.string()).default([]),
});
