import React, { useEffect, useState } from 'react';
import { Activity, Check, CheckCheck, RefreshCw, Search } from 'lucide-react';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import api from '../services/api';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const COMPONENTS = [
  ['WHOLE_BLOOD', 'Whole blood'],
  ['PRBC', 'Packed red cells'],
  ['PLATELETS', 'Platelets'],
  ['PLASMA', 'Plasma']
];
const TYPE_LABELS = {
  REPLENISH_STOCK: 'Replenish stock',
  PRIORITIZE_EXPIRING: 'Prioritize expiring',
  MONITOR_STOCK: 'Monitor reservations',
  HIGH_DEMAND: 'High demand',
  EXCESS_STOCK: 'Review stock distribution',
  EXPIRY_RISK: 'Expired inventory risk',
  DATA_WARNING: 'Forecast data warning'
};
const priorityVariant = priority => priority === 'CRITICAL' || priority === 'URGENT' ? 'critical' : priority === 'HIGH' ? 'warning' : priority === 'MEDIUM' ? 'expiry' : 'neutral';

export const RecommendationsPage = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [bloodGroupFilter, setBloodGroupFilter] = useState('');
  const [componentFilter, setComponentFilter] = useState('');
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
      try {
        await api.recommendations.refresh();
        const response = await api.recommendations.list({ page: 1, limit: 100 });
        if (!cancelled) setRecommendations((response.data || []).filter(item => ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'].includes(item.status)));
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Unable to load recommendations.');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [reloadToken]);

  const refresh = () => {
    setRefreshing(true);
    setReloadToken(value => value + 1);
  };

  const updateStatus = async (recommendation, status) => {
    setBusyId(recommendation.id);
    setError('');
    try {
      await api.recommendations.updateStatus(recommendation.id, {
        status,
        notes: status === 'RESOLVED' ? 'Resolved by user' : undefined
      });
      setReloadToken(value => value + 1);
    } catch (actionError) {
      setError(actionError.message || 'Unable to update recommendation.');
    } finally {
      setBusyId(null);
    }
  };

  const generated = recommendations.filter(item => item.source === 'DETERMINISTIC_ENGINE');
  const active = generated.filter(item => item.status === 'ACTIVE' || item.status === 'ACKNOWLEDGED');
  const matchesStatus = item => {
    if (statusFilter === 'OPEN') return item.status === 'ACTIVE' || item.status === 'ACKNOWLEDGED';
    return statusFilter === 'ALL' || item.status === statusFilter;
  };
  const visibleRecommendations = generated.filter(item => {
    const query = search.trim().toLowerCase();
    const text = `${item.title || ''} ${item.message || ''} ${item.reason || ''} ${item.suggestedAction || ''} ${item.bloodGroup || ''} ${item.component || ''}`.toLowerCase();
    return matchesStatus(item) &&
      (!typeFilter || item.type === typeFilter) &&
      (!priorityFilter || item.priority === priorityFilter || (priorityFilter === 'CRITICAL' && item.priority === 'URGENT')) &&
      (!bloodGroupFilter || item.bloodGroup === bloodGroupFilter) &&
      (!componentFilter || item.component === componentFilter) &&
      (!query || text.includes(query));
  });

  const acknowledge = active.filter(item => item.status === 'ACTIVE').length;
  const criticalCount = active.filter(item => item.priority === 'CRITICAL' || item.priority === 'URGENT').length;
  const expiryCount = active.filter(item => item.type === 'PRIORITIZE_EXPIRING' || item.type === 'EXPIRY_RISK').length;
  const forecastCount = active.filter(item => item.type === 'HIGH_DEMAND' || item.type === 'EXCESS_STOCK').length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory Recommendations</h1>
            <Badge variant="blood" dot>Deterministic rules engine</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">Recommendations are derived from current inventory, configured thresholds, alerts, expiry dates, and available usage forecasts.</p>
        </div>
        <Button variant="primary" size="sm" onClick={refresh} disabled={loading || refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
          <span>Re-evaluate current data</span>
        </Button>
      </header>

      {error && (
        <div role="alert" className="border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card><p className="text-xs font-semibold uppercase text-slate-500">Open recommendations</p><p className="mt-2 text-2xl font-bold text-slate-900">{loading ? '…' : active.length}</p></Card>
        <Card><p className="text-xs font-semibold uppercase text-slate-500">Critical priority</p><p className="mt-2 text-2xl font-bold text-red-700">{loading ? '…' : criticalCount}</p></Card>
        <Card><p className="text-xs font-semibold uppercase text-slate-500">Expiry actions</p><p className="mt-2 text-2xl font-bold text-amber-700">{loading ? '…' : expiryCount}</p></Card>
        <Card><p className="text-xs font-semibold uppercase text-slate-500">Forecast-backed</p><p className="mt-2 text-2xl font-bold text-blood-700">{loading ? '…' : forecastCount}</p></Card>
      </div>

      <Card title="Evidence-backed actions" subtitle="Priority is derived from explicit threshold, expiry, alert, and forecast signals">
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="text-xs font-semibold text-slate-600">
            Status
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800">
              <option value="OPEN">Open</option><option value="ACTIVE">Active</option><option value="ACKNOWLEDGED">Acknowledged</option><option value="RESOLVED">Resolved</option><option value="ALL">All generated</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Priority
            <select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800">
              <option value="">All priorities</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Recommendation type
            <select value={typeFilter} onChange={event => setTypeFilter(event.target.value)} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800">
              <option value="">All types</option>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Blood group
            <select value={bloodGroupFilter} onChange={event => setBloodGroupFilter(event.target.value)} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800">
              <option value="">All groups</option>{BLOOD_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Component
            <select value={componentFilter} onChange={event => setComponentFilter(event.target.value)} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800">
              <option value="">All components</option>{COMPONENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Search
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Recommendation or evidence" className="block h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm font-normal text-slate-800 placeholder:text-slate-400" />
            </span>
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><RefreshCw className="h-4 w-4 animate-spin" /> Evaluating inventory signals</div>
        ) : visibleRecommendations.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="mx-auto h-8 w-8 text-slate-300" />
            <h2 className="mt-3 font-semibold text-slate-800">No matching recommendations</h2>
            <p className="mt-1 text-sm text-slate-500">No generated recommendation matches the current evidence and filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleRecommendations.map(item => {
              const isOpen = item.status === 'ACTIVE' || item.status === 'ACKNOWLEDGED';
              const isBusy = busyId === item.id;
              const componentLabel = COMPONENTS.find(([value]) => value === item.component)?.[1] || item.component;
              const priorityBasis = item.metadata?.priorityBasis || [];
              return (
                <article key={item.id} className="py-5 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                        <Badge variant="neutral">{TYPE_LABELS[item.type] || item.type}</Badge>
                        <Badge variant={item.status === 'RESOLVED' ? 'optimal' : item.status === 'ACKNOWLEDGED' ? 'warning' : 'blood'}>{item.status}</Badge>
                        {item.confidence && <span className="text-xs text-slate-500">Evidence: {item.confidence.toLowerCase()}</span>}
                      </div>
                      <h2 className="mt-2 text-base font-semibold text-slate-900">{item.title}</h2>
                      <p className="mt-1 text-sm text-slate-700">{item.message}</p>
                      <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
                      <div className="mt-3 border-l-2 border-emerald-500 pl-3 text-sm text-slate-800">
                        <span className="font-semibold">Suggested action: </span>{item.suggestedAction}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {item.bloodGroup && <span>Group: <strong className="text-slate-700">{item.bloodGroup}</strong></span>}
                        {item.component && <span>Component: <strong className="text-slate-700">{componentLabel}</strong></span>}
                        {item.referenceId && <span>Reference: <strong className="font-mono text-slate-700">{item.referenceId}</strong></span>}
                        <span>Generated {new Date(item.createdAt).toLocaleString()}</span>
                        {item.metadata?.availableUnits !== undefined && <span>Available: <strong className="text-slate-700">{item.metadata.availableUnits}</strong></span>}
                        {item.metadata?.reservedUnits !== undefined && <span>Reserved: <strong className="text-slate-700">{item.metadata.reservedUnits}</strong></span>}
                        {item.metadata?.threshold !== undefined && <span>Threshold: <strong className="text-slate-700">{item.metadata.threshold}</strong></span>}
                        {item.metadata?.forecastDemand !== undefined && <span>7-day forecast: <strong className="text-slate-700">{Number(item.metadata.forecastDemand).toFixed(2)}</strong></span>}
                      </div>
                      {priorityBasis.length > 0 && <p className="mt-2 text-xs text-slate-500">Priority basis: {priorityBasis.join(' ')}</p>}
                      {item.resolutionNotes && <p className="mt-2 text-xs text-slate-500">Resolution: {item.resolutionNotes}</p>}
                    </div>
                    {isOpen && (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {item.status === 'ACTIVE' && (
                          <Button variant="outline" size="sm" onClick={() => updateStatus(item, 'ACKNOWLEDGED')} disabled={isBusy}>
                            <Check className="h-3.5 w-3.5" /><span>Acknowledge</span>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => updateStatus(item, 'RESOLVED')} disabled={isBusy}>
                          <CheckCheck className="h-3.5 w-3.5" /><span>Resolve</span>
                        </Button>
                      </div>
                    )}
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

export default RecommendationsPage;
