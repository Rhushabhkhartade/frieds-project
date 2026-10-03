import { z } from 'zod';
import { USER_ROLES } from '../config/constants.js';

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(80, 'Full name must not exceed 80 characters'),
  email: z
    .string()
    .trim()
    .email('Please provide a valid email address')
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z
    .string()
    .min(1, 'Confirm password is required'),
  role: z
    .enum(USER_ROLES, {
      errorMap: () => ({ message: `Role must be one of: ${USER_ROLES.join(', ')}` })
    })
    .default('STAFF'),
  facility: z
    .string()
    .trim()
    .max(100)
    .optional()
    .default('General Blood Bank')
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Please provide a valid email address')
    .toLowerCase(),
  password: z
    .string()
    .min(1, 'Password is required')
});
