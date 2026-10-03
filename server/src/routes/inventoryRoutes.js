import { Router } from 'express';
import * as inventoryController from '../controllers/inventoryController.js';
import { validateBody, validateQuery } from '../middlewares/validate.js';
import {
  createUnitSchema,
  updateUnitSchema,
  inventoryQuerySchema
} from '../models/inventorySchema.js';

const router = Router();

// Summary endpoint must be placed before /:id route
router.get('/summary', inventoryController.getInventorySummary);

// Standard inventory CRUD endpoints
router.get('/', validateQuery(inventoryQuerySchema), inventoryController.listUnits);
router.get('/:id', inventoryController.getUnitById);
router.post('/', validateBody(createUnitSchema), inventoryController.createUnit);
router.put('/:id', validateBody(updateUnitSchema), inventoryController.updateUnit);
router.delete('/:id', inventoryController.deleteUnit);

export default router;
