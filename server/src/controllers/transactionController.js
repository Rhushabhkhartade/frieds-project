import { transactionService } from '../services/transactionService.js';

export const listTransactions = async (req, res, next) => {
  try {
    const result = await transactionService.listTransactions(req.query);
    res.status(200).json({
      success: true,
      data: result.transactions,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
};

export const getTransactionById = async (req, res, next) => {
  try {
    const tx = await transactionService.getTransactionById(req.params.id);
    res.status(200).json({
      success: true,
      data: tx
    });
  } catch (err) {
    next(err);
  }
};

export const createTransaction = async (req, res, next) => {
  try {
    const result = await transactionService.createTransaction(req.body);
    res.status(201).json({
      success: true,
      data: result.transaction,
      unit: result.unit,
      message: `Transaction ${result.transaction.operation} processed successfully`
    });
  } catch (err) {
    next(err);
  }
};
