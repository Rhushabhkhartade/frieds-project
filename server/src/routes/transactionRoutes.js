import { Router } from 'express';
import * as transactionController from '../controllers/transactionController.js';
import { validateBody, validateQuery } from '../middlewares/validate.js';
import {
  createTransactionSchema,
  transactionQuerySchema
} from '../models/transactionSchema.js';

const router = Router();

router.get('/', validateQuery(transactionQuerySchema), transactionController.listTransactions);
router.get('/:id', transactionController.getTransactionById);
router.post('/', validateBody(createTransactionSchema), transactionController.createTransaction);

export default router;
