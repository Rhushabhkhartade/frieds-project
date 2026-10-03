import { forecastService } from '../services/forecastService.js';

export const getForecast = async(req, res, next) => {
    try {
        const forecast = await forecastService.getForecast(req.query);
        res.status(200).json({ success: true, data: forecast });
    } catch (err) {
        next(err);
    }
};