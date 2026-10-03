import { randomUUID } from 'node:crypto';
import { storage } from '../repositories/index.js';
import { NotFoundError } from '../middlewares/errorHandler.js';
import { BLOOD_GROUPS, COMPONENT_TYPES, RECOMMENDATION_STATUSES, RECOMMENDATION_TYPES } from '../config/constants.js';
import { inventoryService } from './inventoryService.js';
import { settingsService } from './settingsService.js';
import { forecastService } from './forecastService.js';

const ENGINE_SOURCE = 'DETERMINISTIC_ENGINE';
const ACTIVE_STATUSES = [RECOMMENDATION_STATUSES.ACTIVE, RECOMMENDATION_STATUSES.ACKNOWLEDGED];
const canonicalComponent = value => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

function calculatePriority({ criticalShortage, lowShortage, expiredAvailable, expiryDays, forecastGapRatio, alertPresent }) {
    let score = 0;
    const basis = [];

    if (expiredAvailable) {
        score += 100;
        basis.push('An expired unit is still marked available and requires immediate quarantine review.');
    }
    if (criticalShortage) {
        score += 75;
        basis.push('Available stock is below the configured critical threshold.');
    } else if (lowShortage) {
        score += 50;
        basis.push('Available stock is below the configured low-stock threshold.');
    }
    if (Number.isFinite(expiryDays) && expiryDays <= 1) {
        score += 30;
        basis.push('An affected unit expires within 24 hours.');
    } else if (Number.isFinite(expiryDays) && expiryDays <= 3) {
        score += 20;
        basis.push('An affected unit expires within 3 days.');
    } else if (Number.isFinite(expiryDays)) {
        score += 10;
        basis.push('An affected unit is inside the configured expiry window.');
    }
    if (forecastGapRatio > 0) {
        score += 35 + Math.min(20, forecastGapRatio * 20);
        basis.push('Ready forecast demand exceeds component-level available stock.');
    }
    if (alertPresent) {
        score += 5;
        basis.push('A matching active inventory alert independently confirms the condition.');
    }

    const priority = score >= 75 ? 'CRITICAL' : score >= 55 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW';
    return { priority, basis };
}

function makeRecommendation(now, fields) {
    const priorityResult = calculatePriority(fields.prioritySignals || {});
    return {
        dedupeKey: fields.dedupeKey,
        source: ENGINE_SOURCE,
        type: fields.type,
        priority: priorityResult.priority,
        title: fields.title,
        message: fields.message,
        reason: fields.reason,
        suggestedAction: fields.suggestedAction,
        bloodGroup: fields.bloodGroup || null,
        component: fields.component || null,
        referenceType: fields.referenceType || null,
        referenceId: fields.referenceId || null,
        status: RECOMMENDATION_STATUSES.ACTIVE,
        confidence: fields.confidence || 'HIGH',
        metadata: {
            ...(fields.metadata || {}),
            priorityBasis: priorityResult.basis,
            conditionActive: true
        },
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    };
}

