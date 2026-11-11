import { z } from 'zod';

export const createPlanSchema = z.object({
  name: z.string().trim().min(2, 'Plan name must be at least 2 characters').max(80),
  durationMonths: z.coerce.number().int().min(1, 'Duration must be at least 1 month').max(36),
  durationDays: z.coerce.number().int().min(1).max(1095).optional(),
  priceInPaise: z.coerce
    .number()
    .int('Price must be an integer amount in paise')
    .min(10000, 'Price must be at least ₹100 (10000 paise)')
    .max(10000000, 'Price cannot exceed ₹1,00,000 (10000000 paise)'),
  features: z
    .array(z.string().trim().min(1, 'Feature item cannot be empty'))
    .min(1, 'At least one plan feature must be included'),
  description: z.string().trim().max(300).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  displayOrder: z.coerce.number().int().min(0).default(0),
  badge: z.string().trim().max(30).optional().or(z.literal('')),
});

export const updatePlanSchema = createPlanSchema.partial();

export const updatePlanStatusSchema = z.object({
  isActive: z.boolean(),
});
