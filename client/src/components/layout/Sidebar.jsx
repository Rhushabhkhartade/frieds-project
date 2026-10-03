import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  BarChart3,
  Settings,
  Activity,
  HeartPulse,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/inventory', label: 'Blood Inventory', icon: Layers },
  { path: '/alerts', label: 'Alerts Center', icon: AlertTriangle },
  { path: '/forecasting', label: 'AI Demand Forecast', icon: TrendingUp },
  { path: '/recommendations', label: 'Inventory Recommendations', icon: Sparkles },
  { path: '/reports', label: 'Reports & Analytics', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none min-h-screen">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blood-600 to-blood-800 flex items-center justify-center text-white shadow-md shadow-blood-950/40">
          <HeartPulse className="w-5 h-5 text-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white tracking-wider text-base">BLOOD AI</span>
            <span className="text-[10px] bg-blood-900/60 text-blood-300 border border-blood-700/50 px-1.5 py-0.2 rounded font-mono font-semibold">v1.0</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Smart Inventory Hub</p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Main Navigation
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blood-700 text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Operational System Status Pill */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
        <div className="flex items-center gap-3 bg-slate-800/60 p-3 rounded-lg border border-slate-800">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </div>
          <div className="text-xs">
            <p className="text-slate-200 font-medium">Cold Chain Active</p>
            <p className="text-[10px] text-slate-400">All 8 Groups Monitored</p>
          </div>
        </div>

        {/* Sidebar Logout Action */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-950/30 border border-slate-800/60 hover:border-red-900/50 transition-all"
        >
          <LogOut className="w-4 h-4 text-slate-500 group-hover:text-red-400" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
