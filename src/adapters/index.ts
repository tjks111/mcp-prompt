import { StorageAdapter, ServerConfig } from '../interfaces/index.js';
import { FileAdapter } from './file/index.js';
import { PostgresAdapter } from './postgres/index.js';
import { MemoryAdapter } from './memory/index.js';

/**
 * Creates the appropriate storage adapter based on configuration
 */
export function createStorageAdapter(config: ServerConfig): StorageAdapter {
  switch (config.storageType) {
    case 'file':
      console.error(`Creating file storage adapter with directory: ${config.promptsDir}`);
      return new FileAdapter(config.promptsDir);
    
    case 'postgres':
      if (!config.postgres) {
        throw new Error('PostgreSQL configuration is required when using postgres storage type');
      }
      
      console.error(`Creating PostgreSQL storage adapter with host: ${config.postgres.host}`);
      return new PostgresAdapter(config.postgres);
    
    case 'memory':
      console.error('Creating in-memory storage adapter');
      return new MemoryAdapter();
    
    default:
      throw new Error(`Unknown storage type: ${config.storageType}`);
  }
} 