/**
 * Shared API contract — billing / subscriptions (`/api/v1/billing`).
 */
import { z } from 'zod';
import { uuidSchema } from './helpers';

export const subscriptionPlanSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  price: z.number(),
  currency: z.string().default('USD'),
  interval: z.string().default('month'),
  stripePriceId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createCheckoutSchema = z.object({
  planId: uuidSchema,
  successUrl: z.string().optional(),
  cancelUrl: z.string().optional(),
});

export const voucherRedeemSchema = z.object({
  code: z.string().min(1),
});

export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;
