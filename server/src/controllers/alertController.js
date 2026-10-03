import { alertService } from '../services/alertService.js';

export const listAlerts = async(req, res, next) => {
    try {
        const result = await alertService.listAlerts(req.query);
        res.status(200).json({
            success: true,
            data: result.alerts,
            pagination: result.pagination
        });
    } catch (err) {
        next(err);
    }
};

export const getAlertById = async(req, res, next) => {
    try {
        const alert = await alertService.getAlertById(req.params.id);
        res.status(200).json({
            success: true,
            data: alert
        });
    } catch (err) {
        next(err);
    }
};

export const getAlertSummary = async(req, res, next) => {
    try {
        const summary = await alertService.getAlertSummary();
        res.status(200).json({ success: true, data: summary });
    } catch (err) {
        next(err);
    }
};

export const setAlertReadState = async(req, res, next) => {
    try {
        const updated = await alertService.setAlertReadState(req.params.id, req.body.isRead, req.user.id);
        res.status(200).json({ success: true, data: updated, message: 'Alert read state updated' });
    } catch (err) {
        next(err);
    }
};

export const resolveAlert = async(req, res, next) => {
    try {
        const reason = req.body.reason || 'Manually resolved by administrator';
        const resolvedBy = req.user.id;
        const updated = await alertService.resolveAlert(req.params.id, reason, resolvedBy);
        res.status(200).json({
            success: true,
            data: updated,
            message: 'Alert resolved successfully'
        });
    } catch (err) {
        next(err);
    }
};

export const refreshAlerts = async(req, res, next) => {
    try {
        const result = await alertService.refreshAlerts();
        res.status(200).json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (err) {
        next(err);
    }
};