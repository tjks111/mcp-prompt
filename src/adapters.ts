/**
 * Consolidated Adapters Module
 * Contains all storage adapters in a single file
 */

import { 
  Prompt, 
  StorageAdapter, 
  ListPromptsOptions, 
  ServerConfig, 
  MutablePrompt,
  MutablePromptFactory,
  PromptFormat, 
  PromptConversionOptions,
  MdcFormatOptions,
  PgaiFormatOptions,
  TemplateFormatOptions
} from './interfaces.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import pg from 'pg';

/**
 * FileAdapter Implementation
 * Stores prompts as individual JSON files in a directory
 */
export class FileAdapter implements StorageAdapter {
  private promptsDir: string;
  private connected: boolean = false;

  constructor(promptsDir: string) {
    this.promptsDir = promptsDir;
  }

  async connect(): Promise<void> {
    try {
      // Ensure the prompts directory exists
      await fs.mkdir(this.promptsDir, { recursive: true });
      this.connected = true;
      console.error(`File storage connected: ${this.promptsDir}`);
    } catch (error: any) {
      console.error("Error connecting to file storage:", error);
      throw new Error(`Failed to connect to file storage: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    // No active connections to close for file storage
    this.connected = false;
    console.error("File storage disconnected");
  }

  isConnected(): boolean {
    return this.connected;
  }

  async savePrompt(promptData: Partial<Prompt>): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("File storage not connected");
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

    try {
      await fs.writeFile(
        path.join(this.promptsDir, `${prompt.id}.json`),
        JSON.stringify(prompt, null, 2)
      );
      return prompt;
    } catch (error: any) {
      console.error("Error saving prompt to file:", error);
      throw error;
    }
  }

  async getPrompt(id: string): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("File storage not connected");
    }

    try {
      const content = await fs.readFile(path.join(this.promptsDir, `${id}.json`), "utf-8");
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Prompt not found: ${id}`);
      }
      console.error(`Error getting prompt ${id} from file:`, error);
      throw error;
    }
  }

  async getAllPrompts(): Promise<Prompt[]> {
    return this.listPrompts();
  }

  async updatePrompt(id: string, data: Partial<Prompt>): Promise<Prompt | void> {
    if (!this.connected) {
      throw new Error("File storage not connected");
    }

    // Retrieve the existing prompt using the provided id
    return this.getPrompt(id).then(existingPrompt => {
      if (!existingPrompt) {
        throw new Error(`Prompt not found: ${id}`);
      }
      // Merge existing prompt data with the updates (excluding id if present in data)
      const updatedPrompt = { ...existingPrompt, ...data, id };
      // Save the updated prompt; implementation-specific
      return this.savePrompt(updatedPrompt);
    });
  }

  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error("File storage not connected");
    }

    try {
      const files = await fs.readdir(this.promptsDir);
      const prompts: Prompt[] = [];
      
      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const content = await fs.readFile(path.join(this.promptsDir, file), "utf-8");
            prompts.push(JSON.parse(content));
          } catch (error: any) {
            console.error(`Error reading prompt file ${file}:`, error);
            // Continue to next file
          }
        }
      }
      
      // Apply filtering based on options
      let filtered = prompts;
      
      if (options) {
        if (options.isTemplate !== undefined) {
          filtered = filtered.filter(p => p.isTemplate === options.isTemplate);
        }
        
        if (options.category) {
          filtered = filtered.filter(p => p.category === options.category);
        }
        
        if (options.tags && options.tags.length > 0) {
          filtered = filtered.filter(p => {
            if (!p.tags) return false;
            return options.tags!.every(tag => p.tags!.includes(tag));
          });
        }
        
        if (options.search) {
          const search = options.search.toLowerCase();
          filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(search) || 
            (p.description && p.description.toLowerCase().includes(search)) ||
            p.content.toLowerCase().includes(search)
          );
        }
        
        // Apply sorting
        if (options.sort) {
          const sortKey = options.sort as keyof Prompt;
          const direction = options.order === 'desc' ? -1 : 1;
          filtered.sort((a, b) => {
            const valA = a[sortKey] as any;
            const valB = b[sortKey] as any;
            if (valA < valB) return -1 * direction;
            if (valA > valB) return 1 * direction;
            return 0;
          });
        } else {
          // Default sort by updatedAt desc
          filtered.sort((a, b) => {
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });
        }
        
        // Apply pagination
        if (options.limit) {
          const start = options.offset || 0;
          filtered = filtered.slice(start, start + options.limit);
        }
      }
      
      return filtered;
    } catch (error: any) {
      console.error("Error listing prompts from file:", error);
      throw error;
    }
  }

  async deletePrompt(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error("File storage not connected");
    }

    try {
      await fs.unlink(path.join(this.promptsDir, `${id}.json`));
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error deleting prompt ${id} from file:`, error);
        throw error;
      }
      // If file doesn't exist, consider it already deleted
    }
  }

  async clearAll(): Promise<void> {
    if (!this.connected) {
      throw new Error("File storage not connected");
    }

    try {
      const files = await fs.readdir(this.promptsDir);
      
      for (const file of files) {
        if (file.endsWith(".json")) {
          await fs.unlink(path.join(this.promptsDir, file));
        }
      }
    } catch (error: any) {
      console.error("Error clearing all prompts from file:", error);
      throw error;
    }
  }

  async backup(): Promise<string> {
    if (!this.connected) {
      throw new Error("File storage not connected");
    }

    // Create a backup ID
    const backupId = `file_backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    
    // In a more complete implementation, we would create a backup directory
    // and copy all files, but for this example, we'll just return the ID
    console.error(`Created file backup: ${backupId}`);
    
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
}

