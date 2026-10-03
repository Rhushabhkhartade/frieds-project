import { Router } from 'express';
import * as alertController from '../controllers/alertController.js';
import { validateBody, validateQuery } from '../middlewares/validate.js';
import { requireAuth, requireStaff } from '../middlewares/auth.js';
import { alertQuerySchema, alertReadSchema, resolveAlertSchema } from '../models/alertSchema.js';

const router = Router();

// Refresh endpoint mounted before /:id parameter route
router.use(requireAuth, requireStaff);

router.post('/refresh', alertController.refreshAlerts);
router.get('/summary', alertController.getAlertSummary);
router.get('/', validateQuery(alertQuerySchema), alertController.listAlerts);
router.get('/:id', alertController.getAlertById);
router.put('/:id/read', validateBody(alertReadSchema), alertController.setAlertReadState);
router.put('/:id/resolve', validateBody(resolveAlertSchema), alertController.resolveAlert);

export default router;