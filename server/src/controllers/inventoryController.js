import { inventoryService } from '../services/inventoryService.js';

export const listUnits = async (req, res, next) => {
  try {
    const result = await inventoryService.listUnits(req.query);
    res.status(200).json({
      success: true,
      data: result.units,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
};

export const getUnitById = async (req, res, next) => {
  try {
    const unit = await inventoryService.getUnitById(req.params.id);
    res.status(200).json({
      success: true,
      data: unit
    });
  } catch (err) {
    next(err);
  }
};

export const createUnit = async (req, res, next) => {
  try {
    const newUnit = await inventoryService.createUnit(req.body);
    res.status(201).json({
      success: true,
      data: newUnit,
      message: 'Blood unit intake completed successfully'
    });
  } catch (err) {
    next(err);
  }
};

export const updateUnit = async (req, res, next) => {
  try {
    const updated = await inventoryService.updateUnit(req.params.id, req.body);
    res.status(200).json({
      success: true,
      data: updated,
      message: 'Blood unit updated successfully'
    });
  } catch (err) {
    next(err);
  }
};

export const deleteUnit = async (req, res, next) => {
  try {
    const result = await inventoryService.deleteUnit(req.params.id);
    res.status(200).json({
      success: true,
      data: result,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
};

export const getInventorySummary = async (req, res, next) => {
  try {
    const summary = await inventoryService.getInventorySummary();
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (err) {
    next(err);
  }
};
