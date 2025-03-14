import { Prompt, StorageAdapter, ListPromptsOptions } from '../../interfaces/index.js';

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

  async updatePrompt(id: string, data: Partial<Prompt>): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }

    const existing = await this.getPrompt(id);
    
    const updated = {
      ...existing,
      ...data,
      id, // Keep original ID
      updatedAt: new Date().toISOString(),
      version: (existing.version || 1) + 1
    };

    this.prompts.set(id, updated);
    return Promise.resolve(updated);
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