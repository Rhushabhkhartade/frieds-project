import axios from 'axios';

/**
 * BLOOD AI API Service Client
 *
 * Preconfigured Axios instance with base URL, timeout,
 * and standard Bearer token interceptor architecture.
 */

const getApiBaseUrl = () => {
    if (import.meta.env.VITE_API_BASE_URL) {
        return import.meta.env.VITE_API_BASE_URL;
    }
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return 'https://blood-ai.onrender.com/api/v1';
    }
    return 'http://localhost:5000/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Request Interceptor: Attach JWT Bearer token if present
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('blood_ai_token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Format error envelopes and handle session expiration
apiClient.interceptors.response.use(
    (response) => response.data,
    (error) => {
        if (error.response) {
            const status = error.response.status;
            const responseData = error.response.data || {};
            const serverError = responseData.error || {
                message: responseData.message || 'Server error occurred'
            };

            if (status === 401) {
                const reqUrl = (error.config && error.config.url) || '';
                const isAuthRequest = reqUrl.includes('/auth/login') || reqUrl.includes('/auth/register');
                if (!isAuthRequest) {
                    localStorage.removeItem('blood_ai_token');
                    localStorage.removeItem('blood_ai_user');
                    if (typeof window !== 'undefined') {
                        const currentPath = window.location.pathname;
                        if (currentPath !== '/login' && currentPath !== '/register') {
                            sessionStorage.setItem('auth_notice', 'Your session has expired. Please sign in again.');
                            window.location.href = '/login';
                        }
                    }
                }
            }

            return Promise.reject({ status, ...serverError });
        }

        if (error.request) {
            return Promise.reject({
                status: 0,
                code: 'NETWORK_ERROR',
                message: 'Unable to connect to BLOOD AI backend. Please verify the backend service is running.'
            });
        }

        return Promise.reject({
            status: 0,
            code: 'REQUEST_SETUP_ERROR',
            message: error.message
        });
    }
);

// Root health check helper
export const checkBackendHealth = async() => {
    const rootUrl = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
    const response = await axios.get(`${rootUrl}/health`, { timeout: 5000 });
    return response.data;
};

/**
 * Structured API Domain Modules
 */
export const api = {
    auth: {
        register: (data) => apiClient.post('/auth/register', data),
        login: (credentials) => apiClient.post('/auth/login', credentials),
        logout: () => apiClient.post('/auth/logout'),
        me: () => apiClient.get('/auth/me')
    },
    users: {
        me: () => apiClient.get('/users/me')
    },
    inventory: {
        list: (params = {}) => apiClient.get('/inventory', { params }),
        getById: (id) => apiClient.get(`/inventory/${id}`),
        create: (data) => apiClient.post('/inventory', data),
        update: (id, data) => apiClient.put(`/inventory/${id}`, data),
        remove: (id) => apiClient.delete(`/inventory/${id}`),
        summary: () => apiClient.get('/inventory/summary')
    },
    bloodGroups: {
        list: () => apiClient.get('/blood-groups'),
        getByCode: (code) => apiClient.get(`/blood-groups/${encodeURIComponent(code)}`)
    },
    transactions: {
        list: (params = {}) => apiClient.get('/transactions', { params }),
        getById: (id) => apiClient.get(`/transactions/${id}`),
        create: (data) => apiClient.post('/transactions', data)
    },
    forecasting: {
        get: (params) => apiClient.get('/forecast', { params })
    },
    alerts: {
        list: (params = {}) => apiClient.get('/alerts', { params }),
        getById: (id) => apiClient.get(`/alerts/${id}`),
        summary: () => apiClient.get('/alerts/summary'),
        setRead: (id, isRead = true) => apiClient.put(`/alerts/${id}/read`, { isRead }),
        resolve: (id, data = {}) => apiClient.put(`/alerts/${id}/resolve`, data),
        refresh: () => apiClient.post('/alerts/refresh')
    },
    recommendations: {
        list: (params = {}) => apiClient.get('/recommendations', { params }),
        updateStatus: (id, data) => apiClient.put(`/recommendations/${id}/status`, data),
        refresh: () => apiClient.post('/recommendations/refresh')
    },
    settings: {
        get: () => apiClient.get('/settings'),
        update: (data) => apiClient.put('/settings', data)
    },
    system: {
        status: () => apiClient.get('/system/status'),
        health: checkBackendHealth
    }
};

export default api;