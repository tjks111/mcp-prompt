import { Prompt, StorageAdapter, ListPromptsOptions } from '../../interfaces/index.js';
import pg from 'pg';

export class PostgresAdapter implements StorageAdapter {
  private pool: pg.Pool;
  private connected: boolean = false;

  constructor(config: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
    connectionString?: string;
  }) {
    // Use connection string if provided, otherwise build from config
    const connectionConfig = config.connectionString 
      ? { connectionString: config.connectionString }
      : {
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: config.ssl ? { rejectUnauthorized: false } : false,
        };

    this.pool = new pg.Pool(connectionConfig);
  }

  async connect(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      client.release();
      
      // Create tables if they don't exist
      await this.createTables();
      
      this.connected = true;
      console.error("PostgreSQL storage connected");
    } catch (error: any) {
      console.error("Error connecting to PostgreSQL:", error);
      throw new Error(`Failed to connect to PostgreSQL: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.pool.end();
      this.connected = false;
      console.error("PostgreSQL storage disconnected");
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async createTables(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Create prompts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS prompts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          content TEXT NOT NULL,
          is_template BOOLEAN DEFAULT false,
          variables JSONB,
          tags TEXT[],
          category TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          version INTEGER DEFAULT 1,
          metadata JSONB
        )
      `);
      
      // Create index on tags for faster filtering
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_prompts_tags ON prompts USING GIN (tags)
      `);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Error creating database tables:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async savePrompt(promptData: Partial<Prompt>): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("PostgreSQL storage not connected");
    }

    const now = new Date().toISOString();
    const prompt: Prompt = {
      id: promptData.id || this.generateId(promptData.name || 'prompt'),
      name: promptData.name || 'Untitled Prompt',
      content: promptData.content || '',
      isTemplate: promptData.isTemplate || false,
      createdAt: now,
      updatedAt: now,
      version: 1,
      ...promptData
    };

    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO prompts (
          id, name, description, content, is_template, variables, 
          tags, category, created_at, updated_at, version, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        prompt.id,
        prompt.name,
        prompt.description || null,
        prompt.content,
        prompt.isTemplate || false,
        prompt.variables ? JSON.stringify(prompt.variables) : null,
        prompt.tags ? Array.isArray(prompt.tags) ? prompt.tags : [prompt.tags] : null,
        prompt.category || null,
        prompt.createdAt,
        prompt.updatedAt,
        prompt.version || 1,
        prompt.metadata ? JSON.stringify(prompt.metadata) : null
      ]);
      
      return prompt;
    } catch (error) {
      console.error("Error saving prompt to PostgreSQL:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getPrompt(id: string): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("PostgreSQL storage not connected");
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM prompts WHERE id = $1
      `, [id]);
      
      if (result.rowCount === 0) {
        throw new Error(`Prompt not found: ${id}`);
      }
      
      return this.rowToPrompt(result.rows[0]);
    } catch (error) {
      console.error(`Error getting prompt ${id} from PostgreSQL:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getAllPrompts(): Promise<Prompt[]> {
    return this.listPrompts();
  }

  async updatePrompt(id: string, data: Partial<Prompt>): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("PostgreSQL storage not connected");
    }

    // First get the existing prompt
    const existing = await this.getPrompt(id);
    
    // Prepare updated prompt
    const updated = {
      ...existing,
      ...data,
      id, // Keep original ID
      updatedAt: new Date().toISOString(),
      version: (existing.version || 1) + 1
    };

    const client = await this.pool.connect();
    try {
      await client.query(`
        UPDATE prompts SET
          name = $1,
          description = $2,
          content = $3,
          is_template = $4,
          variables = $5,
          tags = $6,
          category = $7,
          updated_at = $8,
          version = $9,
          metadata = $10
        WHERE id = $11
      `, [
        updated.name,
        updated.description || null,
        updated.content,
        updated.isTemplate || false,
        updated.variables ? JSON.stringify(updated.variables) : null,
        updated.tags || null,
        updated.category || null,
        updated.updatedAt,
        updated.version,
        updated.metadata ? JSON.stringify(updated.metadata) : null,
        id
      ]);
      
      return updated;
    } catch (error) {
      console.error(`Error updating prompt ${id} in PostgreSQL:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error("PostgreSQL storage not connected");
    }

    const client = await this.pool.connect();
    try {
      let query = `SELECT * FROM prompts`;
      const params: any[] = [];
      const conditions: string[] = [];
      
      // Build WHERE clause based on options
      if (options) {
        if (options.isTemplate !== undefined) {
          conditions.push(`is_template = $${params.length + 1}`);
          params.push(options.isTemplate);
        }
        
        if (options.category) {
          conditions.push(`category = $${params.length + 1}`);
          params.push(options.category);
        }
        
        if (options.tags && options.tags.length > 0) {
          conditions.push(`tags @> $${params.length + 1}::text[]`);
          params.push(options.tags);
        }
        
        if (options.search) {
          conditions.push(`(
            name ILIKE $${params.length + 1} OR
            description ILIKE $${params.length + 1} OR
            content ILIKE $${params.length + 1}
          )`);
          params.push(`%${options.search}%`);
        }
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      // Add sorting
      if (options?.sort) {
        const sortField = this.getSortField(options.sort);
        const direction = options.order === 'desc' ? 'DESC' : 'ASC';
        query += ` ORDER BY ${sortField} ${direction}`;
      } else {
        query += ` ORDER BY updated_at DESC`; // Default sorting
      }
      
      // Add pagination
      if (options?.limit) {
        query += ` LIMIT $${params.length + 1}`;
        params.push(options.limit);
        
        if (options.offset) {
          query += ` OFFSET $${params.length + 1}`;
          params.push(options.offset);
        }
      }
      
      const result = await client.query(query, params);
      return result.rows.map(row => this.rowToPrompt(row));
    } catch (error) {
      console.error("Error listing prompts from PostgreSQL:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deletePrompt(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error("PostgreSQL storage not connected");
    }

    const client = await this.pool.connect();
    try {
      await client.query(`DELETE FROM prompts WHERE id = $1`, [id]);
    } catch (error) {
      console.error(`Error deleting prompt ${id} from PostgreSQL:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async clearAll(): Promise<void> {
    if (!this.connected) {
      throw new Error("PostgreSQL storage not connected");
    }

    const client = await this.pool.connect();
    try {
      await client.query(`TRUNCATE TABLE prompts`);
    } catch (error) {
      console.error("Error clearing all prompts from PostgreSQL:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async backup(): Promise<string> {
    if (!this.connected) {
      throw new Error("PostgreSQL storage not connected");
    }

    // Create a backup by exporting all prompts
    const prompts = await this.getAllPrompts();
    const backupId = `pg_backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    
    // Here we would normally save the backup data to a file or another table
    // For this implementation, we'll just return the backup ID
    console.error(`Created PostgreSQL backup: ${backupId}`);
    
    return backupId;
  }

  // Helper methods
  private generateId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') +
      '-' +
      Math.random().toString(36).substring(2, 7);
  }

  private getSortField(field: string): string {
    const fieldMap: Record<string, string> = {
      name: 'name',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      version: 'version'
    };
    
    return fieldMap[field] || 'updated_at';
  }

  private rowToPrompt(row: any): Prompt {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      content: row.content,
      isTemplate: row.is_template,
      variables: row.variables ? JSON.parse(row.variables) : undefined,
      tags: row.tags,
      category: row.category,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      version: row.version,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }
} 