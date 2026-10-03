/**
 * Storage Adapter Interface / Abstract Base Class
 * 
 * Defines standard CRUD operations for all storage implementations.
 * Enables zero-coupling between domain services and underlying storage medium.
 */
export class StorageAdapter {
  async findAll(collection, filterFn = null) {
    throw new Error('Method findAll() must be implemented');
  }

  async findById(collection, id) {
    throw new Error('Method findById() must be implemented');
  }

  async findOne(collection, filterFn) {
    throw new Error('Method findOne() must be implemented');
  }

  async create(collection, item) {
    throw new Error('Method create() must be implemented');
  }

  async update(collection, id, updates) {
    throw new Error('Method update() must be implemented');
  }

  async delete(collection, id) {
    throw new Error('Method delete() must be implemented');
  }

  async replace(collection, items) {
    throw new Error('Method replace() must be implemented');
  }

  async count(collection, filterFn = null) {
    throw new Error('Method count() must be implemented');
  }
}
