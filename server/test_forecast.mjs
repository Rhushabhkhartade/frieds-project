import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { forecastQuerySchema } from './src/models/forecastSchema.js';

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'blood-ai-forecast-'));
process.env.DATA_DIR = dataDir;
process.env.FORECAST_PROVIDER = 'statistical';
const originalFetch = globalThis.fetch;

try {
    const dateDaysAgo = days => {
        const date = new Date();
        date.setUTCHours(12, 0, 0, 0);
        date.setUTCDate(date.getUTCDate() - days);
        return date.toISOString();
    };

    await fs.writeFile(path.join(dataDir, 'units.json'), JSON.stringify([
        { id: 'legacy-unit', bloodGroup: 'O+', componentType: 'WHOLE_BLOOD' }
    ]));
    await fs.writeFile(path.join(dataDir, 'transactions.json'), JSON.stringify([
        { id: 'demand-1', operation: 'ISSUE', bloodGroup: 'O+', component: 'WHOLE_BLOOD', timestamp: dateDaysAgo(1) },
        { id: 'demand-2', operation: 'USE', bloodGroup: 'O+', component: 'Whole Blood', quantity: 2, timestamp: dateDaysAgo(4) },
        { id: 'demand-3', operation: 'ISSUE', unitId: 'legacy-unit', timestamp: dateDaysAgo(8) },
        { id: 'reserve', operation: 'RESERVE', bloodGroup: 'O+', component: 'WHOLE_BLOOD', timestamp: dateDaysAgo(1) },
        { id: 'other-group', operation: 'ISSUE', bloodGroup: 'A+', component: 'WHOLE_BLOOD', timestamp: dateDaysAgo(1) },
        { id: 'other-component', operation: 'USE', bloodGroup: 'O+', component: 'PRBC', timestamp: dateDaysAgo(1) }
    ]));

    const { forecastService } = await
    import ('./src/services/forecastService.js');
    const query = forecastQuerySchema.parse({ bloodGroup: 'O+', component: 'Whole Blood', horizon: '7', historicalDays: '30' });
    const forecast = await forecastService.getForecast(query);
    assert.equal(forecast.state, 'READY');
    assert.equal(forecast.provider, 'statistical');
    assert.equal(forecast.dataPointsUsed, 3, 'counts distinct days with matching issue/use operations');
    assert.equal(forecast.totalHistoricalDemand, 4, 'sums quantity and transaction-level demand only');
    assert.equal(forecast.forecast.length, 7);
    assert.ok(forecast.forecast.every(point => point.lowerBound <= point.predictedDemand && point.predictedDemand <= point.upperBound));
    assert.ok(forecast.forecast.every(point => /^\d{4}-\d{2}-\d{2}$/.test(point.date)));

    const insufficient = await forecastService.getForecast(forecastQuerySchema.parse({
        bloodGroup: 'O+',
        component: 'PLASMA',
        horizon: '14',
        historicalDays: '30'
    }));
    assert.equal(insufficient.state, 'INSUFFICIENT_DATA');
    assert.equal(insufficient.confidence, 'INSUFFICIENT');
    assert.equal(insufficient.forecast, undefined, 'does not invent a forecast without sufficient transactions');

    assert.equal(forecastQuerySchema.safeParse({ bloodGroup: 'O+', component: 'PRBC', horizon: '91', historicalDays: '30' }).success, false);
    assert.equal(forecastQuerySchema.safeParse({ bloodGroup: 'O+', component: 'PRBC', horizon: '7', historicalDays: '6' }).success, false);
    const { env } = await
    import ('./src/config/environment.js');
    env.FORECAST_PROVIDER = 'xgboost';
    let mlServiceCalls = 0;
    globalThis.fetch = async(_url, options) => {
        mlServiceCalls++;
        const input = JSON.parse(options.body);
        const futureForecast = Array.from({ length: input.horizon }, (_, index) => {
            const date = new Date();
            date.setUTCHours(0, 0, 0, 0);
            date.setUTCDate(date.getUTCDate() + index + 1);
            return { date: date.toISOString().slice(0, 10), predictedDemand: 1, lowerBound: 0, upperBound: 2 };
        });
        return { ok: true, json: async() => ({ provider: 'xgboost', forecast: futureForecast, confidence: 'MEDIUM' }) };
    };
    const delegatedForecast = await forecastService.getForecast(query);
    assert.equal(delegatedForecast.provider, 'ml_service', 'provider metadata identifies the adapter without asserting its model');
    assert.equal(delegatedForecast.totalHistoricalDemand, 4, 'the server remains authoritative for transaction metrics');
    assert.equal(mlServiceCalls, 1);
    await forecastService.getForecast(forecastQuerySchema.parse({
        bloodGroup: 'O+',
        component: 'PLASMA',
        horizon: '7',
        historicalDays: '30'
    }));
    assert.equal(mlServiceCalls, 1, 'insufficient history is rejected before calling the configured provider');

    console.log('Forecast history, filtering, bounds, validation, and provider checks passed.');
} finally {
    globalThis.fetch = originalFetch;
    await fs.rm(dataDir, { recursive: true, force: true });
}