import { Router } from 'express';
import * as bloodGroupController from '../controllers/bloodGroupController.js';

const router = Router();

router.get('/', bloodGroupController.getAllBloodGroups);
router.get('/:group', bloodGroupController.getBloodGroupByCode);

export default router;
