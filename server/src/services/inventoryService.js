import { storage } from '../repositories/index.js';
import { NotFoundError, ConflictError, BadRequestError } from '../middlewares/errorHandler.js';
import { BLOOD_GROUPS, COMPONENT_TYPES, UNIT_STATUSES } from '../config/constants.js';
import { settingsService } from './settingsService.js';
import { alertService } from './alertService.js';

class InventoryService {
  /**
   * List blood units with multi-criteria filtering, search, and pagination
   */
  async listUnits(query = {}) {
    const {
      bloodGroup,
      component,
      status,
      expiryBefore,
      search,
      page = 1,
      limit = 20
    } = query;

    let units = await storage.findAll('units');
    if (!Array.isArray(units)) {
      units = [];
    }

    // Filter by Blood Group
    if (bloodGroup) {
      units = units.filter(u => u.bloodGroup?.toUpperCase() === bloodGroup.toUpperCase());
    }

    // Filter by Component (supports component or componentType)
    if (component) {
      const compUpper = component.toUpperCase();
      units = units.filter(u =>
        (u.component && u.component.toUpperCase() === compUpper) ||
        (u.componentType && u.componentType.toUpperCase() === compUpper)
      );
    }

    // Filter by Status
    if (status) {
      const statusUpper = status.toUpperCase();
      units = units.filter(u => u.status?.toUpperCase() === statusUpper);
    }

    // Filter by Expiry Before date
    if (expiryBefore) {
      units = units.filter(u => u.expiryDate <= expiryBefore);
    }

    // Multi-field text search
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      units = units.filter(u => {
        const code = (u.unitCode || u.unitNumber || '').toLowerCase();
        const bg = (u.bloodGroup || '').toLowerCase();
        const comp = (u.component || u.componentType || '').toLowerCase();
        const donor = (u.donorReference || u.donor || '').toLowerCase();
        const id = (u.id || '').toLowerCase();
        const notes = (u.notes || '').toLowerCase();
        return (
          code.includes(s) ||
          bg.includes(s) ||
          comp.includes(s) ||
          donor.includes(s) ||
          id.includes(s) ||
          notes.includes(s)
        );
      });
    }

    // Sort: newest created or collected first
    units.sort((a, b) => new Date(b.createdAt || b.collectionDate || 0) - new Date(a.createdAt || a.collectionDate || 0));

    const total = units.length;
    const startIndex = (page - 1) * limit;
    const paginated = units.slice(startIndex, startIndex + limit);

    // Normalize unit objects to have both unitCode & unitNumber
    const normalizedUnits = paginated.map(u => ({
      ...u,
      unitCode: u.unitCode || u.unitNumber || u.id,
      unitNumber: u.unitNumber || u.unitCode || u.id,
      component: u.component || u.componentType,
      volume: u.volume || u.volumeMl
    }));

