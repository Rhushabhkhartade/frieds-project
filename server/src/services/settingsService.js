import { storage } from '../repositories/index.js';
import { NotFoundError } from '../middlewares/errorHandler.js';

class SettingsService {
  /**
   * Fetch current system settings and thresholds
   */
  async getSettings() {
    const settings = await storage.findAll('settings');
    if (!settings || (Array.isArray(settings) && settings.length === 0)) {
      throw new NotFoundError('System settings not initialized');
    }
    // If stored as an object directly or single-element array
    return Array.isArray(settings) ? settings[0] : settings;
  }

  /**
   * Update system settings and alert thresholds
   */
  async updateSettings(updates) {
    const current = await this.getSettings();
    const updated = {
      ...current,
      ...updates,
      thresholds: updates.thresholds ? { ...current.thresholds, ...updates.thresholds } : current.thresholds,
      updatedAt: new Date().toISOString()
    };

    // Save atomically via storage repository
    await storage.replace('settings', updated);
    return updated;
  }
}

export const settingsService = new SettingsService();
