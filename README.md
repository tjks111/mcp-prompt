# Prompt Manager MCP Server

An MCP (Model Context Protocol) server for managing, storing, and providing prompts and prompt templates for LLM interactions.

## Features

- Store and retrieve prompts and templates
- Apply variable substitution to prompt templates
- Tag-based organization and search
- MCP Prompts protocol support
- Tools for prompt management

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/prompt-manager-mcp.git
   cd prompt-manager-mcp
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the project:
   ```
   npm run build
   ```

## Usage

### Running the Server

Run the server with:

```
npm start
```

### Claude Desktop Integration

To integrate with Claude Desktop, add the following to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "prompt-manager": {
      "command": "node",
      "args": ["/absolute/path/to/prompt-manager-mcp/build/index.js"]
    }
  }
}
```

### Available Tools

The server provides the following MCP tools:

- `add_prompt`: Add a new prompt to the collection
- `edit_prompt`: Edit an existing prompt
- `get_prompt`: Retrieve a prompt by ID
- `list_prompts`: List all prompts, optionally filtered by tags
- `apply_template`: Apply a template prompt with variable substitution

### Using Prompts in Claude

Prompts can be accessed through Claude using MCP tools or the standard MCP prompts protocol:

```
I need to review some code.

use_mcp_tool({
  server_name: "prompt-manager",
  tool_name: "apply_template",
  arguments: {
    id: "code-review",
    variables: {
      language: "python",
      code: "def example():\n    return 'Hello, World!'"
    }
  }
});
```

## Default Prompts

The server comes with several default prompts:

- Development System Prompt: Template for development assistance
- Development Workflow: Standard workflow for Python projects
- Code Review: Template for code review requests

## License

MIT