class RecommendationService {
    async listRecommendations(query = {}) {
        const { status, priority, type, bloodGroup, component, page = 1, limit = 50 } = query;
        let recommendations = await storage.findAll('recommendations');
        if (!Array.isArray(recommendations)) recommendations = [];

        if (status) recommendations = recommendations.filter(item => item.status === status);
        if (priority) recommendations = recommendations.filter(item => item.priority === priority || (priority === 'CRITICAL' && item.priority === 'URGENT'));
        if (type) recommendations = recommendations.filter(item => item.type === type);
        if (bloodGroup) recommendations = recommendations.filter(item => item.bloodGroup === bloodGroup);
        if (component) recommendations = recommendations.filter(item => item.component === component);

        const priorityWeight = { CRITICAL: 4, URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        recommendations.sort((a, b) => {
            const aActive = ACTIVE_STATUSES.includes(a.status);
            const bActive = ACTIVE_STATUSES.includes(b.status);
            if (aActive !== bActive) return aActive ? -1 : 1;
            const priorityDifference = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
            return priorityDifference || new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
        });

        const total = recommendations.length;
        const startIndex = (page - 1) * limit;
        return {
            recommendations: recommendations.slice(startIndex, startIndex + limit),
            pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) || 1 }
        };
    }

    async updateStatus(id, status, notes = null, updatedBy = null) {
        const recommendation = await storage.findById('recommendations', id);
        if (!recommendation) throw new NotFoundError(`Recommendation with ID "${id}" was not found`);

        const normalizedStatus = status === 'ACTIONED' || status === 'DISMISSED' ? RECOMMENDATION_STATUSES.RESOLVED : status;
        const now = new Date().toISOString();
        const updates = {
            status: normalizedStatus,
            resolutionNotes: notes,
            updatedBy,
            updatedAt: now
        };
        if (normalizedStatus === RECOMMENDATION_STATUSES.ACKNOWLEDGED) {
            updates.acknowledgedAt = now;
            updates.acknowledgedBy = updatedBy;
        }
        if (normalizedStatus === RECOMMENDATION_STATUSES.RESOLVED) {
            updates.resolvedAt = now;
            updates.resolvedBy = updatedBy;
            updates.resolutionSource = 'USER';
            if (recommendation.source === ENGINE_SOURCE) {
                updates.metadata = {...(recommendation.metadata || {}), conditionActive: true };
            }
        }
        return storage.update('recommendations', id, updates);
    }

    async generateRecommendations() {
            const [settings, inventory, unitsResult, alertsResult, transactionsResult, existingResult] = await Promise.all([
                settingsService.getSettings(),
                inventoryService.getInventorySummary(),
                storage.findAll('units'),
                storage.findAll('alerts'),
                storage.findAll('transactions'),
                storage.findAll('recommendations')
            ]);
            const units = Array.isArray(unitsResult) ? unitsResult : [];
            const alerts = Array.isArray(alertsResult) ? alertsResult : [];
            const transactions = Array.isArray(transactionsResult) ? transactionsResult : [];
            const existing = Array.isArray(existingResult) ? existingResult : [];
            const now = new Date();
            const today = new Date(now);
            today.setUTCHours(0, 0, 0, 0);
            const todayString = today.toISOString().slice(0, 10);
            const expiryNoticeDays = Number(settings.expiryNoticeDays) || 7;
            const activeAlerts = alerts.filter(alert => alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED');
            const candidates = [];
            const pairCounts = new Map();
            const unitById = new Map(units.map(unit => [String(unit.id), unit]));

            for (const unit of units) {
                const group = unit.bloodGroup;
                const component = canonicalComponent(unit.component || unit.componentType);
                if (!BLOOD_GROUPS.includes(group) || !COMPONENT_TYPES.includes(component)) continue;
                const key = `${group}|${component}`;
                if (!pairCounts.has(key)) pairCounts.set(key, { bloodGroup: group, component, available: 0, reserved: 0 });
                const pair = pairCounts.get(key);
                const expiryDay = unit.expiryDate ? String(unit.expiryDate).slice(0, 10) : null;
                const usableAvailable = unit.status === 'AVAILABLE' && (!expiryDay || expiryDay >= todayString);
                if (usableAvailable) pair.available++;
                if (unit.status === 'RESERVED') pair.reserved++;
            }

            for (const transaction of transactions) {
                const operation = String(transaction.operation || transaction.type || '').toUpperCase();
                if (operation !== 'ISSUE' && operation !== 'USE') continue;
                const unit = unitById.get(String(transaction.unitId));
                const group = transaction.bloodGroup || (unit && unit.bloodGroup);
                const component = canonicalComponent(transaction.component || (unit && unit.component) || (unit && unit.componentType));
                if (!BLOOD_GROUPS.includes(group) || !COMPONENT_TYPES.includes(component)) continue;
                const key = `${group}|${component}`;
                if (!pairCounts.has(key)) pairCounts.set(key, { bloodGroup: group, component, available: 0, reserved: 0 });
            }

            const forecasts = await Promise.all([...pairCounts.values()].map(async pair => {
                const key = `${pair.bloodGroup}|${pair.component}`;
                try {
                    const forecast = await forecastService.getForecast({
                        bloodGroup: pair.bloodGroup,
                        component: pair.component,
                        horizon: 7,
                        historicalDays: 90
                    });
                    return [key, { forecast, error: null }];
                } catch (error) {
                    return [key, { forecast: null, error: error.message || 'Forecast provider unavailable' }];
                }
            }));
            const forecastByPair = new Map(forecasts);

            for (const bloodGroup of BLOOD_GROUPS) {
                const stock = inventory.countsByBloodGroup[bloodGroup] || { available: 0, reserved: 0 };
                const thresholds = (settings.thresholds && settings.thresholds[bloodGroup]) || { critical: 5, low: 12, ideal: 30 };
                const expiredAvailableCount = units.filter(unit => {
                    if (unit.bloodGroup !== bloodGroup || unit.status !== 'AVAILABLE' || !unit.expiryDate) return false;
                    const expiryDay = String(unit.expiryDate).slice(0, 10);
                    return /^\d{4}-\d{2}-\d{2}$/.test(expiryDay) && expiryDay < todayString;
                }).length;
                const available = Math.max(0, (stock.available || 0) - expiredAvailableCount);
                const reserved = stock.reserved || 0;
                const criticalShortage = available < thresholds.critical;
                const lowShortage = available < thresholds.low;
                const matchingAlerts = activeAlerts.filter(alert => alert.bloodGroup === bloodGroup && (alert.type === 'CRITICAL_STOCK' || alert.type === 'LOW_STOCK'));
                const groupPairs = [...pairCounts.values()].filter(pair => pair.bloodGroup === bloodGroup);
                const groupForecastStates = groupPairs.map(pair => {
                    const record = forecastByPair.get(`${bloodGroup}|${pair.component}`);
                    return {
                        component: pair.component,
                        state: record && record.forecast ? record.forecast.state : 'UNAVAILABLE'
                    };
                });

                if (criticalShortage || lowShortage) {
                    const threshold = criticalShortage ? thresholds.critical : thresholds.low;
                    const thresholdLabel = criticalShortage ? 'critical' : 'low-stock';
                    const insufficientPairs = groupForecastStates.filter(item => item.state === 'INSUFFICIENT_DATA');
                    const forecastNote = !groupPairs.length ?
                        ' No matching usage/inventory component data was available for forecasting; this recommendation is based on configured stock thresholds.' :
                        insufficientPairs.length ?
                        ` Forecasting was insufficient for ${insufficientPairs.map(item => item.component).join(', ')}; this recommendation is based on configured stock thresholds, not predicted demand.` :
                        '';
                    const prioritySignals = {
                        criticalShortage,
                        lowShortage: !criticalShortage && lowShortage,
                        alertPresent: matchingAlerts.length > 0
                    };
                    const priority = calculatePriority(prioritySignals).priority;
                    candidates.push(makeRecommendation(now, {
                                    dedupeKey: `REPLENISH_STOCK:${bloodGroup}`,
                                    type: RECOMMENDATION_TYPES.REPLENISH_STOCK,
                                    priority,
                                    title: `${criticalShortage ? 'Address critical' : 'Review low'} ${bloodGroup} stock`,
                                    message: `${bloodGroup} has ${available} available unit(s) and ${reserved} reserved; the configured ${thresholdLabel} threshold is ${threshold}.`,
                                    reason: `Available stock is ${available < threshold ? `${threshold - available} below` : 'at'} the ${thresholdLabel} threshold of ${threshold}.${forecastNote}`,
          suggestedAction: `Review collection and authorized inter-facility transfer options for ${bloodGroup}; account for the ${reserved} reserved unit(s) before committing stock.`,
          bloodGroup,
          referenceType: 'BLOOD_GROUP',
          referenceId: bloodGroup,
          confidence: 'HIGH',
          prioritySignals,
          metadata: {
            availableUnits: available,
            reservedUnits: reserved,
            threshold,
            thresholdKind: thresholdLabel,
            availableByComponent: Object.fromEntries(groupPairs.map(pair => [pair.component, pair.available])),
            reservedByComponent: Object.fromEntries(groupPairs.map(pair => [pair.component, pair.reserved])),
            matchingAlertIds: matchingAlerts.map(alert => alert.id),
            forecastStates: groupForecastStates
          }
        }));
      }

      if (reserved > available && available >= thresholds.low) {
        const prioritySignals = { alertPresent: matchingAlerts.length > 0 };
        candidates.push(makeRecommendation(now, {
          dedupeKey: `MONITOR_STOCK:${bloodGroup}`,
          type: RECOMMENDATION_TYPES.MONITOR_STOCK,
          title: `Review reserved ${bloodGroup} inventory`,
          message: `${reserved} ${bloodGroup} unit(s) are reserved while ${available} are available.`,
          reason: 'Reserved inventory exceeds immediately available inventory while total available stock is above the configured low-stock threshold.',
          suggestedAction: 'Verify reservation assignments and expected release/issue dates in the transaction workflow.',
          bloodGroup,
          referenceType: 'BLOOD_GROUP',
          referenceId: bloodGroup,
          confidence: 'HIGH',
          prioritySignals,
          metadata: { availableUnits: available, reservedUnits: reserved, lowThreshold: thresholds.low }
        }));
      }
    }

    const expiryByPair = new Map();
    const dayMilliseconds = 86400000;
    for (const unit of units) {
      if (unit.status !== 'AVAILABLE' && unit.status !== 'RESERVED' && unit.status !== 'EXPIRED') continue;
      const expiryDate = unit.expiryDate ? new Date(`${String(unit.expiryDate).slice(0, 10)}T00:00:00.000Z`) : null;
      if (expiryDate && Number.isNaN(expiryDate.getTime())) continue;
      const daysRemaining = expiryDate ? Math.ceil((expiryDate.getTime() - today.getTime()) / dayMilliseconds) : null;
      const bloodGroup = unit.bloodGroup;
      const component = canonicalComponent(unit.component || unit.componentType);
      if (!BLOOD_GROUPS.includes(bloodGroup) || !COMPONENT_TYPES.includes(component)) continue;

      if (unit.status === 'EXPIRED' || (daysRemaining !== null && daysRemaining < 0)) {
        const isAvailableExpired = unit.status === 'AVAILABLE';
        const prioritySignals = { expiredAvailable: isAvailableExpired };
        candidates.push(makeRecommendation(now, {
          dedupeKey: `EXPIRY_RISK:${unit.id}`,
          type: RECOMMENDATION_TYPES.EXPIRY_RISK,
          title: `Review expired ${bloodGroup} ${component} unit`,
          message: `Unit ${unit.unitCode || unit.unitNumber || unit.id} is expired (recorded expiry: ${unit.expiryDate || 'not available'}) and remains in inventory with status ${unit.status}.`,
          reason: isAvailableExpired
            ? 'The expiry date has passed but the unit remains AVAILABLE, so it must be quarantined from issue pending staff review.'
            : 'The unit is marked EXPIRED and still requires the established quarantine/disposal workflow.',
          suggestedAction: 'Verify physical segregation and complete the existing expiry/discard transaction workflow; this recommendation does not change inventory status.',
          bloodGroup,
          component,
          referenceType: 'UNIT',
          referenceId: unit.id,
          prioritySignals,
          metadata: { unitCode: unit.unitCode || unit.unitNumber || unit.id, expiryDate: unit.expiryDate || null, inventoryStatus: unit.status }
        }));
        continue;
      }

      if (unit.status !== 'AVAILABLE' || daysRemaining > expiryNoticeDays) continue;
      const key = `${bloodGroup}|${component}`;
      if (!expiryByPair.has(key)) expiryByPair.set(key, []);
      expiryByPair.get(key).push({ id: unit.id, unitCode: unit.unitCode || unit.unitNumber || unit.id, expiryDate: unit.expiryDate, daysRemaining });
    }

    for (const [key, expiringUnits] of expiryByPair) {
      const [bloodGroup, component] = key.split('|');
      expiringUnits.sort((a, b) => a.daysRemaining - b.daysRemaining);
      const nearest = expiringUnits[0];
      const prioritySignals = {
        expiryDays: nearest.daysRemaining,
        alertPresent: activeAlerts.some(alert => alert.type === 'EXPIRING_SOON' && expiringUnits.some(unit => unit.id === alert.unitId))
      };
      candidates.push(makeRecommendation(now, {
        dedupeKey: `PRIORITIZE_EXPIRING:${key}`,
        type: RECOMMENDATION_TYPES.PRIORITIZE_EXPIRING,
        title: `Prioritize ${expiringUnits.length} ${bloodGroup} ${component} unit(s) nearing expiry`,
        message: `${expiringUnits.length} available unit(s) expire within ${expiryNoticeDays} days; the nearest expires ${nearest.expiryDate} (${nearest.daysRemaining} day(s)).`,
        reason: 'Recorded expiry dates place these available units inside the configured notice window.',
        suggestedAction: 'Review FIFO allocation and issue these units first when clinically appropriate through the normal transaction workflow.',
        bloodGroup,
        component,
        referenceType: 'UNIT_GROUP',
        referenceId: nearest.id,
        prioritySignals,
        metadata: { affectedUnitIds: expiringUnits.map(unit => unit.id), nearestExpiryDate: nearest.expiryDate, daysRemaining: nearest.daysRemaining, expiryNoticeDays }
      }));
    }

    for (const [key, pair] of pairCounts) {
      const forecastRecord = forecastByPair.get(key);
      const forecast = forecastRecord && forecastRecord.forecast;
      if (forecastRecord && forecastRecord.error) {
        candidates.push(makeRecommendation(now, {
          dedupeKey: `DATA_WARNING:${key}`,
          type: RECOMMENDATION_TYPES.DATA_WARNING,
          title: `Forecast service unavailable for ${pair.bloodGroup} ${pair.component}`,
          message: 'Demand-based recommendations could not be evaluated because the configured forecast provider returned an error.',
          reason: `Forecast provider error: ${forecastRecord.error}. Inventory threshold and expiry recommendations remain available.`,
          suggestedAction: 'Check forecast provider configuration and service health; no demand estimate has been substituted.',
          bloodGroup: pair.bloodGroup,
          component: pair.component,
          referenceType: 'BLOOD_GROUP_COMPONENT',
          referenceId: key,
          confidence: 'LOW',
          prioritySignals: {},
          metadata: { forecastState: 'UNAVAILABLE', availableUnits: pair.available, reservedUnits: pair.reserved }
        }));
        continue;
      }
      if (!forecast || forecast.state !== 'READY' || !Array.isArray(forecast.forecast)) continue;

      const projectedDemand = forecast.forecast.reduce((sum, point) => sum + Number(point.predictedDemand || 0), 0);
      const available = pair.available;
      const gap = projectedDemand - available;
      const gapRatio = gap > 0 ? gap / Math.max(available, 1) : 0;
      const hasMaterialGap = gap >= Math.max(1, available * 0.25);
      const ideal = (settings.thresholds && settings.thresholds[pair.bloodGroup] && settings.thresholds[pair.bloodGroup].ideal) || 30;

      if (hasMaterialGap) {
        const prioritySignals = {
          forecastGapRatio: gapRatio,
          alertPresent: activeAlerts.some(alert => alert.bloodGroup === pair.bloodGroup && alert.type === 'LOW_STOCK')
        };
        candidates.push(makeRecommendation(now, {
          dedupeKey: `HIGH_DEMAND:${key}`,
          type: RECOMMENDATION_TYPES.HIGH_DEMAND,
          title: `Forecast demand exceeds ${pair.bloodGroup} ${pair.component} availability`,
          message: `The 7-day forecast is ${projectedDemand.toFixed(2)} unit(s) against ${available} currently available.`,
          reason: `${forecast.dataPointsUsed} distinct demand date(s) informed the forecast; the projected availability gap is ${gap.toFixed(2)} unit(s).`,
          suggestedAction: 'Review replenishment options and planned reservations using the forecast as a planning signal; do not issue or purchase automatically.',
          bloodGroup: pair.bloodGroup,
          component: pair.component,
          referenceType: 'BLOOD_GROUP_COMPONENT',
          referenceId: key,
          confidence: forecast.confidence || 'LOW',
          prioritySignals,
          metadata: { availableUnits: available, reservedUnits: pair.reserved, forecastDemand: projectedDemand, projectedGap: gap, forecastProvider: forecast.provider, dataPointsUsed: forecast.dataPointsUsed }
        }));
      }
    }

    for (const bloodGroup of BLOOD_GROUPS) {
      const groupStock = inventory.countsByBloodGroup[bloodGroup] || { available: 0, reserved: 0 };
      const thresholds = (settings.thresholds && settings.thresholds[bloodGroup]) || { ideal: 30 };
      const ideal = Number(thresholds.ideal) || 30;
      const stockedPairs = [...pairCounts.values()].filter(pair => pair.bloodGroup === bloodGroup && pair.available > 0);
      const usableGroupAvailable = stockedPairs.reduce((sum, pair) => sum + pair.available, 0);
      if (!stockedPairs.length || usableGroupAvailable < ideal) continue;

      const readyForecasts = stockedPairs.map(pair => forecastByPair.get(`${bloodGroup}|${pair.component}`));
      if (readyForecasts.some(record => !record || !record.forecast || record.forecast.state !== 'READY')) continue;
      const projectedDemand = readyForecasts.reduce((sum, record) => sum + record.forecast.forecast.reduce((pairSum, point) => pairSum + Number(point.predictedDemand || 0), 0), 0);
      const totalHistoricalDemand = readyForecasts.reduce((sum, record) => sum + Number(record.forecast.totalHistoricalDemand || 0), 0);
      if (!totalHistoricalDemand || usableGroupAvailable <= projectedDemand * 2) continue;

      const minimumDataPoints = Math.min(...readyForecasts.map(record => record.forecast.dataPointsUsed || 0));
      candidates.push(makeRecommendation(now, {
        dedupeKey: `EXCESS_STOCK:${bloodGroup}`,
        type: RECOMMENDATION_TYPES.EXCESS_STOCK,
        title: `Review ${bloodGroup} stock distribution`,
        message: `${usableGroupAvailable} unexpired units are available across stocked components versus ${projectedDemand.toFixed(2)} forecast demand over 7 days; the configured ideal group threshold is ${ideal}.`,
        reason: `Excess is flagged only because total available stock meets/exceeds the configured ideal and is more than twice a non-zero group forecast. Each stocked component forecast is ready and uses at least ${minimumDataPoints} demand date(s).`,
        suggestedAction: 'Review expiry exposure and regional balancing needs before any transfer; no recipient bank or transfer quantity is assumed.',
        bloodGroup,
        referenceType: 'BLOOD_GROUP',
        referenceId: bloodGroup,
        confidence: readyForecasts.every(record => record.forecast.confidence === 'HIGH') ? 'HIGH' : 'MEDIUM',
        prioritySignals: {},
        metadata: {
          availableUnits: usableGroupAvailable,
          reservedUnits: groupStock.reserved,
          idealThreshold: ideal,
          forecastDemand: projectedDemand,
          forecastComponents: stockedPairs.map(pair => pair.component),
          forecastProvider: readyForecasts[0].forecast.provider,
          dataPointsUsed: minimumDataPoints
        }
      }));
    }

    const candidateByKey = new Map(candidates.map(candidate => [candidate.dedupeKey, candidate]));
    const existingEngine = existing.filter(item => item.source === ENGINE_SOURCE);
    const engineRecords = [];
    const seenExistingKeys = new Set();

    for (const item of existingEngine) {
      if (seenExistingKeys.has(item.dedupeKey)) {
        item.status = RECOMMENDATION_STATUSES.RESOLVED;
        item.resolutionSource = 'ENGINE';
        item.resolutionNotes = 'Duplicate engine record consolidated during refresh.';
        item.updatedAt = now.toISOString();
        continue;
      }
      seenExistingKeys.add(item.dedupeKey);
      const candidate = candidateByKey.get(item.dedupeKey);
      if (!candidate) {
        if (ACTIVE_STATUSES.includes(item.status)) {
          item.status = RECOMMENDATION_STATUSES.RESOLVED;
          item.resolutionSource = 'ENGINE';
          item.resolutionNotes = 'The evidence-backed trigger condition is no longer present.';
          item.resolvedAt = now.toISOString();
          item.metadata = { ...(item.metadata || {}), conditionActive: false };
          item.updatedAt = now.toISOString();
        } else if (item.status === RECOMMENDATION_STATUSES.RESOLVED && item.resolutionSource === 'USER' && item.metadata && item.metadata.conditionActive) {
          item.metadata.conditionActive = false;
          item.updatedAt = now.toISOString();
        }
        engineRecords.push(item);
        continue;
      }

      if (item.status === RECOMMENDATION_STATUSES.RESOLVED && item.resolutionSource === 'USER' && item.metadata && item.metadata.conditionActive) {
        engineRecords.push(item);
        candidateByKey.delete(item.dedupeKey);
        continue;
      }
      if (ACTIVE_STATUSES.includes(item.status)) {
        engineRecords.push({ ...item, ...candidate, id: item.id, status: item.status, createdAt: item.createdAt, updatedAt: now.toISOString() });
        candidateByKey.delete(item.dedupeKey);
        continue;
      }
      engineRecords.push(item);
    }

    for (const candidate of candidateByKey.values()) {
      engineRecords.push({ ...candidate, id: `rec_${randomUUID()}` });
    }

    const legacyRecords = existing.filter(item => item.source !== ENGINE_SOURCE);
    const recommendations = [...legacyRecords, ...engineRecords];
    await storage.replace('recommendations', recommendations);
    const activeRecommendations = recommendations.filter(item => ACTIVE_STATUSES.includes(item.status));

    return {
      message: 'Deterministic recommendations generated from current inventory, alerts, and available forecast history.',
      activeRecommendationsCount: activeRecommendations.length,
      totalRecommendations: recommendations.length,
      generatedCount: candidates.length,
      recommendations: activeRecommendations
    };
  }

  async refreshRecommendations() {
    return this.generateRecommendations();
  }
}

export const recommendationService = new RecommendationService();