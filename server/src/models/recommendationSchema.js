import { z } from 'zod';
import { BLOOD_GROUPS, COMPONENT_TYPES, RECOMMENDATION_PRIORITIES, RECOMMENDATION_STATUSES, RECOMMENDATION_TYPES } from '../config/constants.js';

export const updateRecommendationStatusSchema = z.object({
    status: z.enum(Object.values(RECOMMENDATION_STATUSES), {
        errorMap: () => ({ message: `Status must be one of: ${Object.values(RECOMMENDATION_STATUSES).join(', ')}` })
    }),
    notes: z.string().trim().max(500).optional()
});

export const recommendationQuerySchema = z.object({
    status: z.enum(Object.values(RECOMMENDATION_STATUSES)).optional(),
    priority: z.enum(Object.values(RECOMMENDATION_PRIORITIES)).optional(),
    type: z.enum(Object.values(RECOMMENDATION_TYPES)).optional(),
    bloodGroup: z.enum(BLOOD_GROUPS).optional(),
    component: z.string().trim().transform(value => value.toUpperCase().replace(/[\s-]+/g, '_')).refine(value => COMPONENT_TYPES.includes(value), 'Unsupported blood component').optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
});