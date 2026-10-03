import { storage } from '../repositories/index.js';
import { BLOOD_GROUPS } from '../config/constants.js';

export const getSystemStatus = async (req, res, next) => {
  try {
    const units = await storage.findAll('units');
    const alerts = await storage.findAll('alerts');
    const recs = await storage.findAll('recommendations');
    const bloodGroups = await storage.findAll('blood_groups');

    const activeAlerts = Array.isArray(alerts)
      ? alerts.filter(a => a.status === 'ACTIVE').length
      : 0;

    const activeRecs = Array.isArray(recs)
      ? recs.filter(r => r.status === 'ACTIVE' || r.status === 'PENDING').length
      : 0;

    res.status(200).json({
      success: true,
      service: 'BLOOD AI API',
      data: {
        storageReady: true,
        supportedBloodGroups: BLOOD_GROUPS,
        bloodGroupsCount: bloodGroups.length,
        totalUnits: Array.isArray(units) ? units.length : 0,
        activeAlerts,
        activeRecommendations: activeRecs,
        environment: process.env.NODE_ENV || 'development',
        uptimeSeconds: Math.floor(process.uptime())
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};
