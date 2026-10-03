import { z } from 'zod';
import { BLOOD_GROUPS, COMPONENT_TYPES } from '../config/constants.js';

export const forecastQuerySchema = z.object({
    bloodGroup: z.enum(BLOOD_GROUPS),
    component: z.string().trim().min(1).max(40).transform(value => value.toUpperCase().replace(/[\s-]+/g, '_'))
        .refine(value => COMPONENT_TYPES.includes(value), 'Unsupported blood component'),
    horizon: z.coerce.number().int().min(1).max(90).default(7),
    historicalDays: z.coerce.number().int().min(7).max(365).default(90)
});