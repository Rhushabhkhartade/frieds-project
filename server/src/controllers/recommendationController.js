import { recommendationService } from '../services/recommendationService.js';

export const listRecommendations = async(req, res, next) => {
    try {
        const result = await recommendationService.listRecommendations(req.query);
        res.status(200).json({
            success: true,
            data: result.recommendations,
            pagination: result.pagination
        });
    } catch (err) {
        next(err);
    }
};

export const updateStatus = async(req, res, next) => {
    try {
        const { status, notes } = req.body;
        const updated = await recommendationService.updateStatus(req.params.id, status, notes, req.user.id);
        res.status(200).json({
            success: true,
            data: updated,
            message: `Recommendation status updated to "${status}"`
        });
    } catch (err) {
        next(err);
    }
};

export const refreshRecommendations = async(req, res, next) => {
    try {
        const result = await recommendationService.generateRecommendations();
        res.status(200).json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (err) {
        next(err);
    }
};