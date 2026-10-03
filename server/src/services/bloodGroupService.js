import { storage } from '../repositories/index.js';
import { settingsService } from './settingsService.js';
import { NotFoundError } from '../middlewares/errorHandler.js';

class BloodGroupService {
  /**
   * Return all 8 supported blood groups with medical compatibility,
   * live inventory counts, and safety threshold status.
   */
  async getAllBloodGroups() {
    const groups = await storage.findAll('blood_groups');
    const units = await storage.findAll('units');
    const settings = await settingsService.getSettings();

    return groups.map(group => {
      const code = group.code;
      // Filter units matching this blood group
      const groupUnits = units.filter(u => u.bloodGroup === code);
      const availableUnits = groupUnits.filter(u => u.status === 'AVAILABLE').length;
      const reservedUnits = groupUnits.filter(u => u.status === 'RESERVED').length;
      const totalUnits = groupUnits.length;

      // Read configured thresholds or fall back to group defaults
      const thresholds = settings.thresholds?.[code] || {
        critical: group.criticalThreshold || 5,
        low: group.lowThreshold || 12,
        ideal: group.idealStock || 30
      };

      let stockStatus = 'OPTIMAL';
      if (availableUnits <= thresholds.critical) {
        stockStatus = 'CRITICAL';
      } else if (availableUnits <= thresholds.low) {
        stockStatus = 'LOW';
      }

      return {
        ...group,
        criticalThreshold: thresholds.critical,
        lowThreshold: thresholds.low,
        idealStock: thresholds.ideal,
        stockStatus,
        inventory: {
          total: totalUnits,
          available: availableUnits,
          reserved: reservedUnits,
          deficit: Math.max(0, thresholds.critical - availableUnits)
        }
      };
    });
  }

  /**
   * Get single blood group details
   */
  async getBloodGroupByCode(code) {
    const all = await this.getAllBloodGroups();
    const found = all.find(g => g.code.toUpperCase() === code.toUpperCase());
    if (!found) {
      throw new NotFoundError(`Blood group "${code}" is not a recognized blood group`);
    }
    return found;
  }
}

export const bloodGroupService = new BloodGroupService();
