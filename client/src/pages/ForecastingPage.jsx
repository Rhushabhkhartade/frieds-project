import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Activity, CalendarDays, ChartNoAxesCombined, CircleAlert, RefreshCw } from 'lucide-react';
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
const ForecastChart = lazy(() => import('../components/ForecastChart'));

const qualityVariant = confidence => confidence === 'HIGH' ? 'optimal' : confidence === 'MEDIUM' ? 'warning' : 'neutral';

export const ForecastingPage = () => {
  const [parameters, setParameters] = useState({
    bloodGroup: 'O+',
    component: 'WHOLE_BLOOD',
    horizon: 7,
    historicalDays: 90
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestNumber, setRequestNumber] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.forecasting.get(parameters);
        if (!cancelled) setResult(response.data || null);
      } catch (requestError) {
        if (!cancelled) {
          setResult(null);
          setError(requestError.message || 'Forecast request failed.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [parameters, requestNumber]);

  const updateParameter = event => {
    const { name, value } = event.target;
    setParameters(current => ({
      ...current,
      [name]: name === 'horizon' || name === 'historicalDays' ? Number(value) : value
    }));
  };

  const submit = event => {
    event.preventDefault();
    setRequestNumber(value => value + 1);
  };

  const forecastPoints = result?.forecast || [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Blood Demand Forecast</h1>
            <Badge variant="blood" dot>{result?.provider || 'statistical'} provider</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">Daily demand estimated from recorded issue and use transactions.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Activity className="h-4 w-4 text-emerald-700" />
          XGBoost is not active unless an ML provider is explicitly configured.
        </div>
      </header>

      <Card title="Forecast parameters" subtitle="Choose a blood group, component, and date window">
        <form onSubmit={submit} className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <label className="text-xs font-semibold text-slate-600">
            Blood group
            <select name="bloodGroup" value={parameters.bloodGroup} onChange={updateParameter} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800">
              {BLOOD_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Component
            <select name="component" value={parameters.component} onChange={updateParameter} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800">
              {COMPONENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Forecast horizon
            <select name="horizon" value={parameters.horizon} onChange={updateParameter} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800">
              {[7, 14, 30, 60, 90].map(days => <option key={days} value={days}>{days} days</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            History window
            <select name="historicalDays" value={parameters.historicalDays} onChange={updateParameter} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800">
              {[30, 60, 90, 180, 365].map(days => <option key={days} value={days}>{days} days</option>)}
            </select>
          </label>
          <Button type="submit" variant="primary" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Run forecast</span>
          </Button>
        </form>
      </Card>

      {error && (
        <div role="alert" className="flex items-start gap-2 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <p className="text-xs font-semibold uppercase text-slate-500">Historical demand</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{result.totalHistoricalDemand ?? 0}</p>
              <p className="mt-1 text-xs text-slate-500">units in {result.historicalDays} days</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase text-slate-500">Daily average</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{Number(result.averageHistoricalDemand || 0).toFixed(2)}</p>
              <p className="mt-1 text-xs text-slate-500">units per calendar day</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase text-slate-500">Demand dates</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{result.dataPointsUsed ?? 0}</p>
              <p className="mt-1 text-xs text-slate-500">distinct days with issue/use</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase text-slate-500">Data quality</p>
              <div className="mt-2"><Badge variant={qualityVariant(result.confidence)}>{result.confidence || 'UNKNOWN'}</Badge></div>
              <p className="mt-2 text-xs text-slate-500">{result.provider} forecast</p>
            </Card>
          </div>

          <Card
            title={`${result.bloodGroup} · ${COMPONENTS.find(([value]) => value === result.component)?.[1] || result.component}`}
            subtitle={`Next ${result.horizon} days · generated ${new Date(result.generatedAt).toLocaleString()}`}
            action={<span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays className="h-4 w-4" />{result.historicalDays}d history</span>}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><RefreshCw className="h-4 w-4 animate-spin" />Updating forecast</div>
            ) : result.state === 'INSUFFICIENT_DATA' ? (
              <div className="flex flex-col items-center py-12 text-center">
                <ChartNoAxesCombined className="h-9 w-9 text-amber-600" />
                <h2 className="mt-3 font-semibold text-slate-900">Not enough usage history</h2>
                <p className="mt-1 max-w-lg text-sm text-slate-600">{result.reason}</p>
                <p className="mt-2 text-xs text-slate-500">No forecast values are shown until sufficient matching transaction history is available.</p>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-4 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-blood-700" />Expected demand</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-200" />Lower/upper bounds</span>
                  <span>Units per day</span>
                </div>
                <div className="h-[320px] w-full" aria-label="Daily forecast chart">
                  <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-500">Loading chart</div>}>
                    <ForecastChart data={forecastPoints} />
                  </Suspense>
                </div>
                <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  Statistical method: {result.method}. Forecast intervals are estimates from observed daily variation, not clinical guarantees.
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default ForecastingPage;