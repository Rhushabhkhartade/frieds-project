import { z } from 'zod';
import { TRANSACTION_OPERATION_LIST } from '../config/constants.js';

export const createTransactionSchema = z.object({
  unitId: z.string().trim().min(1, 'Unit ID is required'),
  operation: z.enum(TRANSACTION_OPERATION_LIST, {
    errorMap: () => ({ message: `Operation must be one of: ${TRANSACTION_OPERATION_LIST.join(', ')}` })
  }),
  actor: z.string().trim().min(1, 'Actor is required').default('staff_admin'),
  recipientOrHospital: z.string().optional(),
  notes: z.string().optional()
});

export const transactionQuerySchema = z.object({
  unitId: z.string().optional(),
  bloodGroup: z.string().optional(),
  operation: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
