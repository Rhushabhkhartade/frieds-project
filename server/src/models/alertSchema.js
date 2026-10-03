import { z } from 'zod';
import { ALERT_TYPE_LIST, ALERT_SEVERITIES, ALERT_STATUSES } from '../config/constants.js';

export const resolveAlertSchema = z.object({
    reason: z.string().optional(),
    resolvedBy: z.string().optional()
});

export const alertReadSchema = z.object({
    isRead: z.boolean().default(true)
});

export const alertQuerySchema = z.object({
    status: z.enum(Object.values(ALERT_STATUSES)).optional(),
    severity: z.enum(Object.values(ALERT_SEVERITIES)).optional(),
    type: z.enum(ALERT_TYPE_LIST).optional(),
    bloodGroup: z.string().optional(),
    readState: z.enum(['READ', 'UNREAD']).optional(),
    source: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
});