import { storage } from '../repositories/index.js';
import { settingsService } from './settingsService.js';
import { NotFoundError } from '../middlewares/errorHandler.js';
import { ALERT_TYPES, ALERT_SEVERITIES, ALERT_STATUSES, BLOOD_GROUPS } from '../config/constants.js';

class AlertService {
    /**
     * List all alerts with optional filtering and pagination
     */
    async listAlerts(query = {}) {
        const { status, severity, type, bloodGroup, readState, source, page = 1, limit = 50 } = query;
        let alerts = await storage.findAll('alerts');

        if (!Array.isArray(alerts)) {
            alerts = [];
        }

        if (status) {
            alerts = alerts.filter(a => a.status === status);
        }
        if (severity) {
            alerts = alerts.filter(a => a.severity === severity);
        }
        if (type) {
            alerts = alerts.filter(a => a.type === type);
        }
        if (bloodGroup) {
            alerts = alerts.filter(a => a.bloodGroup === bloodGroup);
        }
        if (readState) {
            alerts = alerts.filter(a => (a.isRead ? 'READ' : 'UNREAD') === readState);
        }
        if (source) {
            alerts = alerts.filter(a => a.source === source);
        }

        // Sort: ACTIVE first, then newest first
        alerts.sort((a, b) => {
            if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
            if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

        const total = alerts.length;
        const startIndex = (page - 1) * limit;
        const paginated = alerts.slice(startIndex, startIndex + limit);

        return {
            alerts: paginated,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / limit) || 1
            }
        };
    }

    /**
     * Find single alert by ID
     */
    async getAlertById(id) {
        const alert = await storage.findById('alerts', id);
        if (!alert) {
            throw new NotFoundError(`Alert with ID "${id}" was not found`);
        }
        return alert;
    }

    async getAlertSummary() {
        const alerts = await storage.findAll('alerts');
        const records = Array.isArray(alerts) ? alerts : [];
        const unresolved = records.filter(a => a.status === ALERT_STATUSES.ACTIVE || a.status === ALERT_STATUSES.ACKNOWLEDGED);
        const countByType = Object.fromEntries(Object.values(ALERT_TYPES).map(type => [type, 0]));
        const countBySeverity = Object.fromEntries(Object.values(ALERT_SEVERITIES).map(severity => [severity, 0]));

        for (const alert of unresolved) {
            countByType[alert.type] = (countByType[alert.type] || 0) + 1;
            countBySeverity[alert.severity] = (countBySeverity[alert.severity] || 0) + 1;
        }

        return {
            total: records.length,
            unresolved: unresolved.length,
            unread: unresolved.filter(a => !a.isRead).length,
            read: unresolved.filter(a => a.isRead).length,
            resolved: records.filter(a => a.status === ALERT_STATUSES.RESOLVED).length,
            byType: countByType,
            bySeverity: countBySeverity
        };
    }

    async setAlertReadState(id, isRead = true, readBy = null) {
        const alert = await this.getAlertById(id);
        if (alert.isRead === isRead) return alert;
        return storage.update('alerts', id, {
            isRead,
            readAt: isRead ? new Date().toISOString() : null,
            readBy: isRead ? readBy : null
        });
    }

    /**
     * Resolve an alert manually or programmatically
     */
    async resolveAlert(id, reason = 'Manually resolved by administrator', resolvedBy = 'staff') {
        const alert = await this.getAlertById(id);
        if (alert.status === ALERT_STATUSES.RESOLVED) {
            return alert;
        }

        const resolvedAt = new Date().toISOString();
        const updated = await storage.update('alerts', id, {
            status: ALERT_STATUSES.RESOLVED,
            isRead: true,
            readAt: resolvedAt,
            readBy: resolvedBy,
            dismissed: true,
            dismissalActive: true,
            dismissedAt: resolvedAt,
            resolutionReason: reason,
            resolvedBy,
            resolvedAt
        });

        return updated;
    }

