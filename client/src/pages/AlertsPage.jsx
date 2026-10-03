import React, { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, Check, CheckCheck, Clock3, RefreshCw, X } from 'lucide-react';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import api from '../services/api';

const TYPE_LABELS = {
  CRITICAL_STOCK: 'Critical stock',
  LOW_STOCK: 'Low stock',
  EXPIRING_SOON: 'Expiring soon',
  EXPIRED: 'Expired'
};

const severityVariant = severity => severity === 'CRITICAL' ? 'critical' : severity === 'WARNING' ? 'warning' : 'neutral';

export const AlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('ACTIVE');
  const [readState, setReadState] = useState('');
  const [severity, setSeverity] = useState('');
  const [type, setType] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      const params = { limit: 100 };
      if (status) params.status = status;
      if (readState) params.readState = readState;
      if (severity) params.severity = severity;
      if (type) params.type = type;
      if (bloodGroup) params.bloodGroup = bloodGroup;

      try {
        const [alertResponse, summaryResponse] = await Promise.all([
          api.alerts.list(params),
          api.alerts.summary()
        ]);
        if (!cancelled) {
          setAlerts(alertResponse.data || []);
          setSummary(summaryResponse.data || null);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Unable to load alerts.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [status, readState, severity, type, bloodGroup, reloadToken]);

  const refresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      await api.alerts.refresh();
      setReloadToken(value => value + 1);
    } catch (refreshError) {
      setError(refreshError.message || 'Unable to refresh inventory alerts.');
    } finally {
      setRefreshing(false);
    }
  };

  const setRead = async (alert, isRead) => {
    setBusyId(alert.id);
    try {
      await api.alerts.setRead(alert.id, isRead);
      setReloadToken(value => value + 1);
    } catch (actionError) {
      setError(actionError.message || 'Unable to update alert.');
    } finally {
      setBusyId(null);
    }
  };

  const resolve = async alert => {
    setBusyId(alert.id);
    try {
      await api.alerts.resolve(alert.id, { reason: 'Dismissed by user' });
      setReloadToken(value => value + 1);
    } catch (actionError) {
      setError(actionError.message || 'Unable to resolve alert.');
    } finally {
      setBusyId(null);
    }
  };

  const visibleAlerts = alerts.filter(alert => {
    const text = `${alert.message || ''} ${alert.bloodGroup || ''} ${alert.unitId || ''} ${alert.referenceId || ''}`.toLowerCase();
    return !search.trim() || text.includes(search.trim().toLowerCase());
  });

  const count = (key) => summary?.byType?.[key] ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Alerts & Notifications</h1>
            <Badge variant={summary?.unread ? 'critical' : 'optimal'} dot>
              {summary?.unread ?? '—'} unread
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">Inventory conditions generated from live stock and expiry data.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing || loading}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh inventory alerts</span>
        </Button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-l-4 border-l-red-500">
          <p className="text-xs font-semibold uppercase text-slate-500">Critical / expired</p>
          <p className="mt-2 text-2xl font-bold text-red-700">{count('CRITICAL_STOCK') + count('EXPIRED')}</p>
          <p className="mt-1 text-xs text-slate-500">Unresolved incidents</p>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <p className="text-xs font-semibold uppercase text-slate-500">Low stock</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{count('LOW_STOCK')}</p>
          <p className="mt-1 text-xs text-slate-500">Groups below buffer</p>
        </Card>
        <Card className="border-l-4 border-l-indigo-500">
          <p className="text-xs font-semibold uppercase text-slate-500">Expiring soon</p>
          <p className="mt-2 text-2xl font-bold text-indigo-700">{count('EXPIRING_SOON')}</p>
          <p className="mt-1 text-xs text-slate-500">Units within expiry window</p>
        </Card>
        <Card className="border-l-4 border-l-blood-600">
          <p className="text-xs font-semibold uppercase text-slate-500">Unresolved</p>
          <p className="mt-2 text-2xl font-bold text-blood-700">{summary?.unresolved ?? '—'}</p>
          <p className="mt-1 text-xs text-slate-500">{summary?.unread ?? '—'} still unread</p>
        </Card>
      </div>

      <Card title="Alert stream" subtitle="Newest inventory conditions first">
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="text-xs font-medium text-slate-600">
            Status
            <select value={status} onChange={event => setStatus(event.target.value)} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800">
              <option value="ACTIVE">Unresolved</option>
              <option value="RESOLVED">Resolved</option>
              <option value="">All statuses</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Read state
            <select value={readState} onChange={event => setReadState(event.target.value)} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800">
              <option value="">All alerts</option>
              <option value="UNREAD">Unread</option>
              <option value="READ">Read</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Severity
            <select value={severity} onChange={event => setSeverity(event.target.value)} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800">
              <option value="">All severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Alert type
            <select value={type} onChange={event => setType(event.target.value)} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800">
              <option value="">All types</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Blood group
            <select value={bloodGroup} onChange={event => setBloodGroup(event.target.value)} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800">
              <option value="">All groups</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => <option key={group} value={group}>{group}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Search
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Message or reference" className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400" />
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading alerts
          </div>
        ) : visibleAlerts.length === 0 ? (
          <div className="py-12 text-center">
            <BellRing className="mx-auto h-8 w-8 text-slate-300" />
            <h2 className="mt-3 font-semibold text-slate-800">No matching alerts</h2>
            <p className="mt-1 text-sm text-slate-500">Change the filters or refresh inventory conditions.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleAlerts.map(alert => {
              const isBusy = busyId === alert.id;
              const isResolved = alert.status === 'RESOLVED';
              return (
                <article key={alert.id} className={`py-4 first:pt-0 last:pb-0 ${alert.isRead ? '' : 'border-l-2 border-l-blood-600 pl-4'}`}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={severityVariant(alert.severity)}>{alert.severity || 'INFO'}</Badge>
                        <Badge variant="neutral">{TYPE_LABELS[alert.type] || alert.type}</Badge>
                        <Badge variant={isResolved ? 'optimal' : 'neutral'}>{isResolved ? 'RESOLVED' : alert.status}</Badge>
                        {!alert.isRead && <span className="text-xs font-semibold text-blood-700">Unread</span>}
                      </div>
                      <p className={`mt-2 text-sm ${alert.isRead ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>{alert.message}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        {alert.bloodGroup && <span>Blood group: <strong className="text-slate-700">{alert.bloodGroup}</strong></span>}
                        {(alert.referenceId || alert.unitId) && <span>Reference: <strong className="font-mono text-slate-700">{alert.referenceId || alert.unitId}</strong></span>}
                        <span>{alert.source || 'INVENTORY'}</span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{alert.createdAt ? new Date(alert.createdAt).toLocaleString() : 'Timestamp unavailable'}</span>
                        {alert.resolvedAt && <span>Resolved {new Date(alert.resolvedAt).toLocaleString()}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setRead(alert, !alert.isRead)} disabled={isBusy} aria-label={alert.isRead ? 'Mark alert unread' : 'Mark alert read'}>
                        {alert.isRead ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                        <span>{alert.isRead ? 'Mark unread' : 'Mark read'}</span>
                      </Button>
                      {!isResolved && (
                        <Button variant="ghost" size="sm" onClick={() => resolve(alert)} disabled={isBusy}>
                          <CheckCheck className="h-3.5 w-3.5" />
                          <span>Resolve</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AlertsPage;