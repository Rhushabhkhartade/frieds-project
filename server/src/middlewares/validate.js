import { ValidationError } from './errorHandler.js';

/**
 * Higher-order middleware to validate incoming request data using Zod schemas
 * @param {Object} schemas - { body?, query?, params? }
 */
export const validate = (schemas) => {
  return async (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      next();
    } catch (err) {
      if (err.errors) {
        const details = err.errors.map(e => ({
          field: e.path.join('.') || 'root',
          message: e.message
        }));
        return next(new ValidationError('Validation failed', details));
      }
      next(err);
    }
  };
};

export const validateBody = (schema) => validate({ body: schema });
export const validateQuery = (schema) => validate({ query: schema });
export const validateParams = (schema) => validate({ params: schema });
