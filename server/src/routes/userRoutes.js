import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

/**
 * GET /api/v1/users/me
 * Returns currently authenticated user (convenience endpoint identical to /api/v1/auth/me)
 */
router.get('/me', requireAuth, (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user
  });
});

export default router;
