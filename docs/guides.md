# MCP Prompts Server - Comprehensive Guide

## Overview

MCP Prompts Server is a flexible and extensible system for managing AI prompts and templates with multiple storage options. This guide covers the essential aspects of the server.

## Storage Adapters

The server supports three types of storage adapters:

1. **File Adapter**: Stores prompts as individual JSON files in a directory.
2. **PostgreSQL Adapter**: Stores prompts in a PostgreSQL database.
3. **Memory Adapter**: Stores prompts in memory (non-persistent).

### Configuration

Storage types can be configured using the `STORAGE_TYPE` environment variable:

```
STORAGE_TYPE=file      # Default
STORAGE_TYPE=postgres  # Requires PostgreSQL configuration
STORAGE_TYPE=memory    # For testing/development
```

### PostgreSQL Setup

When using PostgreSQL storage, configure the following environment variables:

```
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=mcp_prompts
PG_USER=postgres
PG_PASSWORD=your_password
PG_SSL=false
```

Alternatively, use a connection string:

```
POSTGRES_CONNECTION_STRING=postgresql://user:password@host:port/database
```

## Docker Deployment

The MCP Prompts Server can be deployed using Docker:

```bash
# Build the Docker image
docker build -t mcp-prompts:latest .

# Run the container
docker run -p 3003:3003 -v ~/mcp/data:/app/data mcp-prompts:latest
```

For a complete setup with PostgreSQL, use docker-compose:

```bash
docker-compose up -d
```

## Prompt Format

Prompts have the following structure:

```json
{
  "id": "unique-id",
  "name": "Prompt Name",
  "description": "Optional description",
  "content": "The prompt content with {{variables}}",
  "isTemplate": true,
  "variables": ["variable1", "variable2"],
  "tags": ["tag1", "tag2"],
  "category": "optional-category",
  "metadata": {
    "author": "Your Name",
    "version": "1.0.0"
  }
}
```

## API Usage

### Adding a Prompt

```javascript
const result = await callTool("add_prompt", {
  name: "My Template",
  content: "Hello {{name}}, welcome to {{service}}",
  description: "A greeting template",
  isTemplate: true,
  variables: ["name", "service"],
  tags: ["greeting", "welcome"]
});
```

### Getting a Prompt

```javascript
const prompt = await callTool("get_prompt", {
  id: "prompt-id"
});
```

### Applying a Template

```javascript
const result = await callTool("apply_template", {
  id: "template-id",
  variables: {
    "name": "Alice",
    "service": "MCP Prompts"
  }
});
```

## Integration with Claude

To use with Claude, add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "prompts": {
      "command": "npx",
      "args": ["-y", "@sparesparrow/mcp-prompts"],
      "env": {
        "STORAGE_TYPE": "file",
        "PROMPTS_DIR": "/path/to/your/prompts"
      }
    }
  }
}
```

## Best Practices

1. **Organize with Tags**: Use tags to categorize your prompts for easier retrieval
2. **Use Templates**: Create reusable templates with variables for consistent prompting
3. **Include Metadata**: Add author, version, and other metadata for better organization
4. **Regular Backups**: Use the backup functionality if managing critical prompts
5. **Optimize Large Collections**: Use pagination when retrieving large prompt collections
