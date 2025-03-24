#!/usr/bin/env node
// @ts-nocheck
/* eslint-disable */
// Tell TypeScript to keep this as an ES module
// @ts-ignore
export {};
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { createStorageAdapter } from "./adapters.js";
import { Prompt, ServerConfig, StorageAdapter } from "./interfaces.js";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { FileStorageAdapter, MemoryStorageAdapter, PostgresStorageAdapter } from './adapters/index.js';
import { startHttpServer } from './http-server.js';
import { PromptService } from './prompt-service.js';
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  RequestSchema,
  Request,
  Notification,
  Result
} from "@modelcontextprotocol/sdk/server/protocol.js";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration with defaults
const DEFAULT_CONFIG: ServerConfig = {
  name: "mcp-prompts",
  version: "1.2.38", // Set to the current package version
  storageType: "file",
  promptsDir: process.env.PROMPTS_DIR || path.join(process.cwd(), "prompts"),
  backupsDir: process.env.BACKUPS_DIR || path.join(process.cwd(), "backups"),
  port: Number(process.env.PORT) || 3003,
  logLevel: (process.env.LOG_LEVEL || "info") as "debug" | "info" | "warn" | "error",
  httpServer: process.env.HTTP_SERVER === "true",
  host: process.env.HOST || "0.0.0.0",
  enableSSE: process.env.ENABLE_SSE === "true",
  ssePath: process.env.SSE_PATH || "/events",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  postgres: process.env.POSTGRES_CONNECTION_STRING 
    ? {
        connectionString: process.env.POSTGRES_CONNECTION_STRING,
        host: "",
        port: 5432,
        database: "",
        user: "",
        password: "",
        ssl: false
      } 
    : {
        host: process.env.POSTGRES_HOST || "localhost",
        port: Number(process.env.POSTGRES_PORT) || 5432,
        database: process.env.POSTGRES_DATABASE || "mcp_prompts",
        user: process.env.POSTGRES_USER || "postgres",
        password: process.env.POSTGRES_PASSWORD || "postgres",
        ssl: process.env.POSTGRES_SSL === "true"
      }
};

// Storage adapter instance
let storageAdapter: StorageAdapter;

// Default prompts to include when initializing
const DEFAULT_PROMPTS: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'version'>[] = [
  {
    name: "Development System Prompt",
    description: "A template for creating system prompts for development assistance",
    content: `You are a development assistant helping with {{project_type}} development using {{language}}. 

Role:
- You provide clear, concise code examples with explanations
- You suggest best practices and patterns
- You help debug issues with the codebase

The current project is {{project_name}} which aims to {{project_goal}}.

When providing code examples:
1. Use consistent style and formatting
2. Include comments for complex sections
3. Follow {{language}} best practices
4. Consider performance implications

Technical context:
{{technical_context}}`,
    isTemplate: true,
    variables: ["project_type", "language", "project_name", "project_goal", "technical_context"],
    tags: ["development", "system", "template"]
  },
  {
    name: "Task List Helper",
    description: "A basic prompt to help organize and prioritize tasks",
    content: "Please create a prioritized task list based on the following requirements:\n\n{{requirements}}",
    isTemplate: true,
    variables: ["requirements"],
    tags: ["productivity", "planning"]
  }
];

// Initialize default prompts
async function initializeDefaultPrompts() {
  try {
    console.error("Adding default prompts...");
    const existingPrompts = await storageAdapter.listPrompts();
  
    if (existingPrompts.length === 0) {
      for (const promptData of DEFAULT_PROMPTS) {
        await storageAdapter.savePrompt(promptData);
      }
      console.error(`Added ${DEFAULT_PROMPTS.length} default prompts`);
    } else {
      console.error(`Skipping default prompts, ${existingPrompts.length} prompts already exist`);
    }
  } catch (error) {
    console.error("Error initializing default prompts:", error);
  }
}

// Utility to apply template variables
function applyTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
    return variables[variable.trim()] || match;
  });
}

// Custom request schemas
const AddPromptRequestSchema = z.object({
  method: z.literal("add_prompt"),
  params: z.object({
    name: z.string(),
    content: z.string(),
    description: z.string().optional(),
    isTemplate: z.boolean().optional(),
    variables: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  })
});

