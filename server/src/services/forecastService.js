import { storage } from '../repositories/index.js';
import { env } from '../config/environment.js';
import { FutureXGBoostProvider, StatisticalForecastProvider } from './forecastProviders.js';

const MINIMUM_DEMAND_DAYS = 3;
const canonicalComponent = value => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

class ForecastService {
    constructor() {
        this.statisticalProvider = new StatisticalForecastProvider();
        this.mlProvider = new FutureXGBoostProvider();
    }

    async getForecast(query) {
        const { bloodGroup, component, horizon, historicalDays } = query;
        const transactions = await storage.findAll('transactions');
        const units = await storage.findAll('units');
        const unitById = new Map((Array.isArray(units) ? units : []).map(unit => [String(unit.id), unit]));
        const now = new Date();
        const end = new Date(now);
        end.setUTCHours(23, 59, 59, 999);
        const start = new Date(now);
        start.setUTCHours(0, 0, 0, 0);
        start.setUTCDate(start.getUTCDate() - historicalDays + 1);

        const historyByDate = new Map();
        for (const transaction of Array.isArray(transactions) ? transactions : []) {
            const operation = String(transaction.operation || transaction.type || '').toUpperCase();
            if (operation !== 'ISSUE' && operation !== 'USE') continue;

            const timestamp = transaction.timestamp || transaction.createdAt;
            const occurredAt = timestamp ? new Date(timestamp) : null;
            if (!occurredAt || Number.isNaN(occurredAt.getTime()) || occurredAt < start || occurredAt > end) continue;

            const unit = unitById.get(String(transaction.unitId));
            const transactionGroup = transaction.bloodGroup || (unit && unit.bloodGroup);
            const transactionComponent = canonicalComponent(
                transaction.component || (unit && unit.component) || (unit && unit.componentType)
            );
            if (transactionGroup !== bloodGroup || transactionComponent !== canonicalComponent(component)) continue;

            const date = occurredAt.toISOString().slice(0, 10);
            const rawQuantity = transaction.quantity !== undefined && transaction.quantity !== null ?
                transaction.quantity : transaction.units !== undefined && transaction.units !== null ?
                transaction.units : 1;
            const quantity = Number(rawQuantity);
            const demand = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
            historyByDate.set(date, (historyByDate.get(date) || 0) + demand);
        }

        const dailyHistory = Array.from({ length: historicalDays }, (_, index) => {
            const date = new Date(start);
            date.setUTCDate(date.getUTCDate() + index);
            const dateString = date.toISOString().slice(0, 10);
            return { date: dateString, demand: historyByDate.get(dateString) || 0 };
        });
        const provider = String(env.FORECAST_PROVIDER || 'statistical').toLowerCase() === 'xgboost' ?
            this.mlProvider :
            this.statisticalProvider;
        const demandDays = dailyHistory.filter(day => day.demand > 0).length;
        const totalHistoricalDemand = dailyHistory.reduce((sum, day) => sum + day.demand, 0);
        const averageHistoricalDemand = Math.round((totalHistoricalDemand / historicalDays) * 100) / 100;
        const metadata = {
            bloodGroup,
            component: canonicalComponent(component),
            horizon,
            historicalDays,
            provider: provider.name,
            generatedAt: now.toISOString()
        };

        if (demandDays < MINIMUM_DEMAND_DAYS) {
            return {
                ...metadata,
                state: 'INSUFFICIENT_DATA',
                reason: `At least ${MINIMUM_DEMAND_DAYS} distinct days with ISSUE or USE transactions are required; found ${demandDays}.`,
                dataPointsUsed: demandDays,
                averageHistoricalDemand,
                totalHistoricalDemand,
                confidence: 'INSUFFICIENT'
            };
        }

        const result = await provider.forecast({
            bloodGroup,
            component: canonicalComponent(component),
            horizon,
            historicalDays,
            dailyHistory,
            minimumDemandDays: MINIMUM_DEMAND_DAYS
        });

        return {
            ...result,
            ...metadata,
            dataPointsUsed: demandDays,
            averageHistoricalDemand,
            totalHistoricalDemand,
            state: result.state || 'READY'
        };
    }
}

export const forecastService = new ForecastService();