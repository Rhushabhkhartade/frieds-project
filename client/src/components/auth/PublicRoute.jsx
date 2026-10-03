import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { HeartPulse } from 'lucide-react';

/**
 * Route guard for public auth pages (e.g. /login, /register).
 * Redirects already-authenticated users to the dashboard (/).
 */
export const PublicRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blood-600 to-blood-800 flex items-center justify-center text-white shadow-xl shadow-blood-950/60 mb-4 animate-pulse">
          <HeartPulse className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-lg font-bold tracking-tight text-white">BLOOD AI</h2>
        <p className="text-xs text-slate-400 mt-1">Initializing clinical portal...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default PublicRoute;
