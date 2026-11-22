/**
 * schemas/diet.js — Validation Schemas for Diet Plans & Nutrition Management (Day 21 Task 41)
 */

import { z } from 'zod';

/**
 * Macro nutrient schema (in grams).
 */
export const macroSchema = z.object({
  protein: z
    .number({ required_error: 'Protein target (grams) is required' })
    .nonnegative('Protein cannot be negative')
    .max(1000, 'Protein cannot exceed 1000g'),

  carbs: z
    .number({ required_error: 'Carbohydrates target (grams) is required' })
    .nonnegative('Carbohydrates cannot be negative')
    .max(2000, 'Carbohydrates cannot exceed 2000g'),

  fat: z
    .number({ required_error: 'Fat target (grams) is required' })
    .nonnegative('Fat cannot be negative')
    .max(500, 'Fat cannot exceed 500g'),

  fiber: z
    .number()
    .nonnegative('Fiber cannot be negative')
    .max(200, 'Fiber cannot exceed 200g')
    .optional()
    .nullable(),
});

/**
 * Individual food item within a meal.
 */
export const foodItemSchema = z.object({
  name: z
    .string({ required_error: 'Food item name is required' })
    .trim()
    .min(2, 'Food item name must be at least 2 characters')
    .max(120, 'Food item name cannot exceed 120 characters'),

  quantity: z
    .string({ required_error: 'Portion/quantity is required (e.g. "200g", "2 boiled eggs")' })
    .trim()
    .min(1, 'Quantity cannot be empty')
    .max(80, 'Quantity description cannot exceed 80 characters'),

  calories: z
    .number()
    .nonnegative('Calories cannot be negative')
    .max(5000, 'Calories for single item cannot exceed 5000')
    .optional()
    .nullable(),

  protein: z
    .number()
    .nonnegative('Protein cannot be negative')
    .max(300, 'Protein cannot exceed 300g')
    .optional()
    .nullable(),

  carbs: z
    .number()
    .nonnegative('Carbs cannot be negative')
    .max(500, 'Carbs cannot exceed 500g')
    .optional()
    .nullable(),

  fat: z
    .number()
    .nonnegative('Fat cannot be negative')
    .max(200, 'Fat cannot exceed 200g')
    .optional()
    .nullable(),

  notes: z
    .string()
    .trim()
    .max(300, 'Food item notes cannot exceed 300 characters')
    .optional()
    .nullable(),
});

/**
 * Meal schedule item (e.g. Breakfast, Lunch, Post-Workout).
 */
export const mealSchema = z.object({
  name: z
    .string({ required_error: 'Meal name is required' })
    .trim()
    .min(2, 'Meal name must be at least 2 characters')
    .max(80, 'Meal name cannot exceed 80 characters'),

  time: z
    .string()
    .trim()
    .max(30, 'Meal time description cannot exceed 30 characters')
    .optional()
    .nullable(),

  targetCalories: z
    .number()
    .nonnegative('Target calories cannot be negative')
    .max(10000, 'Meal calories cannot exceed 10000')
    .optional()
    .nullable(),

  items: z
    .array(foodItemSchema, { required_error: 'At least one food item is required for each meal' })
    .min(1, 'At least one food item must be included in each meal'),

  notes: z
    .string()
    .trim()
    .max(500, 'Meal notes cannot exceed 500 characters')
    .optional()
    .nullable(),
});

/**
 * Create Diet Plan Schema (Trainers / Owners).
 */
export const createDietPlanSchema = z.object({
  memberId: z
    .string({ required_error: 'Member ID is required' })
    .trim()
    .min(1, 'Member ID cannot be empty'),

  title: z
    .string({ required_error: 'Diet plan title is required' })
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(120, 'Title cannot exceed 120 characters'),

  targetCalories: z
    .number({ required_error: 'Daily target calories is required' })
    .int('Calories must be an integer')
    .min(500, 'Target calories must be at least 500 kcal')
    .max(10000, 'Target calories cannot exceed 10,000 kcal'),

  macros: macroSchema,

  waterIntakeLiters: z
    .number()
    .min(0.5, 'Water intake must be at least 0.5 liters')
    .max(15, 'Water intake cannot exceed 15 liters')
    .optional()
    .nullable(),

  meals: z
    .array(mealSchema, { required_error: 'Meals breakdown is required' })
    .min(1, 'Diet plan must contain at least one meal'),

  notes: z
    .string()
    .trim()
    .max(1000, 'Diet plan notes cannot exceed 1000 characters')
    .optional()
    .nullable(),

  isActive: z.boolean().optional().default(true),
});

/**
 * Update Diet Plan Schema.
 */
export const updateDietPlanSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(120, 'Title cannot exceed 120 characters')
    .optional(),

  targetCalories: z
    .number()
    .int('Calories must be an integer')
    .min(500, 'Target calories must be at least 500 kcal')
    .max(10000, 'Target calories cannot exceed 10,000 kcal')
    .optional(),

  macros: macroSchema.optional(),

  waterIntakeLiters: z
    .number()
    .min(0.5, 'Water intake must be at least 0.5 liters')
    .max(15, 'Water intake cannot exceed 15 liters')
    .optional()
    .nullable(),

  meals: z
    .array(mealSchema)
    .min(1, 'Diet plan must contain at least one meal')
    .optional(),

  notes: z
    .string()
    .trim()
    .max(1000, 'Diet plan notes cannot exceed 1000 characters')
    .optional()
    .nullable(),

  isActive: z.boolean().optional(),
});
