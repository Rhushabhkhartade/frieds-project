import { env } from '../config/environment.js';

const round = value => Math.round(value * 100) / 100;

export class ForecastProvider {
    constructor(name) {
        this.name = name;
    }

    async forecast() {
        throw new Error('ForecastProvider.forecast must be implemented');
    }
}

export class StatisticalForecastProvider extends ForecastProvider {
    constructor() {
        super('statistical');
    }

    async forecast({ dailyHistory, horizon, historicalDays }) {
        const demandDays = dailyHistory.filter(day => day.demand > 0).length;
        if (demandDays < 3) {
            return {
                state: 'INSUFFICIENT_DATA',
                reason: `At least 3 distinct days with ISSUE or USE transactions are required; found ${demandDays}.`,
                dataPointsUsed: demandDays,
                averageHistoricalDemand: round(dailyHistory.reduce((sum, day) => sum + day.demand, 0) / historicalDays),
                totalHistoricalDemand: dailyHistory.reduce((sum, day) => sum + day.demand, 0),
                confidence: 'INSUFFICIENT'
            };
        }

        const dailyMean = dailyHistory.reduce((sum, day) => sum + day.demand, 0) / historicalDays;
        const weekdayStats = Array.from({ length: 7 }, (_, weekday) => {
            const values = dailyHistory.filter(day => new Date(`${day.date}T00:00:00.000Z`).getUTCDay() === weekday);
            return {
                count: values.length,
                mean: values.length ? values.reduce((sum, day) => sum + day.demand, 0) / values.length : dailyMean
            };
        });

        const forecast = Array.from({ length: horizon }, (_, index) => {
            const date = new Date();
            date.setUTCHours(0, 0, 0, 0);
            date.setUTCDate(date.getUTCDate() + index + 1);
            const dateString = date.toISOString().slice(0, 10);
            const weekday = weekdayStats[date.getUTCDay()];
            const shrinkage = weekday.count / (weekday.count + 4);
            const predictedDemand = Math.max(0, dailyMean * (1 - shrinkage) + weekday.mean * shrinkage);
            const historicalVariance = dailyHistory.reduce((sum, day) => sum + ((day.demand - dailyMean) ** 2), 0) / historicalDays;
            const margin = 1.645 * Math.sqrt(Math.max(predictedDemand, historicalVariance / Math.max(demandDays, 1)));

            return {
                date: dateString,
                predictedDemand: round(predictedDemand),
                lowerBound: round(Math.max(0, predictedDemand - margin)),
                upperBound: round(predictedDemand + margin)
            };
        });

        const coverage = demandDays / historicalDays;
        const confidence = demandDays >= 14 && coverage >= 0.2 ? 'HIGH' : demandDays >= 7 ? 'MEDIUM' : 'LOW';
        return {
            state: 'READY',
            forecast,
            dataPointsUsed: demandDays,
            averageHistoricalDemand: round(dailyMean),
            totalHistoricalDemand: dailyHistory.reduce((sum, day) => sum + day.demand, 0),
            confidence,
            method: 'weekday-adjusted historical daily mean with shrinkage and variance bounds'
        };
    }
}

export class FutureXGBoostProvider extends ForecastProvider {
    constructor(serviceUrl = env.ML_SERVICE_URL) {
        super('ml_service');
        this.serviceUrl = serviceUrl.replace(/\/$/, '');
    }

    async forecast(input) {
        const response = await fetch(`${this.serviceUrl}/forecast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
            signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) {
            throw new Error(`Forecast ML service returned HTTP ${response.status}`);
        }
        const result = await response.json();
        if (result.state === 'INSUFFICIENT_DATA') {
            return {
                state: result.state,
                reason: result.reason || 'The configured ML service reported insufficient history.',
                dataPointsUsed: result.dataPointsUsed,
                averageHistoricalDemand: result.averageHistoricalDemand,
                totalHistoricalDemand: result.totalHistoricalDemand,
                confidence: result.confidence || 'INSUFFICIENT'
            };
        }
        if (!Array.isArray(result.forecast) || result.forecast.length !== input.horizon) {
            throw new Error('Forecast ML service returned an invalid forecast payload');
        }
        const validPoints = result.forecast.every(point =>
            /^\d{4}-\d{2}-\d{2}$/.test(point.date) && ['predictedDemand', 'lowerBound', 'upperBound'].every(key => Number.isFinite(Number(point[key]))) &&
            Number(point.lowerBound) <= Number(point.predictedDemand) &&
            Number(point.predictedDemand) <= Number(point.upperBound)
        );
        if (!validPoints) {
            throw new Error('Forecast ML service returned invalid forecast points');
        }
        return {...result, state: 'READY' };
    }
}