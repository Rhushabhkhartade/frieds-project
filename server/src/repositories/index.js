import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonStorage } from './jsonStorage.js';
import { env } from '../config/environment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve data directory path
const resolvedDataDir = path.isAbsolute(env.DATA_DIR)
  ? env.DATA_DIR
  : path.resolve(__dirname, '../../', env.DATA_DIR);

export const storage = new JsonStorage(resolvedDataDir);
export { StorageAdapter } from './storageAdapter.js';
export { JsonStorage } from './jsonStorage.js';
