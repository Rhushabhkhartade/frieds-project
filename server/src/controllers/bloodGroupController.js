import { bloodGroupService } from '../services/bloodGroupService.js';

export const getAllBloodGroups = async (req, res, next) => {
  try {
    const groups = await bloodGroupService.getAllBloodGroups();
    res.status(200).json({
      success: true,
      data: groups
    });
  } catch (err) {
    next(err);
  }
};

export const getBloodGroupByCode = async (req, res, next) => {
  try {
    const group = await bloodGroupService.getBloodGroupByCode(req.params.group);
    res.status(200).json({
      success: true,
      data: group
    });
  } catch (err) {
    next(err);
  }
};
