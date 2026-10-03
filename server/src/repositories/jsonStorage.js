import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { StorageAdapter } from './storageAdapter.js';

/**
 * JsonStorage
 * 
 * Thread-safe, atomic JSON file repository.
 * Features:
 * 1. Sequential write-queue (mutex) per collection to serialize concurrent writes.
 * 2. Atomic temp-file swapping (write to tmp file, then atomic fs.rename) to prevent corruption.
 * 3. Pure data-access methods (no business or domain logic).
 */
export class JsonStorage extends StorageAdapter {
  constructor(dataDirectory) {
    super();
    this.dataDir = dataDirectory;
    // Map of collection name to promise chain to serialize concurrent writes
    this.writeQueues = new Map();
  }

  /**
   * Resolve absolute path for a collection's JSON file
   */
  _getFilePath(collection) {
    const filename = collection.endsWith('.json') ? collection : `${collection}.json`;
    return path.resolve(this.dataDir, filename);
  }

  /**
   * Safely read collection data from disk
   */
  async _readCollection(collection) {
    const filePath = this._getFilePath(collection);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Return empty array or object if file does not exist yet
        return [];
      }
      throw new Error(`Failed to read collection "${collection}": ${err.message}`);
    }
  }

  /**
   * Atomically write data to disk with temporary file rename
   */
  async _writeAtomic(collection, data) {
    const filePath = this._getFilePath(collection);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    const tempPath = `${filePath}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
    const payload = JSON.stringify(data, null, 2);

    try {
      await fs.writeFile(tempPath, payload, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (err) {
      // Clean up temp file if rename or write failed
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore unlink error
      }
      throw new Error(`Atomic write failed for "${collection}": ${err.message}`);
    }
  }

  /**
   * Serialize write operations for a collection to prevent race conditions
   */
  _enqueueWrite(collection, writeTask) {
    const currentQueue = this.writeQueues.get(collection) || Promise.resolve();
    const nextQueue = currentQueue.then(writeTask).catch(err => {
      // Ensure error doesn't break future queue items
      throw err;
    });
    this.writeQueues.set(collection, nextQueue);
    return nextQueue;
  }

  /**
   * Find all items in collection, optionally filtered
   */
  async findAll(collection, filterFn = null) {
    const items = await this._readCollection(collection);
    if (!Array.isArray(items)) {
      return items;
    }
    if (typeof filterFn === 'function') {
      return items.filter(filterFn);
    }
    return [...items];
  }

  /**
   * Find a single item by id
   */
  async findById(collection, id) {
    const items = await this._readCollection(collection);
    if (!Array.isArray(items)) {
      return null;
    }
    const found = items.find(item => item && String(item.id) === String(id));
    return found ? { ...found } : null;
  }

  /**
   * Find first item matching predicate
   */
  async findOne(collection, filterFn) {
    const items = await this._readCollection(collection);
    if (!Array.isArray(items)) {
      return null;
    }
    const found = items.find(filterFn);
    return found ? { ...found } : null;
  }

  /**
   * Insert a new record into collection
   */
  async create(collection, item) {
    return this._enqueueWrite(collection, async () => {
      const items = await this._readCollection(collection);
      if (!Array.isArray(items)) {
        throw new Error(`Collection "${collection}" is not an array.`);
      }
      const record = { ...item };
      items.push(record);
      await this._writeAtomic(collection, items);
      return { ...record };
    });
  }

  /**
   * Update an existing record by id
   */
  async update(collection, id, updates) {
    return this._enqueueWrite(collection, async () => {
      const items = await this._readCollection(collection);
      if (!Array.isArray(items)) {
        throw new Error(`Collection "${collection}" is not an array.`);
      }
      const index = items.findIndex(item => item && String(item.id) === String(id));
      if (index === -1) {
        return null;
      }
      const updated = {
        ...items[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      items[index] = updated;
      await this._writeAtomic(collection, items);
      return { ...updated };
    });
  }

  /**
   * Delete a record by id
   */
  async delete(collection, id) {
    return this._enqueueWrite(collection, async () => {
      const items = await this._readCollection(collection);
      if (!Array.isArray(items)) {
        throw new Error(`Collection "${collection}" is not an array.`);
      }
      const index = items.findIndex(item => item && String(item.id) === String(id));
      if (index === -1) {
        return false;
      }
      items.splice(index, 1);
      await this._writeAtomic(collection, items);
      return true;
    });
  }

  /**
   * Replace the entire collection content (e.g., config settings or batch updates)
   */
  async replace(collection, data) {
    return this._enqueueWrite(collection, async () => {
      await this._writeAtomic(collection, data);
      return data;
    });
  }

  /**
   * Count items matching filter
   */
  async count(collection, filterFn = null) {
    const items = await this.findAll(collection, filterFn);
    return Array.isArray(items) ? items.length : 0;
  }
}
