import { z } from 'zod';
import { BLOOD_GROUPS, COMPONENT_TYPES, UNIT_STATUS_LIST } from '../config/constants.js';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createUnitSchema = z.object({
  unitCode: z.string().trim().min(3, 'Unit code must be at least 3 characters').optional(),
  unitNumber: z.string().trim().min(3, 'Unit number must be at least 3 characters').optional(),
  bloodGroup: z.enum(BLOOD_GROUPS, {
    errorMap: () => ({ message: `Blood group must be one of: ${BLOOD_GROUPS.join(', ')}` })
  }),
  component: z.enum(COMPONENT_TYPES).optional(),
  componentType: z.enum(COMPONENT_TYPES).optional(),
  collectionDate: z.string().regex(dateRegex, 'Collection date must be in YYYY-MM-DD format'),
  expiryDate: z.string().regex(dateRegex, 'Expiry date must be in YYYY-MM-DD format'),
  volume: z.number().positive('Volume must be a positive number').optional(),
  volumeMl: z.number().positive('Volume must be a positive number').optional(),
  status: z.enum(UNIT_STATUS_LIST).default('AVAILABLE'),
  storageLocation: z.union([
    z.string(),
    z.object({
      refrigerator: z.string().optional(),
      shelf: z.string().optional(),
      temperatureCelsius: z.number().optional()
    })
  ]).optional(),
  donor: z.string().optional(),
  donorReference: z.string().optional(),
  notes: z.string().optional()
}).refine(data => data.unitCode || data.unitNumber, {
  message: 'Either unitCode or unitNumber is required',
  path: ['unitCode']
}).refine(data => data.component || data.componentType, {
  message: 'Either component or componentType is required',
  path: ['component']
}).refine(data => data.volume !== undefined || data.volumeMl !== undefined, {
  message: 'Volume is required',
  path: ['volume']
}).refine(data => {
  const coll = new Date(data.collectionDate);
  const exp = new Date(data.expiryDate);
  return exp > coll;
}, {
  message: 'Expiry date must be after collection date',
  path: ['expiryDate']
});

export const updateUnitSchema = z.object({
  unitCode: z.string().trim().min(3).optional(),
  unitNumber: z.string().trim().min(3).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  component: z.enum(COMPONENT_TYPES).optional(),
  componentType: z.enum(COMPONENT_TYPES).optional(),
  collectionDate: z.string().regex(dateRegex, 'Collection date must be YYYY-MM-DD').optional(),
  expiryDate: z.string().regex(dateRegex, 'Expiry date must be YYYY-MM-DD').optional(),
  volume: z.number().positive().optional(),
  volumeMl: z.number().positive().optional(),
  status: z.enum(UNIT_STATUS_LIST).optional(),
  storageLocation: z.union([
    z.string(),
    z.object({
      refrigerator: z.string().optional(),
      shelf: z.string().optional(),
      temperatureCelsius: z.number().optional()
    })
  ]).optional(),
  donor: z.string().optional(),
  donorReference: z.string().optional(),
  notes: z.string().optional()
}).refine(data => {
  if (data.collectionDate && data.expiryDate) {
    return new Date(data.expiryDate) > new Date(data.collectionDate);
  }
  return true;
}, {
  message: 'Expiry date must be after collection date',
  path: ['expiryDate']
});

export const inventoryQuerySchema = z.object({
  bloodGroup: z.string().optional(),
  component: z.string().optional(),
  status: z.string().optional(),
  expiryBefore: z.string().regex(dateRegex, 'expiryBefore must be YYYY-MM-DD').optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
