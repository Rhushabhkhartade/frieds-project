import { Router } from 'express';
import { requireAuth, requireStaff } from '../middlewares/auth.js';
import { validateQuery } from '../middlewares/validate.js';
import { forecastQuerySchema } from '../models/forecastSchema.js';
import { getForecast } from '../controllers/forecastController.js';

const router = Router();

router.get('/', requireAuth, requireStaff, validateQuery(forecastQuerySchema), getForecast);

export default router;