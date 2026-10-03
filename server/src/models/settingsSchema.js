import { z } from 'zod';
import { BLOOD_GROUPS } from '../config/constants.js';

const thresholdItemSchema = z.object({
  critical: z.number().int().min(0, 'Critical threshold cannot be negative'),
  low: z.number().int().min(0, 'Low threshold cannot be negative'),
  ideal: z.number().int().min(0, 'Ideal threshold cannot be negative').optional()
}).refine(data => data.low >= data.critical, {
  message: 'Low threshold must be greater than or equal to critical threshold',
  path: ['low']
});

export const updateSettingsSchema = z.object({
  bloodBankName: z.string().trim().min(2, 'Blood bank name must be at least 2 characters').optional(),
  hospitalAffiliation: z.string().trim().optional(),
  facilityCode: z.string().trim().optional(),
  expiryNoticeDays: z.number().int().min(1, 'Expiry notice must be at least 1 day').max(60, 'Expiry notice cannot exceed 60 days').optional(),
  enableSoundAlerts: z.boolean().optional(),
  forecastingHorizonDefaultDays: z.enum([7, 14, 30]).or(z.literal(7)).or(z.literal(14)).or(z.literal(30)).optional(),
  thresholds: z.record(z.string(), thresholdItemSchema).optional()
}).refine(data => {
  if (data.thresholds) {
    const keys = Object.keys(data.thresholds);
    for (const k of keys) {
      if (!BLOOD_GROUPS.includes(k)) {
        return false;
      }
    }
  }
  return true;
}, {
  message: `Threshold blood groups must be valid: ${BLOOD_GROUPS.join(', ')}`,
  path: ['thresholds']
});
