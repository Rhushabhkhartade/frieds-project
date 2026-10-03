import { storage } from '../repositories/index.js';
import { NotFoundError, BadRequestError } from '../middlewares/errorHandler.js';
import { TRANSACTION_OPERATIONS, UNIT_STATUSES } from '../config/constants.js';
import { alertService } from './alertService.js';

class TransactionService {
  /**
   * List all inventory transactions with pagination and filters
   */
  async listTransactions(query = {}) {
    const { unitId, bloodGroup, operation, page = 1, limit = 20 } = query;
    let transactions = await storage.findAll('transactions');

    if (!Array.isArray(transactions)) {
      transactions = [];
    }

    if (unitId) {
      transactions = transactions.filter(t => t.unitId === unitId || t.unitNumber === unitId);
    }
    if (bloodGroup) {
      transactions = transactions.filter(t => t.bloodGroup === bloodGroup);
    }
    if (operation) {
      transactions = transactions.filter(t => t.operation === operation || t.type === operation);
    }

    // Newest transactions first
    transactions.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    const total = transactions.length;
    const startIndex = (page - 1) * limit;
    const paginated = transactions.slice(startIndex, startIndex + limit);

    return {
      transactions: paginated,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Find single transaction by ID
   */
  async getTransactionById(id) {
    const tx = await storage.findById('transactions', id);
    if (!tx) {
      throw new NotFoundError(`Transaction with ID "${id}" was not found`);
    }
    return tx;
  }

  /**
   * Record a transaction and execute inventory state transition
   */
  async createTransaction(data) {
    const { unitId, operation, actor = 'staff_admin', notes = '', recipientOrHospital = '' } = data;

    // Fetch the target blood unit
    const unit = await storage.findById('units', unitId);
    if (!unit) {
      throw new NotFoundError(`Target blood unit with ID "${unitId}" was not found`);
    }

    const previousStatus = unit.status;
    let newStatus = previousStatus;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Validate operational state transitions & clinical business rules
    switch (operation) {
      case TRANSACTION_OPERATIONS.RESERVE:
        if (previousStatus !== UNIT_STATUSES.AVAILABLE) {
          throw new BadRequestError(
            `Cannot reserve unit "${unitId}". Current status is "${previousStatus}" (must be AVAILABLE).`,
            'INVALID_STATUS_TRANSITION'
          );
        }
        if (unit.expiryDate < todayStr) {
          throw new BadRequestError(
            `Cannot reserve expired unit "${unitId}" (Expired on ${unit.expiryDate}).`,
            'UNIT_EXPIRED'
          );
        }
        newStatus = UNIT_STATUSES.RESERVED;
        break;

      case TRANSACTION_OPERATIONS.ISSUE:
      case TRANSACTION_OPERATIONS.USE:
        if (previousStatus !== UNIT_STATUSES.AVAILABLE && previousStatus !== UNIT_STATUSES.RESERVED) {
          throw new BadRequestError(
            `Cannot issue/use unit "${unitId}". Current status is "${previousStatus}" (must be AVAILABLE or RESERVED).`,
            'INVALID_STATUS_TRANSITION'
          );
        }
        if (unit.expiryDate < todayStr) {
          throw new BadRequestError(
            `Clinical Safety Violation: Cannot issue expired unit "${unitId}" (Expired on ${unit.expiryDate}).`,
            'EXPIRED_UNIT_ISSUE_FORBIDDEN'
          );
        }
        newStatus = UNIT_STATUSES.USED;
        break;

      case TRANSACTION_OPERATIONS.EXPIRE:
        if (previousStatus === UNIT_STATUSES.USED || previousStatus === UNIT_STATUSES.DISCARDED) {
          throw new BadRequestError(
            `Cannot mark unit "${unitId}" as expired. Current status is already "${previousStatus}".`,
            'INVALID_STATUS_TRANSITION'
          );
        }
        newStatus = UNIT_STATUSES.EXPIRED;
        break;

      case TRANSACTION_OPERATIONS.DISCARD:
        if (previousStatus === UNIT_STATUSES.DISCARDED) {
          throw new BadRequestError(
            `Unit "${unitId}" is already marked as DISCARDED.`,
            'ALREADY_DISCARDED'
          );
        }
        newStatus = UNIT_STATUSES.DISCARDED;
        break;

      case TRANSACTION_OPERATIONS.UPDATE:
        // Status remains unchanged unless specified in notes or explicit call
        break;

      default:
        throw new BadRequestError(`Unsupported transaction operation "${operation}"`, 'UNSUPPORTED_OPERATION');
    }

    // Update unit status if changed
    if (newStatus !== previousStatus) {
      await storage.update('units', unit.id, {
        status: newStatus,
        updatedAt: now.toISOString()
      });
    }

    // Construct and persist immutable transaction record
    const unitCode = unit.unitCode || unit.unitNumber || unit.id;
    const transactionRecord = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      unitId: unit.id,
      unitCode,
      unitNumber: unitCode,
      bloodGroup: unit.bloodGroup,
      component: unit.component || unit.componentType,
      operation,
      type: operation,
      previousStatus,
      newStatus,
      recipientOrHospital: recipientOrHospital || 'General Transfusion Service',
      actor,
      performedBy: actor,
      notes: notes || `Operation ${operation} executed on ${unitCode}`,
      timestamp: now.toISOString()
    };

    await storage.create('transactions', transactionRecord);

    // Trigger alert re-evaluation asynchronously in background
    alertService.refreshAlerts().catch(() => {});

    return {
      transaction: transactionRecord,
      unit: {
        ...unit,
        status: newStatus,
        updatedAt: now.toISOString()
      }
    };
  }
}

export const transactionService = new TransactionService();
