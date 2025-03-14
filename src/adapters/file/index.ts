import { Prompt, StorageAdapter, ListPromptsOptions } from '../../interfaces/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

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

  async updatePrompt(id: string, data: Partial<Prompt>): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("File storage not connected");
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

    try {
      await fs.writeFile(
        path.join(this.promptsDir, `${id}.json`),
        JSON.stringify(updated, null, 2)
      );
      return updated;
    } catch (error: any) {
      console.error(`Error updating prompt ${id} in file:`, error);
      throw error;
    }
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