/**
 * MemoryAdapter Implementation
 * Stores prompts in memory (volatile storage)
 */
export class MemoryAdapter implements StorageAdapter {
  private prompts: Map<string, Prompt> = new Map();
  private connected: boolean = false;

  constructor() {
    // No configuration needed for memory adapter
  }

  async connect(): Promise<void> {
    this.connected = true;
    console.error("Memory storage connected");
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    this.prompts.clear();
    this.connected = false;
    console.error("Memory storage disconnected");
    return Promise.resolve();
  }

  isConnected(): boolean {
    return this.connected;
  }

  async savePrompt(promptData: Partial<Prompt>): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
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

    this.prompts.set(prompt.id, prompt);
    return Promise.resolve(prompt);
  }

  async getPrompt(id: string): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }

    const prompt = this.prompts.get(id);
    if (!prompt) {
      throw new Error(`Prompt not found: ${id}`);
    }
    
    return Promise.resolve(prompt);
  }

  async getAllPrompts(): Promise<Prompt[]> {
    return this.listPrompts();
  }

  async updatePrompt(id: string, data: Partial<Prompt>): Promise<Prompt | void> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }

    // Retrieve the existing prompt using the provided id
    return this.getPrompt(id).then(existingPrompt => {
      if (!existingPrompt) {
        throw new Error(`Prompt not found: ${id}`);
      }
      // Merge existing prompt data with the updates (excluding id if present in data)
      const updatedPrompt = { ...existingPrompt, ...data, id };
      // Save the updated prompt; implementation-specific
      return this.savePrompt(updatedPrompt);
    });
  }

  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }

    // Get all prompts
    let prompts = Array.from(this.prompts.values());
    
    // Apply filtering based on options
    if (options) {
      if (options.isTemplate !== undefined) {
        prompts = prompts.filter(p => p.isTemplate === options.isTemplate);
      }
      
      if (options.category) {
        prompts = prompts.filter(p => p.category === options.category);
      }
      
      if (options.tags && options.tags.length > 0) {
        prompts = prompts.filter(p => {
          if (!p.tags) return false;
          return options.tags!.every(tag => p.tags!.includes(tag));
        });
      }
      
      if (options.search) {
        const search = options.search.toLowerCase();
        prompts = prompts.filter(p => 
          p.name.toLowerCase().includes(search) || 
          (p.description && p.description.toLowerCase().includes(search)) ||
          p.content.toLowerCase().includes(search)
        );
      }
      
      // Apply sorting
      if (options.sort) {
        const sortKey = options.sort as keyof Prompt;
        const direction = options.order === 'desc' ? -1 : 1;
        prompts.sort((a, b) => {
          const valA = a[sortKey] as any;
          const valB = b[sortKey] as any;
          if (valA < valB) return -1 * direction;
          if (valA > valB) return 1 * direction;
          return 0;
        });
      } else {
        // Default sort by updatedAt desc
        prompts.sort((a, b) => {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
      }
      
      // Apply pagination
      if (options.limit) {
        const start = options.offset || 0;
        prompts = prompts.slice(start, start + options.limit);
      }
    }
    
    return Promise.resolve(prompts);
  }

  async deletePrompt(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }

    this.prompts.delete(id);
    return Promise.resolve();
  }

  async clearAll(): Promise<void> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }

    this.prompts.clear();
    return Promise.resolve();
  }

  async backup(): Promise<string> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }

    // For memory adapter, backup is just a timestamp (as data is in memory)
    const backupId = `memory_backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    console.error(`Created memory backup: ${backupId}`);
    
    return Promise.resolve(backupId);
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
}

/**
 * PostgresAdapter Implementation
 * Stores prompts in a PostgreSQL database
 */
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

  async updatePrompt(id: string, data: Partial<Prompt>): Promise<Prompt | void> {
    if (!this.connected) {
      throw new Error("PostgreSQL storage not connected");
    }

    // Retrieve the existing prompt using the provided id
    return this.getPrompt(id).then(existingPrompt => {
      if (!existingPrompt) {
        throw new Error(`Prompt not found: ${id}`);
      }
      // Merge existing prompt data with the updates (excluding id if present in data)
      const updatedPrompt = { ...existingPrompt, ...data, id };
      // Save the updated prompt; implementation-specific
      return this.savePrompt(updatedPrompt);
    });
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
    // Safely parse JSON or return default values
    const safeJsonParse = (str: string | null, defaultValue: any) => {
      if (!str) return defaultValue;
      try {
        return JSON.parse(str);
      } catch (error: any) {
        console.error(`Error parsing JSON: ${error.message}`);
        return defaultValue;
      }
    };
    
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      content: row.content,
      isTemplate: row.is_template,
      variables: safeJsonParse(row.variables, []),
      tags: row.tags || [],
      category: row.category,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      version: row.version,
      metadata: safeJsonParse(row.metadata, {})
    };
  }
}

/**
 * Implementation of MutablePrompt interface
 */
export class MutablePromptImpl implements MutablePrompt {
  id: string;
  name: string;
  description?: string;
  content: string;
  isTemplate?: boolean;
  variables?: string[] | import('./interfaces.js').TemplateVariable[];
  tags?: string[];
  category?: string;
  createdAt: string;
  updatedAt: string;
  version?: number;
  metadata?: Record<string, any>;

  constructor(data: Prompt) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.content = data.content;
    this.isTemplate = data.isTemplate;
    this.variables = data.variables;
    this.tags = data.tags;
    this.category = data.category;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.version = data.version || 1;
    this.metadata = data.metadata || {};
  }

  toFormat(format: PromptFormat, options?: PromptConversionOptions): string | Record<string, any> {
    switch (format) {
      case PromptFormat.JSON:
        return JSON.stringify(this);
      case PromptFormat.MDC:
        return this.toMdc(options?.mdc);
      case PromptFormat.PGAI:
        return this.toPgai(options?.pgai);
      case PromptFormat.TEMPLATE:
        return this.toTemplate(options?.template);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  toMdc(options?: MdcFormatOptions): string {
    // Extract globs from tags or use provided globs
    const globs = options?.globs || this.tags
      ?.filter(tag => tag.startsWith('glob:'))
      .map(tag => tag.replace(/^glob:/, '')) || [];

    // Start with frontmatter
    let mdc = '---\n';
    if (this.description) {
      mdc += `description: ${this.description}\n`;
    }
    
    // Add globs if they exist
    if (globs.length > 0) {
      mdc += `globs: ${JSON.stringify(globs)}\n`;
    }
    
    // Close frontmatter
    mdc += '---\n\n';
    
    // Add title
    mdc += `# ${this.name}\n\n`;
    
    // Add content
    mdc += this.content;
    
    // Add variables section if needed
    if (options?.includeVariables !== false && this.isTemplate && this.variables && this.variables.length > 0) {
      mdc += '\n\n## Variables\n\n';
      
      for (const variable of this.variables) {
        if (typeof variable === 'string') {
          mdc += `- \`${variable}\`: Variable description\n`;
        } else {
          mdc += `- \`${variable.name}\`: ${variable.description || ''}\n`;
          if (variable.required) {
            mdc += `  - Required: true\n`;
          }
          if (variable.default) {
            mdc += `  - Default: \`${variable.default}\`\n`;
          }
          if (variable.type) {
            mdc += `  - Type: ${variable.type}\n`;
          }
          if (variable.options && variable.options.length > 0) {
            mdc += `  - Options: ${variable.options.join(', ')}\n`;
          }
        }
      }
    }
    
    return mdc;
  }

  toPgai(options?: PgaiFormatOptions): Record<string, any> {
    const result: Record<string, any> = {
      id: this.id,
      name: this.name,
      content: this.content,
      metadata: {
        ...(this.metadata || {}),
        description: this.description,
        isTemplate: this.isTemplate,
        variables: this.variables,
        tags: this.tags,
        category: this.category,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        version: this.version
      }
    };

    // Add collection if specified
    if (options?.collection) {
      result.collection = options.collection;
    }

    // Add embedding placeholder if requested
    if (options?.generateEmbeddings) {
      result.embedding = {
        text: this.content,
        dimension: options.vectorConfig?.dimension || 1536,
        metric: options.vectorConfig?.metric || 'cosine'
      };
    }

    return result;
  }

  toTemplate(options?: TemplateFormatOptions): string {
    const delimiterStyle = options?.delimiterStyle || 'double_curly';
    let content = this.content;
    
    if (this.isTemplate && this.variables && this.variables.length > 0) {
      // Apply default values if provided
      if (options?.defaultValues) {
        return this.applyVariables(options.defaultValues, options);
      }
      
      // Otherwise return the template with formatted delimiters
      if (delimiterStyle !== 'double_curly') {
        const variables = this.extractVariables(options);
        
        for (const variable of variables) {
          const doublePattern = new RegExp(`\\{\\{\\s*${variable}\\s*\\}\\}`, 'g');
          
          let replacement: string;
          switch (delimiterStyle) {
            case 'curly':
              replacement = `{${variable}}`;
              break;
            case 'dollar':
              replacement = `\${${variable}}`;
              break;
            case 'percent':
              replacement = `%${variable}%`;
              break;
            default:
              replacement = `{{${variable}}}`;
          }
          
          content = content.replace(doublePattern, replacement);
        }
      }
    }
    
    return content;
  }

  applyVariables(variables: Record<string, string>, options?: TemplateFormatOptions): string {
    if (!this.isTemplate) {
      return this.content;
    }
    
    let content = this.content;
    const delimiterStyle = options?.delimiterStyle || 'double_curly';
    
    for (const [key, value] of Object.entries(variables)) {
      let pattern: RegExp;
      
      switch (delimiterStyle) {
        case 'curly':
          pattern = new RegExp(`\\{${key}\\}`, 'g');
          break;
        case 'double_curly':
          pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
          break;
        case 'dollar':
          pattern = new RegExp(`\\$\\{${key}\\}`, 'g');
          break;
        case 'percent':
          pattern = new RegExp(`%${key}%`, 'g');
          break;
        default:
          pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      }
      
      content = content.replace(pattern, value);
    }
    
    return content;
  }

  extractVariables(options?: TemplateFormatOptions): string[] {
    const delimiterStyle = options?.delimiterStyle || 'double_curly';
    let pattern: RegExp;
    
    switch (delimiterStyle) {
      case 'curly':
        pattern = /\{([^}]+)\}/g;
        break;
      case 'double_curly':
        pattern = /\{\{\s*([^}]+)\s*\}\}/g;
        break;
      case 'dollar':
        pattern = /\$\{([^}]+)\}/g;
        break;
      case 'percent':
        pattern = /%([^%]+)%/g;
        break;
      default:
        pattern = /\{\{\s*([^}]+)\s*\}\}/g;
    }
    
    const matches = [...this.content.matchAll(pattern)];
    const variables = matches.map(match => match[1].trim());
    
    // Return unique variables
    return [...new Set(variables)];
  }

  clone(): MutablePrompt {
    return new MutablePromptImpl(JSON.parse(JSON.stringify(this)));
  }

  createVersion(changes: Partial<Prompt>): MutablePrompt {
    const newVersion = this.clone() as MutablePromptImpl;
    
    // Apply changes
    Object.assign(newVersion, changes);
    
    // Update metadata
    newVersion.updatedAt = new Date().toISOString();
    newVersion.version = (this.version || 1) + 1;
    
    return newVersion;
  }
}

