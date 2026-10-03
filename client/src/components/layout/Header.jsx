import React from 'react';
import { Bell, ShieldCheck, User, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Badge from '../common/Badge';

export const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between shrink-0 shadow-medical-sm">
      {/* Location / Facility Context */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100/80 px-2.5 py-1 rounded-md border border-slate-200">
          <ShieldCheck className="w-3.5 h-3.5 text-blood-700" />
          <span>{user?.facility || 'Regional Transfusion Center #01'}</span>
        </div>
        <span className="text-slate-300 hidden md:inline">|</span>
        <span className="text-xs text-slate-500 font-medium hidden md:inline">
          {user?.role === 'ADMIN' ? 'Clinical Administration' : 'Transfusion Services'}
        </span>
      </div>

      {/* Right User & Notification Controls */}
      <div className="flex items-center gap-4">
        {/* Quick Alert Bell */}
        <Link
          to="/alerts"
          className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Active Alerts"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 rounded-full" />
        </Link>

        {/* User Profile Pill */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700 font-semibold text-xs">
            <User className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-slate-800 leading-tight">
                {user?.fullName || user?.name || 'Staff User'}
              </p>
              <Badge variant={user?.role === 'ADMIN' ? 'blood' : 'neutral'} size="sm">
                {user?.role || 'STAFF'}
              </Badge>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              {user?.email || 'authenticated'}
            </p>
          </div>
        </div>

        {/* Visible Logout Action */}
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-red-200 transition-all font-medium"
          title="Sign out of BLOOD AI"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
