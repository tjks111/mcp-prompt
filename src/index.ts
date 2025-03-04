import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

// Directory for prompt storage
const PROMPTS_DIR = path.join(process.cwd(), "prompts");

// Type definitions
interface Prompt {
  id: string;
  name: string;
  description?: string;
  content: string;
  isTemplate: boolean;
  variables?: string[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

// Ensure the prompts directory exists
async function ensurePromptsDir() {
  try {
    await fs.mkdir(PROMPTS_DIR, { recursive: true });
    console.error(`Prompts directory created: ${PROMPTS_DIR}`);
  } catch (error) {
    console.error("Error creating prompts directory:", error);
  }
}

// Storage operations
async function savePrompt(prompt: Prompt): Promise<void> {
  await fs.writeFile(
    path.join(PROMPTS_DIR, `${prompt.id}.json`),
    JSON.stringify(prompt, null, 2)
  );
}

async function loadPrompt(id: string): Promise<Prompt | null> {
  try {
    const content = await fs.readFile(path.join(PROMPTS_DIR, `${id}.json`), "utf-8");
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

async function listAllPrompts(): Promise<Prompt[]> {
  try {
    const files = await fs.readdir(PROMPTS_DIR);
    const prompts: Prompt[] = [];
    
    for (const file of files) {
      if (file.endsWith(".json")) {
        const content = await fs.readFile(path.join(PROMPTS_DIR, file), "utf-8");
        prompts.push(JSON.parse(content));
      }
    }
    
    return prompts;
  } catch (error) {
    console.error("Error listing prompts:", error);
    return [];
  }
}

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
    name: "Development Workflow",
    description: "Standard workflow for installing dependencies, testing, documenting, and pushing changes",
    content: `install dependencies, build, run, test, fix, document, commit, and push your changes. Because your environment is externally managed, we'll create and use a virtual environment:
Create a virtual environment in the project directory.
Upgrade pip (optional but recommended).
Install the package in editable mode within the virtual environment.
Run tests (e.g. using pytest).
Document any changes (the README already provides documentation).
Commit all changes and push to your Git repository.`,
    isTemplate: false,
    tags: ["development", "workflow", "python"]
  },
  {
    name: "Code Review",
    description: "A template for requesting code reviews",
    content: `Please review the following code for:
1. Bugs or logic errors
2. Performance issues
3. Security vulnerabilities
4. Style/convention violations
5. Opportunities for improvement

Code to review:
\`\`\`{{language}}
{{code}}
\`\`\``,
    isTemplate: true,
    variables: ["language", "code"],
    tags: ["development", "review", "template"]
  }
];

// Function to initialize default prompts if none exist
async function initializeDefaultPrompts() {
  const existingPrompts = await listAllPrompts();
  
  if (existingPrompts.length === 0) {
    console.error("No prompts found, adding defaults...");
    
    for (const promptTemplate of DEFAULT_PROMPTS) {
      const id = promptTemplate.name.toLowerCase().replace(/\s+/g, "-");
      const now = new Date().toISOString();
      
      const prompt: Prompt = {
        ...promptTemplate,
        id,
        createdAt: now,
        updatedAt: now,
        version: 1
      };
      
      await savePrompt(prompt);
      console.error(`Added default prompt: ${prompt.name}`);
    }
  }
}

// Initialize the MCP server
async function main() {
  await ensurePromptsDir();
  await initializeDefaultPrompts();
  
  const server = new McpServer({
    name: "PromptManager",
    version: "1.0.0"
  });

  // Tool implementations
  // 1. Add a new prompt
  server.tool(
    "add_prompt",
    {
      name: z.string(),
      description: z.string().optional(),
      content: z.string(),
      isTemplate: z.boolean().default(false),
      variables: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional()
    },
    async ({ name, description, content, isTemplate, variables, tags }) => {
      const id = name.toLowerCase().replace(/\s+/g, "-");
      
      // Check if prompt already exists
      const existingPrompt = await loadPrompt(id);
      if (existingPrompt) {
        return {
          content: [{
            type: "text",
            text: `Error: A prompt with the name "${name}" already exists.`
          }],
          isError: true
        };
      }
      
      const now = new Date().toISOString();
      const prompt: Prompt = {
        id,
        name,
        description,
        content,
        isTemplate,
        variables,
        tags,
        createdAt: now,
        updatedAt: now,
        version: 1
      };
      
      await savePrompt(prompt);
      
      return {
        content: [{
          type: "text",
          text: `Successfully added prompt "${name}".`
        }]
      };
    }
  );

  // 2. Edit an existing prompt
  server.tool(
    "edit_prompt",
    {
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      content: z.string().optional(),
      isTemplate: z.boolean().optional(),
      variables: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional()
    },
    async ({ id, name, description, content, isTemplate, variables, tags }) => {
      const existingPrompt = await loadPrompt(id);
      if (!existingPrompt) {
        return {
          content: [{
            type: "text",
            text: `Error: No prompt found with ID "${id}".`
          }],
          isError: true
        };
      }
      
      const updatedPrompt: Prompt = {
        ...existingPrompt,
        name: name || existingPrompt.name,
        description: description !== undefined ? description : existingPrompt.description,
        content: content || existingPrompt.content,
        isTemplate: isTemplate !== undefined ? isTemplate : existingPrompt.isTemplate,
        variables: variables || existingPrompt.variables,
        tags: tags || existingPrompt.tags,
        updatedAt: new Date().toISOString(),
        version: existingPrompt.version + 1
      };
      
      await savePrompt(updatedPrompt);
      
      return {
        content: [{
          type: "text",
          text: `Successfully updated prompt "${updatedPrompt.name}".`
        }]
      };
    }
  );

  // 3. Get a prompt
  server.tool(
    "get_prompt",
    {
      id: z.string()
    },
    async ({ id }) => {
      const prompt = await loadPrompt(id);
      if (!prompt) {
        return {
          content: [{
            type: "text",
            text: `Error: No prompt found with ID "${id}".`
          }],
          isError: true
        };
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(prompt, null, 2)
        }]
      };
    }
  );

