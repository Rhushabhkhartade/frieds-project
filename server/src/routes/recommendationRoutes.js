import { Router } from 'express';
import * as recommendationController from '../controllers/recommendationController.js';
import { validateBody, validateQuery } from '../middlewares/validate.js';
import { requireAuth, requireStaff } from '../middlewares/auth.js';
import {
    recommendationQuerySchema,
    updateRecommendationStatusSchema
} from '../models/recommendationSchema.js';

const router = Router();

router.use(requireAuth, requireStaff);

// Refresh endpoint mounted before /:id route
router.post('/refresh', recommendationController.refreshRecommendations);

router.get('/', validateQuery(recommendationQuerySchema), recommendationController.listRecommendations);
router.put('/:id/status', validateBody(updateRecommendationStatusSchema), recommendationController.updateStatus);

export default router;