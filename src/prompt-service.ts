/**
 * Prompt Service
 * Centralizes management of all prompt-related operations
 */

import type { Prompt, StorageAdapter, ListPromptsOptions } from './interfaces.js';

export class PromptService {
  private storageAdapter: StorageAdapter;

  constructor(storageAdapter: StorageAdapter) {
    this.storageAdapter = storageAdapter;
  }

  /**
   * Get a prompt by ID
   * @param id Prompt ID
   * @returns The prompt
   */
  async getPrompt(id: string): Promise<Prompt> {
    return this.storageAdapter.getPrompt(id);
  }

  /**
   * Save a new prompt
   * @param prompt Prompt data without ID and metadata
   * @returns The saved prompt with ID
   */
  async savePrompt(prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<Prompt> {
    const result = await this.storageAdapter.savePrompt(prompt);
    if (typeof result === 'string') {
      throw new Error(`Failed to save prompt: ${result}`);
    }
    return result;
  }

  /**
   * Update an existing prompt
   * @param id Prompt ID
   * @param updates Partial prompt data to update
   * @returns The updated prompt
   */
  async updatePrompt(id: string, updates: Partial<Prompt>): Promise<Prompt> {
    if (!this.storageAdapter.updatePrompt) {
      throw new Error('Storage adapter does not support updating prompts');
    }
    const result = await this.storageAdapter.updatePrompt(id, updates);
    if (result === undefined || result === null) {
      throw new Error(`Failed to update prompt: ${id}`);
    }
    return result;
  }

  /**
   * Delete a prompt by ID
   * @param id Prompt ID
   */
  async deletePrompt(id: string): Promise<void> {
    return this.storageAdapter.deletePrompt(id);
  }

  /**
   * List prompts with optional filtering
   * @param options Filter options
   * @returns Array of prompts
   */
  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    return this.storageAdapter.listPrompts(options);
  }

  /**
   * Apply variables to a template prompt
   * @param templateId Template prompt ID
   * @param variables Variables to apply
   * @returns Processed content and metadata
   */
  async applyTemplate(templateId: string, variables: Record<string, string>): Promise<{
    content: string;
    originalPrompt: Prompt;
    appliedVariables: Record<string, string>;
  }> {
    const prompt = await this.getPrompt(templateId);
    
    if (!prompt.isTemplate) {
      throw new Error(`Prompt is not a template: ${templateId}`);
    }
    
    const content = this.processTemplate(prompt.content, variables);
    
    return {
      content,
      originalPrompt: prompt,
      appliedVariables: variables,
    };
  }

  /**
   * Process a template string by replacing variables
   * @param template Template string
   * @param variables Variables to replace
   * @returns Processed string
   */
  private processTemplate(template: string, variables: Record<string, string>): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{${key}}`, 'g');
      result = result.replace(regex, value);
    }
    
    return result;
  }

  /**
   * Format a prompt according to the MCP prompts/get protocol
   * @param prompt The prompt to format
   * @param variables Optional variables to apply for templates
   * @returns Formatted prompt for MCP protocol
   */
  formatMcpPrompt(prompt: Prompt, variables?: Record<string, string>): {
    description: string;
    messages: Array<{
      role: string;
      content: {
        type: string;
        text: string;
      };
    }>;
  } {
    // Apply template variables if provided and this is a template
    let content = prompt.content;
    if (prompt.isTemplate && variables) {
      content = this.processTemplate(content, variables);
    }
    
    return {
      description: prompt.description || '',
      messages: [
        {
          role: 'system',
          content: {
            type: 'text',
            text: content
          }
        }
      ]
    };
  }

  /**
   * Format a list of prompts according to the MCP prompts/list protocol
   * @param prompts Array of prompts to format
   * @returns Formatted prompts list for MCP protocol
   */
  formatMcpPromptsList(prompts: Prompt[]): {
    prompts: Array<{
      name: string;
      description: string;
      arguments?: Array<{
        name: string;
        description?: string;
        required?: boolean;
      }>;
    }>;
  } {
    return {
      prompts: prompts.map(prompt => {
        // For template prompts, extract variables information
        const args = prompt.isTemplate && prompt.variables?.length
          ? prompt.variables.map((variable: any) => {
              // Handle both string variables and complex variable objects
              if (typeof variable === 'string') {
                return { name: variable };
              } else {
                return {
                  name: variable.name,
                  description: variable.description,
                  required: variable.required
                };
              }
            })
          : undefined;
          
        return {
          name: prompt.id,
          description: prompt.description || '',
          ...(args && { arguments: args })
        };
      })
    };
  }
} 