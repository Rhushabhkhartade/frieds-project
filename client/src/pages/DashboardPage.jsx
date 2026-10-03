import React, { useEffect, useState } from 'react';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import api, { checkBackendHealth } from '../services/api';
import {
  Activity,
  Layers,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  Server,
  CheckCircle2,
  RefreshCw,
  Droplets,
  Clock,
  ShieldAlert
} from 'lucide-react';
import { Link } from 'react-router-dom';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const DashboardPage = () => {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [errorHealth, setErrorHealth] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [alertSummary, setAlertSummary] = useState(null);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    setErrorHealth(null);
    try {
      const data = await checkBackendHealth();
      setHealthStatus(data);
    } catch (err) {
      setErrorHealth(err.message || 'Failed to connect to backend server');
    } finally {
      setLoadingHealth(false);
    }
  };

  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await api.inventory.summary();
      setSummary(res.data || null);
    } catch {
      // Silently fail
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchAlertSummary = async () => {
    try {
      const res = await api.alerts.summary();
      setAlertSummary(res.data || null);
    } catch {
      setAlertSummary(null);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchSummary();
    fetchAlertSummary();
  }, []);

  const refreshAll = () => {
    fetchHealth();
    fetchSummary();
    fetchAlertSummary();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Transfusion Center Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time inventory overview, critical alerts, and AI-assisted stock forecasting.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={loadingHealth || loadingSummary}>
            <RefreshCw className={`w-3.5 h-3.5 ${(loadingHealth || loadingSummary) ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Link to="/inventory">
            <Button variant="primary" size="sm">
              <Layers className="w-4 h-4" />
              <span>Manage Inventory</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Backend Health Check Card */}
      <Card title="System Connectivity & Service Status" subtitle="Direct link to Node.js backend on port 5000">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              healthStatus?.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}>
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-800">
                  {healthStatus?.service || 'BLOOD AI Backend Service'}
                </span>
                {healthStatus?.success ? (
                  <Badge variant="optimal" dot>Online (Port 5000)</Badge>
                ) : (
                  <Badge variant="critical" dot>Disconnected</Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {loadingHealth
                  ? 'Verifying API status at /health...'
                  : healthStatus
                  ? `Status: ${healthStatus.status} | Env: ${healthStatus.environment} | Checked at: ${new Date(healthStatus.timestamp).toLocaleTimeString()}`
                  : `Error: ${errorHealth}`}
              </p>
            </div>
          </div>
          {healthStatus?.success && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-3 py-1.5 rounded border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>REST API Verified</span>
            </div>
          )}
        </div>
      </Card>

      {/* Live KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Units Monitored</span>
            <span className="p-2 rounded-lg bg-blood-50 text-blood-700"><Layers className="w-4 h-4" /></span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">
              {loadingSummary ? '...' : summary ? `${summary.totalUnits} Units` : '—'}
            </span>
            {summary && (
              <span className="ml-2 text-xs text-slate-500">({summary.availableUnits} available)</span>
            )}
          </div>
        </Card>

        <Card className="hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Critical Groups</span>
            <span className="p-2 rounded-lg bg-red-50 text-red-700"><AlertTriangle className="w-4 h-4" /></span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-red-600">
              {loadingSummary ? '...' : summary ? `${summary.criticalGroupsCount || 0} Group${(summary.criticalGroupsCount || 0) !== 1 ? 's' : ''}` : '—'}
            </span>
            {summary?.criticalStockGroups?.length > 0 && (
              <span className="ml-2 text-xs text-slate-500">
                ({summary.criticalStockGroups.map(g => g.bloodGroup).join(', ')} below threshold)
              </span>
            )}
          </div>
        </Card>

        <Card className="hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Expiring &lt; 7 Days</span>
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-700"><Clock className="w-4 h-4" /></span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-indigo-600">
              {loadingSummary ? '...' : summary ? `${summary.expiringSoonUnitsCount} Unit${summary.expiringSoonUnitsCount !== 1 ? 's' : ''}` : '—'}
            </span>
            <span className="ml-2 text-xs text-slate-500">(FIFO priority)</span>
          </div>
        </Card>

        <Card className="hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Forecast Status</span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700"><TrendingUp className="w-4 h-4" /></span>
          </div>
          <div className="mt-3">
            <span className="text-sm font-bold text-slate-800">Dual Engine Ready</span>
            <p className="text-xs text-slate-500 mt-0.5">XGBoost + Statistical Fallback</p>
          </div>
        </Card>
      </div>

      {/* Blood Group Grid - Live Data */}
      {summary?.countsByBloodGroup && (
        <Card title="Blood Group Availability" subtitle="Live stock levels across all 8 blood groups">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {BLOOD_GROUPS.map((bg) => {
              const data = summary.countsByBloodGroup[bg] || { total: 0, available: 0 };
              const isCritical = summary.criticalStockGroups?.some(g => g.bloodGroup === bg);
              const isLow = summary.lowStockGroups?.some(g => g.bloodGroup === bg);
              return (
                <div
                  key={bg}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    isCritical ? 'bg-red-50 border-red-300' : isLow ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200 hover:border-blood-300'
                  }`}
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Group</span>
                  <div className="text-lg font-black text-blood-700">{bg}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    <span className="font-semibold text-slate-800">{data.available}</span> avail / <span className="text-slate-400">{data.total}</span> total
                  </div>
                  <div className="mt-1">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      isCritical ? 'bg-red-500 animate-pulse' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card
        title="In-App Alert Summary"
        subtitle="Current inventory conditions requiring attention"
        action={(
          <Link to="/alerts" className="text-sm font-medium text-blood-700 hover:text-blood-800">
            Open alerts
          </Link>
        )}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Unresolved</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{alertSummary?.unresolved ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Unread</p>
            <p className="mt-1 text-xl font-bold text-blood-700">{alertSummary?.unread ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Critical / expired</p>
            <p className="mt-1 text-xl font-bold text-red-700">
              {alertSummary ? (alertSummary.byType.CRITICAL_STOCK || 0) + (alertSummary.byType.EXPIRED || 0) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Expiring soon</p>
            <p className="mt-1 text-xl font-bold text-amber-700">{alertSummary?.byType.EXPIRING_SOON ?? '—'}</p>
          </div>
        </div>
      </Card>

      {/* Module Navigation Overview */}
      <Card title="Quick System Navigation" subtitle="Navigate to core system modules">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link to="/inventory" className="p-4 rounded-lg border border-slate-200 hover:border-blood-300 hover:bg-slate-50 transition-all">
            <div className="flex items-center gap-2 text-blood-700 font-semibold text-sm">
              <Layers className="w-4 h-4" />
              <span>Blood Inventory</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Manage blood-group-wise units, collections, and FIFO dispatches.</p>
          </Link>

          <Link to="/alerts" className="p-4 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-slate-50 transition-all">
            <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Alerts Center</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Monitor low stock, critical deficits, and shelf-life expirations.</p>
          </Link>

          <Link to="/forecasting" className="p-4 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-slate-50 transition-all">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>AI Demand Forecast</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Project next 7, 14, and 30 days blood demand using regression models.</p>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default DashboardPage;
