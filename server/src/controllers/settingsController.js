import { settingsService } from '../services/settingsService.js';

export const getSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getSettings();
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (err) {
    next(err);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const updated = await settingsService.updateSettings(req.body);
    res.status(200).json({
      success: true,
      data: updated,
      message: 'System settings and thresholds updated successfully'
    });
  } catch (err) {
    next(err);
  }
};
