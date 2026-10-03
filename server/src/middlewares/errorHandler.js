import { env } from '../config/environment.js';
import { logger } from '../utils/logger.js';

/**
 * Base Application Error
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, 'RESOURCE_NOT_FOUND', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict or duplicate code', errorCode = 'CONFLICT_ERROR', details = null) {
    super(message, 409, errorCode, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', errorCode = 'BAD_REQUEST', details = null) {
    super(message, 400, errorCode, details);
  }
}

/**
 * Centralized Express Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
  const message = err.message || 'An unexpected error occurred.';

  // Log error without polluting console in standard operational scenarios
  if (statusCode >= 500) {
    logger.error(`[${req.method} ${req.originalUrl}] - ${message}`, err.stack);
  } else {
    logger.warn(`[${req.method} ${req.originalUrl}] (${statusCode} ${errorCode}) - ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      ...(err.details && { details: err.details })
    },
    timestamp: new Date().toISOString()
  });
};
