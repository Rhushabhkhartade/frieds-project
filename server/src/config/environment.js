import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(
    import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// In production, enforce that JWT_SECRET is explicitly provided and strong
if (process.env.NODE_ENV === 'production') {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32 || secret.includes('fallback') || secret.includes('dev_secret')) {
        throw new Error(
            'FATAL CONFIGURATION ERROR: In production mode, JWT_SECRET must be explicitly set in the environment and contain at least 32 characters.'
        );
    }
}

export const env = {
    PORT: parseInt(process.env.PORT || '5000', 10),
    HOST: process.env.HOST || '0.0.0.0',
    NODE_ENV: process.env.NODE_ENV || 'development',
    JWT_SECRET: process.env.JWT_SECRET || 'blood_ai_dev_fallback_secret_must_be_overridden_in_prod_2026',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    DATA_DIR: process.env.DATA_DIR || './data',
    ML_SERVICE_URL: process.env.ML_SERVICE_URL || 'http://localhost:5001',
    FORECAST_PROVIDER: process.env.FORECAST_PROVIDER || 'statistical',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
};