    return {
      units: normalizedUnits,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Find single unit by internal ID or barcode/unitCode
   */
  async getUnitById(id) {
    const units = await storage.findAll('units');
    if (!Array.isArray(units)) {
      throw new NotFoundError(`Unit "${id}" not found`);
    }

    const found = units.find(
      u => u && (String(u.id) === String(id) || String(u.unitCode) === String(id) || String(u.unitNumber) === String(id))
    );

    if (!found) {
      throw new NotFoundError(`Blood unit with identifier "${id}" was not found`);
    }

    return {
      ...found,
      unitCode: found.unitCode || found.unitNumber || found.id,
      unitNumber: found.unitNumber || found.unitCode || found.id,
      component: found.component || found.componentType,
      volume: found.volume || found.volumeMl
    };
  }

  /**
   * Create a new blood unit with barcode uniqueness check and intake transaction
   */
  async createUnit(data) {
    const unitCode = data.unitCode || data.unitNumber;
    if (!unitCode) {
      throw new BadRequestError('Unit code or barcode is required', 'MISSING_UNIT_CODE');
    }

    // Verify unique unitCode across repository
    const allUnits = await storage.findAll('units');
    const duplicate = allUnits.find(
      u => u && ((u.unitCode && u.unitCode.toLowerCase() === unitCode.toLowerCase()) ||
                 (u.unitNumber && u.unitNumber.toLowerCase() === unitCode.toLowerCase()))
    );

    if (duplicate) {
      throw new ConflictError(
        `A blood unit with code "${unitCode}" already exists in the inventory (ID: ${duplicate.id}).`,
        'DUPLICATE_UNIT_CODE'
      );
    }

    const now = new Date();
    const id = data.id || `bu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const component = data.component || data.componentType || 'WHOLE_BLOOD';
    const volume = data.volume || data.volumeMl || 350;

    const unitRecord = {
      id,
      unitCode,
      unitNumber: unitCode,
      bloodGroup: data.bloodGroup,
      component,
      componentType: component,
      volume,
      volumeMl: volume,
      collectionDate: data.collectionDate,
      expiryDate: data.expiryDate,
      status: data.status || UNIT_STATUSES.AVAILABLE,
      storageLocation: data.storageLocation || {
        refrigerator: 'FRIDGE-01',
        shelf: 'RACK-A1'
      },
      donor: data.donor || data.donorReference || null,
      donorReference: data.donorReference || data.donor || null,
      notes: data.notes || '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    // Save unit atomically
    await storage.create('units', unitRecord);

    // Record initial ADD transaction
    const initialTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      unitId: id,
      unitCode,
      unitNumber: unitCode,
      bloodGroup: data.bloodGroup,
      component,
      operation: 'ADD',
      type: 'ADD',
      previousStatus: null,
      newStatus: unitRecord.status,
      recipientOrHospital: 'Donation Intake Facility',
      actor: 'staff_admin',
      notes: data.notes || `Initial donor collection intake for ${unitCode}`,
      timestamp: now.toISOString()
    };

    await storage.create('transactions', initialTransaction);

    // Refresh alert checks in background
    alertService.refreshAlerts().catch(() => {});

    return unitRecord;
  }

  /**
   * Update unit metadata and validate any status transitions
   */
  async updateUnit(id, updates) {
    const existing = await this.getUnitById(id);

    // If unitCode is being modified, verify uniqueness
    const newCode = updates.unitCode || updates.unitNumber;
    if (newCode && newCode !== existing.unitCode && newCode !== existing.unitNumber) {
      const allUnits = await storage.findAll('units');
      const duplicate = allUnits.find(
        u => u && u.id !== existing.id &&
             ((u.unitCode && u.unitCode.toLowerCase() === newCode.toLowerCase()) ||
              (u.unitNumber && u.unitNumber.toLowerCase() === newCode.toLowerCase()))
      );
      if (duplicate) {
        throw new ConflictError(
          `Unit code "${newCode}" is already taken by another unit (${duplicate.id}).`,
          'DUPLICATE_UNIT_CODE'
        );
      }
    }

    const previousStatus = existing.status;
    const newStatus = updates.status || previousStatus;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Status transition validation
    if (newStatus !== previousStatus) {
      if (newStatus === UNIT_STATUSES.USED && existing.expiryDate < todayStr) {
        throw new BadRequestError(
          `Cannot mark expired unit as USED (Expired on ${existing.expiryDate}).`,
          'EXPIRED_UNIT_USE_FORBIDDEN'
        );
      }

      // Record transaction for status change
      const tx = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        unitId: existing.id,
        unitCode: newCode || existing.unitCode,
        unitNumber: newCode || existing.unitCode,
        bloodGroup: updates.bloodGroup || existing.bloodGroup,
        component: updates.component || updates.componentType || existing.component,
        operation: 'UPDATE',
        type: 'UPDATE',
        previousStatus,
        newStatus,
        recipientOrHospital: 'Transfusion Center Update',
        actor: 'staff_admin',
        notes: updates.notes || `Unit status updated from ${previousStatus} to ${newStatus}`,
        timestamp: now.toISOString()
      };
      await storage.create('transactions', tx);
    }

    const sanitizedUpdates = {
      ...updates,
      ...(newCode && { unitCode: newCode, unitNumber: newCode }),
      ...(updates.component && { componentType: updates.component }),
      ...(updates.volume && { volumeMl: updates.volume }),
      updatedAt: now.toISOString()
    };

    const updated = await storage.update('units', existing.id, sanitizedUpdates);

    // Refresh alerts if status, bloodGroup, or expiryDate changed
    if (updates.status || updates.bloodGroup || updates.expiryDate) {
      alertService.refreshAlerts().catch(() => {});
    }

    return updated;
  }

  /**
   * Delete a blood unit safely while preserving transaction audit history
   */
  async deleteUnit(id) {
    const existing = await this.getUnitById(id);

    // Check if unit is referenced in transactions
    const allTransactions = await storage.findAll('transactions');
    const relatedTxs = allTransactions.filter(t => t.unitId === existing.id);

    // Annotate associated transactions to preserve clinical audit integrity
    if (relatedTxs.length > 0) {
      for (const tx of relatedTxs) {
        await storage.update('transactions', tx.id, {
          unitDeleted: true,
          unitDeletedAt: new Date().toISOString()
        });
      }
    }

    // Record an audit log for unit deletion
    const deleteAuditTx = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      unitId: existing.id,
      unitCode: existing.unitCode,
      unitNumber: existing.unitCode,
      bloodGroup: existing.bloodGroup,
      component: existing.component,
      operation: 'DISCARD',
      type: 'DISCARD',
      previousStatus: existing.status,
      newStatus: 'DELETED',
      recipientOrHospital: 'Disposal Protocol',
      actor: 'staff_admin',
      notes: `Blood unit ${existing.unitCode} was removed from active inventory registry.`,
      timestamp: new Date().toISOString()
    };
    await storage.create('transactions', deleteAuditTx);

    // Delete unit from storage
    await storage.delete('units', existing.id);

    // Re-evaluate alerts
    alertService.refreshAlerts().catch(() => {});

    return {
      id: existing.id,
      unitCode: existing.unitCode,
      deleted: true,
      message: `Unit "${existing.unitCode}" deleted and audit ledger updated.`
    };
  }

  /**
   * Calculate live inventory summary for dashboards and monitoring
   */
  async getInventorySummary() {
    const units = await storage.findAll('units');
    const settings = await settingsService.getSettings();

    const now = new Date();
    const expiryNoticeDays = settings.expiryNoticeDays || 7;

    let availableUnits = 0;
    let reservedUnits = 0;
    let usedUnits = 0;
    let expiredUnits = 0;
    let discardedUnits = 0;
    let expiringSoonUnitsCount = 0;

    // Initialize counts for each of the 8 blood groups
    const countsByBloodGroup = {};
    for (const bg of BLOOD_GROUPS) {
      countsByBloodGroup[bg] = {
        total: 0,
        available: 0,
        reserved: 0,
        used: 0,
        expired: 0,
        discarded: 0
      };
    }

    // Initialize counts for each component type
    const countsByComponent = {};
    for (const comp of COMPONENT_TYPES) {
      countsByComponent[comp] = {
        total: 0,
        available: 0
      };
    }

    // Tally unit records
    for (const u of units) {
      const bg = u.bloodGroup;
      const comp = u.component || u.componentType;
      const st = u.status;

      // Group totals
      if (countsByBloodGroup[bg]) {
        countsByBloodGroup[bg].total++;
        if (st === UNIT_STATUSES.AVAILABLE) countsByBloodGroup[bg].available++;
        else if (st === UNIT_STATUSES.RESERVED) countsByBloodGroup[bg].reserved++;
        else if (st === UNIT_STATUSES.USED || st === 'DISPATCHED') countsByBloodGroup[bg].used++;
        else if (st === UNIT_STATUSES.EXPIRED) countsByBloodGroup[bg].expired++;
        else if (st === UNIT_STATUSES.DISCARDED) countsByBloodGroup[bg].discarded++;
      }

      // Component totals
      if (comp && countsByComponent[comp]) {
        countsByComponent[comp].total++;
        if (st === UNIT_STATUSES.AVAILABLE) countsByComponent[comp].available++;
      }

      // Status totals
      if (st === UNIT_STATUSES.AVAILABLE) {
        availableUnits++;
        // Check if expiring soon
        const expiryDate = new Date(u.expiryDate);
        const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= expiryNoticeDays && diffDays >= 0) {
          expiringSoonUnitsCount++;
        }
      } else if (st === UNIT_STATUSES.RESERVED) {
        reservedUnits++;
      } else if (st === UNIT_STATUSES.USED || st === 'DISPATCHED') {
        usedUnits++;
      } else if (st === UNIT_STATUSES.EXPIRED) {
        expiredUnits++;
      } else if (st === UNIT_STATUSES.DISCARDED) {
        discardedUnits++;
      }
    }

    // Determine critical and low stock blood groups
    const criticalGroups = [];
    const lowStockGroups = [];

    for (const bg of BLOOD_GROUPS) {
      const available = countsByBloodGroup[bg].available;
      const thresholds = settings.thresholds?.[bg] || { critical: 5, low: 12 };

      if (available <= thresholds.critical) {
        criticalGroups.push({
          bloodGroup: bg,
          available,
          criticalThreshold: thresholds.critical,
          deficit: Math.max(1, thresholds.critical - available)
        });
      } else if (available <= thresholds.low) {
        lowStockGroups.push({
          bloodGroup: bg,
          available,
          lowThreshold: thresholds.low,
          deficit: Math.max(1, thresholds.low - available)
        });
      }
    }

    return {
      totalUnits: units.length,
      availableUnits,
      reservedUnits,
      usedUnits,
      expiredUnits,
      discardedUnits,
      expiringSoonUnitsCount,
      countsByBloodGroup,
      countsByComponent,
      criticalStockGroups: criticalGroups,
      lowStockGroups,
      criticalGroupsCount: criticalGroups.length,
      lowStockGroupsCount: lowStockGroups.length,
      facilityName: settings.bloodBankName || 'Regional Transfusion Center',
      calculatedAt: now.toISOString()
    };
  }
}

export const inventoryService = new InventoryService();