const GetPromptByIdRequestSchema = z.object({
  method: z.literal("get_prompt"),
  params: z.object({
    id: z.string(),
  })
});

const UpdatePromptRequestSchema = z.object({
  method: z.literal("update_prompt"),
  params: z.object({
    id: z.string(),
    name: z.string().optional(),
    content: z.string().optional(),
    description: z.string().optional(),
    isTemplate: z.boolean().optional(),
    variables: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  })
});

// Main function
async function main() {
  try {
    console.error(`Starting MCP Prompts Server v${DEFAULT_CONFIG.version}`);
    console.error(`Config: ${JSON.stringify(DEFAULT_CONFIG)}`);
    
    // Create and connect to storage
    storageAdapter = await createStorageAdapter(DEFAULT_CONFIG);
    await storageAdapter.connect();
    
    // Initialize default prompts
    await initializeDefaultPrompts();
  
    // Create prompt service
    const promptService = new PromptService(storageAdapter);
  
    // Create MCP server
    const server = new Server(
      {
        name: DEFAULT_CONFIG.name,
        version: DEFAULT_CONFIG.version,
      },
      {
        capabilities: {
          resources: { subscribe: false },
          tools: { listChanged: false },
          prompts: { listChanged: false }
        },
        enforceStrictCapabilities: true // Ensure strict capability checking
      }
    );
    
    // New registration using server.resource, server.tool, and server.prompt
    server.resource("prompt", "prompt://{id}", async (uri, params) => {
      const promptId = params?.id || uri.href.split('prompt://')[1];
      const prompt = await storageAdapter.getPrompt(promptId);
      if (!prompt) {
        throw new Error(`Prompt not found: ${promptId}`);
      }
      return promptService.formatMcpPrompt(prompt, {});
    });

    server.resource("templates", "templates://", async (uri) => {
      const prompts = await storageAdapter.listPrompts({ isTemplate: true });
      return { contents: prompts };
    });

    server.tool("add_prompt",
      {
        name: z.string(),
        content: z.string(),
        description: z.string().optional(),
        isTemplate: z.boolean().optional(),
        variables: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
      },
      async (params) => {
        await storageAdapter.savePrompt(params);
        return { success: true };
      }
    );

    server.tool("get_prompt",
      {
        id: z.string(),
      },
      async (params) => {
        const prompt = await storageAdapter.getPrompt(params.id);
        if (!prompt) {
          throw new Error(`Prompt not found: ${params.id}`);
        }
        return prompt;
      }
    );

    server.tool("update_prompt",
      {
        id: z.string(),
        name: z.string().optional(),
        content: z.string().optional(),
        description: z.string().optional(),
        isTemplate: z.boolean().optional(),
        variables: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
      },
      async (params) => {
        await storageAdapter.updatePrompt(params.id, params);
        return { success: true };
      }
    );

    server.tool("list_prompts",
      {
        isTemplate: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      },
      async (params) => {
        const prompts = await storageAdapter.listPrompts(params);
        return { prompts, total: prompts.length };
      }
    );

    server.tool("delete_prompt",
      {
        id: z.string(),
      },
      async (params) => {
        await storageAdapter.deletePrompt(params.id);
        return { success: true };
      }
    );

    server.tool("apply_template",
      {
        id: z.string(),
        variables: z.record(z.string()),
      },
      async (params) => {
        const prompt = await storageAdapter.getPrompt(params.id);
        if (!prompt) {
          throw new Error(`Prompt not found: ${params.id}`);
        }
        if (!prompt.isTemplate) {
          throw new Error(`Prompt is not a template: ${params.id}`);
        }
        const content = applyTemplate(prompt.content, params.variables);
        return {
          content,
          originalPrompt: prompt,
          appliedVariables: params.variables,
        };
      }
    );

    server.prompt("review-code", { code: z.string() }, ({ code }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Please review this code:\n\n${code}`
        }
      }]
    }));
    
    // Start HTTP server if enabled
    if (DEFAULT_CONFIG.httpServer) {
      startHttpServer(DEFAULT_CONFIG, server);
    }
    
    // Connect to transport
    // SSE transport will be set up in startHttpServer if enabled
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error("MCP Prompts Server connected successfully to stdio transport");
  } catch (error) {
    console.error("Error starting server:", error);
  }
}

// Run the server
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});