import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { HeartPulse } from 'lucide-react';

/**
 * Route guard that requires an active, authenticated clinical session.
 * Displays a branded medical loader while verifying session state.
 */
export const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blood-600 to-blood-800 flex items-center justify-center text-white shadow-xl shadow-blood-950/60 mb-4 animate-pulse">
          <HeartPulse className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-lg font-bold tracking-tight text-white">BLOOD AI</h2>
        <p className="text-xs text-slate-400 mt-1">Verifying clinical credentials & security session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
