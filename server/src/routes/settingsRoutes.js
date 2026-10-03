import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { validateBody } from '../middlewares/validate.js';
import { updateSettingsSchema } from '../models/settingsSchema.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';

const router = Router();

router.get('/', settingsController.getSettings);
router.put('/', requireAuth, requireAdmin, validateBody(updateSettingsSchema), settingsController.updateSettings);

export default router;
