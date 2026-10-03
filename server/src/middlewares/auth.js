import { authService } from '../services/authService.js';
import { AppError } from './errorHandler.js';

/**
 * requireAuth
 * Reads Authorization: Bearer <token>, verifies the JWT, loads the user,
 * and attaches it to req.user. Returns 401 if anything is wrong.
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError(
        'Authentication is required. Please provide a valid Bearer token.',
        401,
        'AUTH_REQUIRED'
      );
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError('Bearer token is missing.', 401, 'AUTH_REQUIRED');
    }

    // Verify signature and expiry — throws on failure
    const decoded = authService.verifyToken(token);

    // Load current user record to ensure it still exists and is active
    const user = await authService.getMe(decoded.id);
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * requireRole(...roles)
 * Returns a middleware that checks req.user.role is in the allowed list.
 * Must be used after requireAuth.
 *
 * Usage:
 *   router.put('/settings', requireAuth, requireRole('ADMIN'), settingsController.update)
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication is required.', 401, 'AUTH_REQUIRED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. This action requires one of the following roles: ${roles.join(', ')}.`,
          403,
          'FORBIDDEN'
        )
      );
    }
    next();
  };
};

export const requireAdmin = requireRole('ADMIN');
export const requireStaff = requireRole('STAFF', 'ADMIN');
