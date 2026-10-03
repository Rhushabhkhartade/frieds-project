import { authService } from '../services/authService.js';

/**
 * POST /api/v1/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({
      success: true,
      data: user,
      message: 'Account created successfully. Please sign in to continue.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { token, user } = await authService.login(req.body);
    res.status(200).json({
      success: true,
      data: { token, user },
      message: 'Login successful'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/logout
 * 
 * This API uses stateless JWTs — there is no server-side session store.
 * The client is responsible for discarding its token.
 * This endpoint exists as an explicit contract for the frontend logout flow
 * and returns a clear response confirming the expected client-side action.
 */
export const logout = async (req, res) => {
  res.status(200).json({
    success: true,
    data: null,
    message:
      'Logout acknowledged. Please remove the authentication token from your client. ' +
      'The token will remain technically valid until expiry — no server-side invalidation is applied in this stateless JWT implementation.'
  });
};

/**
 * GET /api/v1/auth/me
 * Requires valid JWT (enforced by requireAuth middleware).
 */
export const getMe = async (req, res, next) => {
  try {
    // req.user is already loaded and sanitized by the requireAuth middleware
    res.status(200).json({
      success: true,
      data: req.user
    });
  } catch (err) {
    next(err);
  }
};
