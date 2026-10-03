import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/environment.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { logger } from './utils/logger.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import bloodGroupRoutes from './routes/bloodGroupRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import userRoutes from './routes/userRoutes.js';
import forecastRoutes from './routes/forecastRoutes.js';
import { getSystemStatus } from './controllers/systemController.js';
import { alertService } from './services/alertService.js';

const app = express();

// Security HTTP headers
app.use(helmet({
    crossOriginResourcePolicy: false
}));

// CORS configuration
app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// HTTP Request logging
if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
}

// Body parsing with 1MB limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health Check Endpoint (Root Level)
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        service: 'BLOOD AI API',
        status: 'healthy',
        environment: env.NODE_ENV,
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// API v1 Base Router
const apiV1Router = express.Router();

// Health Check Endpoint (under /api/v1/health)
apiV1Router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        service: 'BLOOD AI API v1',
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// System Status Endpoint
apiV1Router.get('/system/status', getSystemStatus);

// Mount Domain Resource Routes
apiV1Router.use('/auth', authRoutes);
apiV1Router.use('/inventory', inventoryRoutes);
apiV1Router.use('/blood-groups', bloodGroupRoutes);
apiV1Router.use('/transactions', transactionRoutes);
apiV1Router.use('/alerts', alertRoutes);
apiV1Router.use('/recommendations', recommendationRoutes);
apiV1Router.use('/settings', settingsRoutes);
apiV1Router.use('/users', userRoutes);
apiV1Router.use('/forecast', forecastRoutes);

// Mount /api/v1 router
app.use('/api/v1', apiV1Router);

// 404 Route Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'ROUTE_NOT_FOUND',
            message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist.`
        },
        timestamp: new Date().toISOString()
    });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start server if executed directly
const PORT = env.PORT;
const server = app.listen(PORT, () => {
    logger.info(`BLOOD AI Backend running on port ${PORT} [${env.NODE_ENV}]`);
    logger.info(`Health check available at http://localhost:${PORT}/health`);
    logger.info(`API v1 mounted at http://localhost:${PORT}/api/v1`);
    alertService.refreshAlerts().catch(err => {
        logger.error(`Initial inventory alert refresh failed: ${err.message}`);
    });
});

export default app;