    /**
     * Refresh all alerts based on current inventory counts and configured thresholds in settings.json.
     * Completely idempotent: avoids creating duplicate active alerts for the same underlying issue.
     */
    async refreshAlerts() {
        const settings = await settingsService.getSettings();
        const units = await storage.findAll('units');
        let alerts = await storage.findAll('alerts');

        if (!Array.isArray(alerts)) {
            alerts = [];
        }

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const expiryNoticeDays = settings.expiryNoticeDays || 7;

        const newAlerts = [...alerts];

        // Helper: Find existing active alert by criteria
        const findActiveAlert = (predicate) => {
            return newAlerts.find(a => a.status === ALERT_STATUSES.ACTIVE && predicate(a));
        };
        const wasDismissed = (predicate) => newAlerts.some(a => a.status === ALERT_STATUSES.RESOLVED && a.dismissalActive && predicate(a));
        const clearDismissal = (predicate) => {
            for (const alert of newAlerts) {
                if (alert.status === ALERT_STATUSES.RESOLVED && alert.dismissalActive && predicate(alert)) {
                    alert.dismissalActive = false;
                }
            }
        };

        // 1. EVALUATE BLOOD GROUP STOCK THRESHOLDS (CRITICAL_STOCK & LOW_STOCK)
        for (const group of BLOOD_GROUPS) {
            const groupUnits = units.filter(u => u.bloodGroup === group);
            const availableUnits = groupUnits.filter(u => u.status === 'AVAILABLE').length;

            const thresholds = (settings.thresholds && settings.thresholds[group]) || {
                critical: 5,
                low: 12,
                ideal: 30
            };

            const existingCritical = findActiveAlert(a => a.type === ALERT_TYPES.CRITICAL_STOCK && a.bloodGroup === group);
            const existingLow = findActiveAlert(a => a.type === ALERT_TYPES.LOW_STOCK && a.bloodGroup === group);

            if (availableUnits <= thresholds.critical) {
                clearDismissal(a => a.type === ALERT_TYPES.LOW_STOCK && a.bloodGroup === group);
                // Critical Deficit condition
                if (existingCritical) {
                    existingCritical.currentCount = availableUnits;
                    existingCritical.threshold = thresholds.critical;
                } else if (!wasDismissed(a => a.type === ALERT_TYPES.CRITICAL_STOCK && a.bloodGroup === group)) {
                    // If a low-stock alert existed, resolve it since it's upgraded to critical
                    if (existingLow) {
                        existingLow.status = ALERT_STATUSES.RESOLVED;
                        existingLow.resolvedAt = now.toISOString();
                        existingLow.resolutionReason = 'Upgraded to CRITICAL_STOCK alert';
                    }

                    newAlerts.push({
                        id: `alt_crit_${group.replace(/[^A-Z]/gi, '').toLowerCase()}_${Date.now()}`,
                        type: ALERT_TYPES.CRITICAL_STOCK,
                        bloodGroup: group,
                        unitId: null,
                        severity: ALERT_SEVERITIES.CRITICAL,
                        message: `${group} inventory is at ${availableUnits} units, critically below minimum safety threshold of ${thresholds.critical} units.`,
                        currentCount: availableUnits,
                        threshold: thresholds.critical,
                        status: ALERT_STATUSES.ACTIVE,
                        isRead: false,
                        source: 'INVENTORY',
                        referenceType: 'BLOOD_GROUP',
                        referenceId: group,
                        createdAt: now.toISOString()
                    });
                }
            } else if (availableUnits <= thresholds.low) {
                clearDismissal(a => a.type === ALERT_TYPES.CRITICAL_STOCK && a.bloodGroup === group);
                // Low Stock condition
                if (existingCritical) {
                    existingCritical.status = ALERT_STATUSES.RESOLVED;
                    existingCritical.resolvedAt = now.toISOString();
                    existingCritical.resolutionReason = 'Stock improved from critical to low threshold';
                }

                if (existingLow) {
                    existingLow.currentCount = availableUnits;
                    existingLow.threshold = thresholds.low;
                } else if (!wasDismissed(a => a.type === ALERT_TYPES.LOW_STOCK && a.bloodGroup === group)) {
                    newAlerts.push({
                        id: `alt_low_${group.replace(/[^A-Z]/gi, '').toLowerCase()}_${Date.now()}`,
                        type: ALERT_TYPES.LOW_STOCK,
                        bloodGroup: group,
                        unitId: null,
                        severity: ALERT_SEVERITIES.WARNING,
                        message: `${group} inventory is at ${availableUnits} units, below recommended buffer of ${thresholds.low} units.`,
                        currentCount: availableUnits,
                        threshold: thresholds.low,
                        status: ALERT_STATUSES.ACTIVE,
                        isRead: false,
                        source: 'INVENTORY',
                        referenceType: 'BLOOD_GROUP',
                        referenceId: group,
                        createdAt: now.toISOString()
                    });
                }
            } else {
                // Healthy stock - auto-resolve any active stock level alerts for this group
                clearDismissal(a => (a.type === ALERT_TYPES.CRITICAL_STOCK || a.type === ALERT_TYPES.LOW_STOCK) && a.bloodGroup === group);
                if (existingCritical) {
                    existingCritical.status = ALERT_STATUSES.RESOLVED;
                    existingCritical.resolvedAt = now.toISOString();
                    existingCritical.resolutionReason = `Stock replenished to ${availableUnits} units (above safety threshold).`;
                }
                if (existingLow) {
                    existingLow.status = ALERT_STATUSES.RESOLVED;
                    existingLow.resolvedAt = now.toISOString();
                    existingLow.resolutionReason = `Stock replenished to ${availableUnits} units (above buffer threshold).`;
                }
            }
        }

        // 2. EVALUATE UNIT-LEVEL EXPIRIES (EXPIRING_SOON & EXPIRED)
        for (const unit of units) {
            const unitCode = unit.unitCode || unit.unitNumber || unit.id;
            const existingExpiring = findActiveAlert(a => a.type === ALERT_TYPES.EXPIRING_SOON && a.unitId === unit.id);
            const existingExpired = findActiveAlert(a => a.type === ALERT_TYPES.EXPIRED && a.unitId === unit.id);

            // If unit is no longer AVAILABLE or RESERVED (e.g. USED or DISCARDED), resolve alerts
            if (unit.status !== 'AVAILABLE' && unit.status !== 'RESERVED' && unit.status !== 'EXPIRED') {
                clearDismissal(a => (a.type === ALERT_TYPES.EXPIRING_SOON || a.type === ALERT_TYPES.EXPIRED) && a.unitId === unit.id);
                if (existingExpiring) {
                    existingExpiring.status = ALERT_STATUSES.RESOLVED;
                    existingExpiring.resolvedAt = now.toISOString();
                    existingExpiring.resolutionReason = `Unit status transitioned to ${unit.status}`;
                }
                if (existingExpired) {
                    existingExpired.status = ALERT_STATUSES.RESOLVED;
                    existingExpired.resolvedAt = now.toISOString();
                    existingExpired.resolutionReason = `Unit status transitioned to ${unit.status}`;
                }
                continue;
            }

            const expiryDate = new Date(unit.expiryDate);
            const diffTime = expiryDate.getTime() - now.getTime();
            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (unit.status === 'EXPIRED' || daysRemaining < 0 || unit.expiryDate < todayStr) {
                // EXPIRED
                clearDismissal(a => a.type === ALERT_TYPES.EXPIRING_SOON && a.unitId === unit.id);
                if (existingExpiring) {
                    existingExpiring.status = ALERT_STATUSES.RESOLVED;
                    existingExpiring.resolvedAt = now.toISOString();
                    existingExpiring.resolutionReason = 'Unit reached expiration date';
                }
                if (!existingExpired && !wasDismissed(a => a.type === ALERT_TYPES.EXPIRED && a.unitId === unit.id)) {
                    newAlerts.push({
                        id: `alt_exp_${unit.id}_${Date.now()}`,
                        type: ALERT_TYPES.EXPIRED,
                        bloodGroup: unit.bloodGroup,
                        unitId: unit.id,
                        severity: ALERT_SEVERITIES.CRITICAL,
                        message: `Blood unit ${unitCode} (${unit.bloodGroup} ${unit.component || unit.componentType}) expired on ${unit.expiryDate}. Segregate and discard immediately.`,
                        status: ALERT_STATUSES.ACTIVE,
                        isRead: false,
                        source: 'INVENTORY',
                        referenceType: 'UNIT',
                        referenceId: unit.id,
                        createdAt: now.toISOString()
                    });
                }
            } else if (daysRemaining <= expiryNoticeDays) {
                // EXPIRING SOON
                clearDismissal(a => a.type === ALERT_TYPES.EXPIRED && a.unitId === unit.id);
                if (existingExpiring) {
                    existingExpiring.daysRemaining = daysRemaining;
                } else if (!wasDismissed(a => a.type === ALERT_TYPES.EXPIRING_SOON && a.unitId === unit.id)) {
                    newAlerts.push({
                        id: `alt_expsoon_${unit.id}_${Date.now()}`,
                        type: ALERT_TYPES.EXPIRING_SOON,
                        bloodGroup: unit.bloodGroup,
                        unitId: unit.id,
                        severity: ALERT_SEVERITIES.WARNING,
                        message: `Unit ${unitCode} (${unit.bloodGroup} ${unit.component || unit.componentType}) expires in ${daysRemaining} day(s) on ${unit.expiryDate}. Prioritize FIFO dispatch.`,
                        daysRemaining,
                        status: ALERT_STATUSES.ACTIVE,
                        isRead: false,
                        source: 'INVENTORY',
                        referenceType: 'UNIT',
                        referenceId: unit.id,
                        createdAt: now.toISOString()
                    });
                }
            } else {
                clearDismissal(a => (a.type === ALERT_TYPES.EXPIRING_SOON || a.type === ALERT_TYPES.EXPIRED) && a.unitId === unit.id);
            }
        }

        // Save alerts to atomic storage
        await storage.replace('alerts', newAlerts);

        const activeCount = newAlerts.filter(a => a.status === ALERT_STATUSES.ACTIVE).length;
        return {
            message: 'Alerts evaluated and refreshed successfully',
            activeAlertsCount: activeCount,
            totalAlerts: newAlerts.length,
            activeAlerts: newAlerts.filter(a => a.status === ALERT_STATUSES.ACTIVE)
        };
    }
}

export const alertService = new AlertService();