  // 4. List all prompts
  server.tool(
    "list_prompts",
    {
      tags: z.array(z.string()).optional()
    },
    async ({ tags }) => {
      let prompts = await listAllPrompts();
      
      // Filter by tags if provided
      if (tags && tags.length > 0) {
        prompts = prompts.filter(prompt => 
          prompt.tags && tags.some(tag => prompt.tags?.includes(tag))
        );
      }
      
      if (prompts.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No prompts found."
          }]
        };
      }
      
      const formattedPrompts = prompts.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        isTemplate: p.isTemplate,
        tags: p.tags
      }));
      
      return {
        content: [{
          type: "text",
          text: `Found ${prompts.length} prompts:\n\n${JSON.stringify(formattedPrompts, null, 2)}`
        }]
      };
    }
  );

  // 5. Apply template prompt with variables
  server.tool(
    "apply_template",
    {
      id: z.string(),
      variables: z.record(z.string(), z.string())
    },
    async ({ id, variables }) => {
      const prompt = await loadPrompt(id);
      if (!prompt) {
        return {
          content: [{
            type: "text",
            text: `Error: No prompt found with ID "${id}".`
          }],
          isError: true
        };
      }
      
      if (!prompt.isTemplate) {
        return {
          content: [{
            type: "text",
            text: `Error: Prompt "${prompt.name}" is not a template.`
          }],
          isError: true
        };
      }
      
      let content = prompt.content;
      
      // Fixed string replacement logic
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        content = content.replace(regex, () => value);
      });
      
      return {
        content: [{
          type: "text",
          text: content
        }]
      };
    }
  );

  // Instead of using registerPromptHandler, set up prompt methods directly
  server.prompt("get_development_system_prompt", 
    {
      project_type: z.string(),
      language: z.string(),
      project_name: z.string(),
      project_goal: z.string(),
      technical_context: z.string()
    },
    async ({project_type, language, project_name, project_goal, technical_context}) => {
      const prompt = await loadPrompt("development-system-prompt");
      if (!prompt) {
        throw new Error("Development system prompt not found");
      }
      
      let content = prompt.content;
      const variables = {project_type, language, project_name, project_goal, technical_context};
      
      // Fixed string replacement logic
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        content = content.replace(regex, () => value);
      });
      
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: content
            }
          }
        ]
      };
    }
  );
  
  server.prompt("get_code_review", 
    {
      language: z.string(),
      code: z.string()
    },
    async ({language, code}) => {
      const prompt = await loadPrompt("code-review");
      if (!prompt) {
        throw new Error("Code review prompt not found");
      }
      
      let content = prompt.content;
      const variables = {language, code};
      
      // Fixed string replacement logic
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        content = content.replace(regex, () => value);
      });
      
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: content
            }
          }
        ]
      };
    }
  );
  
  server.prompt("development_workflow", 
    {},
    async () => {
      const prompt = await loadPrompt("development-workflow");
      if (!prompt) {
        throw new Error("Development workflow prompt not found");
      }
      
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: prompt.content
            }
          }
        ]
      };
    }
  );

  // Start the server
  console.error("Starting PromptManager MCP Server...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PromptManager MCP Server running");
}

// Run the server
main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});