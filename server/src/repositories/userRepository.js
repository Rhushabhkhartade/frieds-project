import { storage } from '../repositories/index.js';

const COLLECTION = 'users';

class UserRepository {
  /**
   * Return all users — passwords stripped by default
   */
  async findAll(includeHash = false) {
    const users = await storage.findAll(COLLECTION);
    if (!Array.isArray(users)) return [];
    if (includeHash) return users;
    return users.map(this._sanitize);
  }

  /**
   * Find a user by their internal ID
   */
  async findById(id, includeHash = false) {
    const user = await storage.findById(COLLECTION, id);
    if (!user) return null;
    return includeHash ? user : this._sanitize(user);
  }

  /**
   * Find a user by email (used during login and duplicate-check)
   */
  async findByEmail(email, includeHash = false) {
    const normalised = email.trim().toLowerCase();
    const user = await storage.findOne(COLLECTION, u => u.email === normalised);
    if (!user) return null;
    return includeHash ? user : this._sanitize(user);
  }

  /**
   * Persist a new user record
   */
  async create(userData) {
    const created = await storage.create(COLLECTION, userData);
    return this._sanitize(created);
  }

  /**
   * Update user fields by ID
   */
  async update(id, updates) {
    const updated = await storage.update(COLLECTION, id, updates);
    if (!updated) return null;
    return this._sanitize(updated);
  }

  /**
   * Remove passwordHash before returning to callers that don't need it
   */
  _sanitize(user) {
    if (!user) return null;
    const { passwordHash, ...safe } = user;
    void passwordHash; // intentionally discarded
    return safe;
  }
}

export const userRepository = new UserRepository();
