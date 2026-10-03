import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/userRepository.js';
import { env } from '../config/environment.js';
import { ConflictError, BadRequestError, AppError } from '../middlewares/errorHandler.js';

const SALT_ROUNDS = 10;

class AuthService {
  /**
   * Register a new user.
   * - Validates uniqueness of email
   * - Hashes password with bcrypt
   * - Never stores or returns plaintext password
   */
  async register({ fullName, email, password, role, facility }) {
    // Check for duplicate email
    const existing = await userRepository.findByEmail(email, false);
    if (existing) {
      // Generic message — do not confirm whether email exists
      throw new ConflictError(
        'An account with this email address already exists.',
        'EMAIL_ALREADY_EXISTS'
      );
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const now = new Date().toISOString();

    const userRecord = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      fullName: fullName.trim(),
      name: fullName.trim(), // legacy compatibility
      email: email.trim().toLowerCase(),
      passwordHash,
      role: role || 'STAFF',
      facility: facility || 'General Blood Bank',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };

    const created = await userRepository.create(userRecord);
    return created; // passwordHash already stripped by repository
  }

  /**
   * Authenticate a user and return a signed JWT.
   * Uses a generic error for both "not found" and "wrong password"
   * to avoid leaking which emails are registered.
   */
  async login({ email, password }) {
    const GENERIC_ERROR = 'Invalid email or password.';

    const user = await userRepository.findByEmail(email, true); // need hash
    if (!user) {
      throw new BadRequestError(GENERIC_ERROR, 'INVALID_CREDENTIALS');
    }

    if (user.status && user.status !== 'ACTIVE') {
      throw new BadRequestError(
        'This account has been suspended. Please contact an administrator.',
        'ACCOUNT_SUSPENDED'
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new BadRequestError(GENERIC_ERROR, 'INVALID_CREDENTIALS');
    }

    const token = this._signToken(user);
    const { passwordHash, ...safeUser } = user;
    void passwordHash;

    return { token, user: safeUser };
  }

  /**
   * Return the currently authenticated user from a verified token.
   */
  async getMe(userId) {
    const user = await userRepository.findById(userId, false);
    if (!user) {
      throw new AppError('Authenticated user no longer exists.', 401, 'AUTH_REQUIRED');
    }
    return user;
  }

  /**
   * Sign a JWT — secret is always read from env, never hardcoded.
   */
  _signToken(user) {
    const secret = env.JWT_SECRET;
    if (!secret || secret.length < 16) {
      throw new AppError(
        'JWT_SECRET is missing or too short in the server configuration.',
        500,
        'CONFIGURATION_ERROR'
      );
    }
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      secret,
      { expiresIn: env.JWT_EXPIRES_IN || '7d' }
    );
  }

  /**
   * Verify a raw token string and return the decoded payload.
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Your session has expired. Please sign in again.', 401, 'TOKEN_EXPIRED');
      }
      throw new AppError('Invalid or malformed authentication token.', 401, 'INVALID_TOKEN');
    }
  }
}

export const authService = new AuthService();