/**
 * Implementation of MutablePromptFactory
 */
export class MutablePromptFactoryImpl implements MutablePromptFactory {
  create(data: Partial<Prompt>): MutablePrompt {
    // Required fields if not provided
    const now = new Date().toISOString();
    
    const prompt: Prompt = {
      id: data.id || this.generateId(data.name || 'untitled'),
      name: data.name || 'Untitled Prompt',
      content: data.content || '',
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      ...data
    };
    
    return new MutablePromptImpl(prompt);
  }

  fromFormat(content: string, format: PromptFormat, options?: PromptConversionOptions): MutablePrompt {
    switch (format) {
      case PromptFormat.JSON:
        try {
          const data = JSON.parse(content);
          return this.create(data);
        } catch (error) {
          throw new Error(`Invalid JSON format: ${error}`);
        }
      case PromptFormat.MDC:
        return this.fromMdc(content, options?.mdc);
      case PromptFormat.PGAI:
        try {
          const data = JSON.parse(content);
          return this.fromPgai(data, options?.pgai);
        } catch (error) {
          throw new Error(`Invalid PGAI JSON format: ${error}`);
        }
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  fromMdc(mdcContent: string, options?: MdcFormatOptions): MutablePrompt {
    // Parse MDC content
    const frontmatterMatch = mdcContent.match(/---\n([\s\S]*?)\n---/);
    const frontmatter = frontmatterMatch ? frontmatterMatch[1] : '';
    
    // Extract description
    const descriptionMatch = frontmatter.match(/description: (.*)/);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';
    
    // Extract globs and convert to tags
    const globsMatch = frontmatter.match(/globs: (\[.*\])/);
    const globs = globsMatch ? JSON.parse(globsMatch[1]) : [];
    const tags = globs.map((glob: string) => `glob:${glob}`);
    
    // Extract title (name)
    const titleMatch = mdcContent.match(/# (.*)/);
    const name = titleMatch ? titleMatch[1].trim() : 'Untitled';
    
    // Extract content (everything after the title)
    let content = mdcContent
      .replace(/---\n[\s\S]*?\n---\n\n/, '')  // Remove frontmatter
      .replace(/# .*\n\n/, '');  // Remove title
    
    // Extract variables section
    const variableSection = content.match(/## Variables\n\n([\s\S]*?)(\n\n|$)/);
    let variables: string[] = [];
    let isTemplate = false;
    
    if (variableSection) {
      isTemplate = true;
      content = content.replace(/## Variables\n\n[\s\S]*/, '').trim();
      
      const varContent = variableSection[1];
      const varLines = varContent.split('\n');
      
      for (const line of varLines) {
        const varMatch = line.match(/- `([^`]+)`:/);
        if (varMatch) {
          variables.push(varMatch[1]);
        }
      }
    }
    
    // Create the prompt
    return this.create({
      name,
      description,
      content,
      isTemplate,
      variables,
      tags
    });
  }

  fromPgai(pgaiData: Record<string, any>, options?: PgaiFormatOptions): MutablePrompt {
    // Extract core fields
    const { id, name, content } = pgaiData;
    
    // Extract metadata
    const metadata = pgaiData.metadata || {};
    const {
      description,
      isTemplate,
      variables,
      tags,
      category,
      createdAt,
      updatedAt,
      version,
      ...restMetadata
    } = metadata;
    
    // Create the prompt
    return this.create({
      id,
      name,
      description,
      content,
      isTemplate,
      variables,
      tags,
      category,
      createdAt,
      updatedAt,
      version,
      metadata: restMetadata
    });
  }

  private generateId(name: string): string {
    // Convert name to lowercase, replace spaces with hyphens
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 64) || 
      Date.now().toString(36);
  }
}

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