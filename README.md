# MCP Prompts Server

An MCP server for managing prompts and templates with project orchestration capabilities. Part of the Model Context Protocol ecosystem.

<a href="https://glama.ai/mcp/servers/i0z4f3pr82">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/i0z4f3pr82/badge" alt="Prompts Server MCP server" />
</a>

This server provides a simple way to store, retrieve, and apply templates for AI prompts, making it easier to maintain consistent prompting patterns across your AI applications.

## Table of Contents
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Using with Claude](#using-with-claude)
  - [Available Tools](#available-tools)
  - [API Usage Examples](#api-usage-examples)
  - [Managing Prompts](#managing-prompts)
  - [Using Prompts in Your Workflow](#using-prompts-in-your-workflow)
- [Prompt Format](#prompt-format)
- [Multi-Format Prompt Support](#multi-format-prompt-support)
  - [Converting Between Formats](#converting-between-formats)
  - [Applying Templates](#applying-templates)
  - [Extracting Variables](#extracting-variables)
  - [Creating from Different Formats](#creating-from-different-formats)
  - [Integration with Storage Adapters](#integration-with-storage-adapters)
- [Storage Adapters](#storage-adapters)
  - [PostgreSQL Setup](#postgresql-setup)
- [Docker Deployment](#docker-deployment)
  - [Simple Deployment](#simple-deployment)
  - [PostgreSQL Deployment](#postgresql-deployment)
  - [Development Environment](#development-environment)
  - [Custom Configurations](#custom-configurations)
- [Development](#development)
  - [Development Workflow](#development-workflow)
  - [Development Commands](#development-commands)
  - [Build Process](#build-process)
  - [Testing](#testing)
  - [Directory Structure](#directory-structure)
- [Release Process](#release-process)
- [Changelog](#changelog)
- [Best Practices](#best-practices)
- [License](#license)

## Features

- Store and retrieve prompts
- Create and use templates with variables
- List prompts with filtering by tags
- Apply variables to templates
- Multiple storage backends (file system, PostgreSQL, and MDC format)
- Easy to use with Claude and other AI assistants
- Project orchestration capabilities
- Health check endpoints

## Installation

### Using npx (recommended)

```bash
npx -y @sparesparrow/mcp-prompts
```

### Global installation

```bash
npm install -g @sparesparrow/mcp-prompts
```

### Using Docker

```bash
docker run -p 3003:3003 -v ~/mcp/data:/app/data sparesparrow/mcp-prompts:latest
```

### Verifying Installation

After installation, you can verify that the server is working by:

1. Opening Claude Desktop
2. Typing "/" in the chat input to see if prompts from the server appear
3. Testing with a simple tool call:
   ```
   use_mcp_tool({
     server_name: "prompt-manager",
     tool_name: "list_prompts",
     arguments: {}
   });
   ```

## Configuration

The server can be configured using environment variables:

| Environment Variable | Description | Default |
|----------------------|-------------|---------|
| SERVER_NAME | Server name | MCP Prompts Server |
| SERVER_VERSION | Server version | package.json version |
| STORAGE_TYPE | Storage type: 'file', 'postgres', or 'mdc' | file |
| PROMPTS_DIR | Directory for storing prompts | ~/mcp/data/prompts |
| BACKUPS_DIR | Directory for backups | ~/mcp/data/backups |
| PORT | Port for HTTP server | 3003 |
| LOG_LEVEL | Logging level | info |
| HTTP_SERVER | Enable HTTP server | false |
| HOST | Host for HTTP server | 0.0.0.0 |

### PostgreSQL settings (required if STORAGE_TYPE=postgres)

| Environment Variable | Description | Default |
|----------------------|-------------|---------|
| PG_HOST | PostgreSQL host | localhost |
| PG_PORT | PostgreSQL port | 5432 |
| PG_DATABASE | PostgreSQL database name | mcp_prompts |
| PG_USER | PostgreSQL username | postgres |
| PG_PASSWORD | PostgreSQL password | |
| PG_SSL | Use SSL for PostgreSQL connection | false |
| POSTGRES_CONNECTION_STRING | Full PostgreSQL connection string (overrides individual settings) | |

### MDC settings (required if STORAGE_TYPE=mdc)

| Environment Variable | Description | Default |
|----------------------|-------------|---------|
| MDC_RULES_DIR | Directory for MDC rules | ./.cursor/rules |

## Usage

### Using with Claude

In Claude 3 Desktop app, you can configure the MCP Prompts server in your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "prompts": {
      "command": "npx",
      "args": [
        "-y",
        "@sparesparrow/mcp-prompts"
      ],
      "env": {
        "STORAGE_TYPE": "file",
        "PROMPTS_DIR": "/path/to/your/prompts/directory",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### Available Tools

The MCP Prompts server provides the following tools:

- `add_prompt`: Add a new prompt
- `get_prompt`: Get a prompt by ID
- `update_prompt`: Update an existing prompt
- `list_prompts`: List all prompts
- `delete_prompt`: Delete a prompt by ID
- `apply_template`: Apply variables to a prompt template

### API Usage Examples

#### Listing Available Prompts

To see what prompts are available:

```
use_mcp_tool({
  server_name: "prompt-manager",
  tool_name: "list_prompts",
  arguments: {}
});
```

To filter by tags:

```
use_mcp_tool({
  server_name: "prompt-manager",
  tool_name: "list_prompts",
  arguments: {
    tags: ["development"]
  }
});
```

#### Getting a Specific Prompt

To retrieve a specific prompt by ID:

```
use_mcp_tool({
  server_name: "prompt-manager",
  tool_name: "get_prompt",
  arguments: {
    id: "development-workflow"
  }
});
```

#### Using a Template Prompt

To apply variables to a template prompt:

```
use_mcp_tool({
  server_name: "prompt-manager",
  tool_name: "apply_template",
  arguments: {
    id: "development-system-prompt",
    variables: {
      "project_type": "web frontend",
      "language": "JavaScript/React",
      "project_name": "TaskManager",
      "project_goal": "create a task management application with drag-and-drop functionality",
      "technical_context": "Using React 18, TypeScript, and Material UI"
    }
  }
});
```

### Managing Prompts

#### Adding a New Prompt

To add a new prompt:

```
use_mcp_tool({
  server_name: "prompt-manager",
  tool_name: "add_prompt",
  arguments: {
    name: "Bug Report Template",
    description: "Template for submitting bug reports",
    content: "## Bug Report\n\n### Description\n{{description}}\n\n### Steps to Reproduce\n{{steps}}\n\n### Expected Behavior\n{{expected}}\n\n### Actual Behavior\n{{actual}}\n\n### Environment\n{{environment}}",
    isTemplate: true,
    variables: ["description", "steps", "expected", "actual", "environment"],
    tags: ["bug", "template", "documentation"]
  }
});
```

#### Editing an Existing Prompt

To edit an existing prompt:

```
use_mcp_tool({
  server_name: "prompt-manager",
  tool_name: "edit_prompt",
  arguments: {
    id: "development-workflow",
    content: "Updated workflow content here...",
    tags: ["development", "workflow", "python", "updated"]
  }
});
```

### Using Prompts in Your Workflow

#### Development Workflow Example

When starting work on a new feature:

1. Request the development system prompt template
2. Fill in the template with your project details
3. Use the resulting system prompt to guide Claude's assistance

#### Code Review Example

When reviewing code:

1. Request the code review template
2. Provide the code to be reviewed
3. Claude will provide a structured review

## Prompt Format

A prompt has the following structure:

```json
{
  "id": "unique-id",
  "name": "Prompt Name",
  "description": "Optional description",
  "content": "The prompt content with {{variables}}",
  "tags": ["tag1", "tag2"],
  "isTemplate": true,
  "variables": ["variable1", "variable2"],
  "metadata": {
    "author": "Your Name",
    "version": "1.0.0"
  }
}
```

## Multi-Format Prompt Support

The MCP Prompts Server includes a powerful `MutablePrompt` interface that allows prompts to be converted between multiple formats:

- **JSON Format**: Standard internal format used by the server
- **MDC Format**: Cursor Rules Markdown format (.mdc files)
- **PGAI Format**: Format with embedding support for PostgreSQL AI
- **Template Format**: Dynamic format with variable placeholders

### Converting Between Formats

The MutablePrompt interface provides methods to convert prompts between these formats:

```typescript
// Create a mutable prompt
const factory = new MutablePromptFactoryImpl();
const prompt = factory.create({
  name: "API Design Guide",
  description: "Template for designing RESTful APIs",
  content: "# API Design for {{service_name}}\n\n## Endpoints\n\n{{endpoints}}\n\n## Authentication\n\n{{auth_method}}",
  isTemplate: true,
  variables: ["service_name", "endpoints", "auth_method"],
  tags: ["api", "design", "rest", "glob:*.md"]
});

// Convert to MDC format
const mdcContent = prompt.toMdc({
  includeVariables: true
});

// Convert to PGAI format with embeddings
const pgaiData = prompt.toPgai({
  generateEmbeddings: true,
  collection: "prompts",
  vectorConfig: {
    dimension: 1536,
    metric: "cosine"
  }
});

// Convert to template format with dollar-style variables
const templateContent = prompt.toTemplate({
  delimiterStyle: "dollar"
});
```

### Applying Templates

You can easily apply variables to template prompts:

```typescript
const result = prompt.applyVariables({
  service_name: "User Management API",
  endpoints: "GET /users, POST /users, GET /users/{id}, PUT /users/{id}, DELETE /users/{id}",
  auth_method: "JWT Bearer Token"
});
```

### Extracting Variables

Extract variables from template content:

```typescript
const variables = prompt.extractVariables();
// Returns ["service_name", "endpoints", "auth_method"]
```

### Creating from Different Formats

You can also create prompts from various formats:

```typescript
// From MDC format
const mdcContent = `---
description: Template for code reviews
globs: ["*.js", "*.ts"]
---

# Code Review Template

## Context
{{context}}

## Patterns
{{patterns}}

## Variables

- \`context\`: Description of the code being reviewed
- \`patterns\`: Common patterns to look for
`;

const promptFromMdc = factory.fromMdc(mdcContent);

// From PGAI format
const pgaiData = {
  id: "api-design",
  name: "API Design Guide",
  content: "# API Design Guide\n\nUse this guide...",
  metadata: {
    description: "Comprehensive API design guide",
    tags: ["api", "rest"],
    isTemplate: false
  }
};

const promptFromPgai = factory.fromPgai(pgaiData);
```

### Integration with Storage Adapters

The MutablePrompt interface works seamlessly with the existing storage adapters:

```typescript
// Save a prompt in MDC format
const mdcPrompt = factory.fromMdc(mdcContent);
await fileAdapter.savePrompt(mdcPrompt);

// Save a prompt to PostgreSQL with PGAI format
const pgaiPrompt = factory.fromPgai(pgaiData);
await postgresAdapter.savePrompt(pgaiPrompt);
```

This flexible format handling enables:

1. **Cross-Platform Compatibility**: Use prompts in different tools and platforms
2. **Vector Search**: Use PGAI format for semantic search capabilities
3. **IDE Integration**: Direct compatibility with Cursor Rules
4. **Template Systems**: Export templates for use in various programming languages

## Storage Adapters

The server supports three types of storage adapters:

1. **File Adapter**: Stores prompts as individual JSON files in a directory.
2. **PostgreSQL Adapter**: Stores prompts in a PostgreSQL database.
3. **MDC Adapter**: Stores prompts in Cursor Rules MDC format.

Storage types can be configured using the `STORAGE_TYPE` environment variable:

```
STORAGE_TYPE=file      # Default
STORAGE_TYPE=postgres  # Requires PostgreSQL configuration
STORAGE_TYPE=mdc       # For Cursor Rules format
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

The MCP Prompts Server can be deployed using Docker and Docker Compose in several configurations:

### Simple Deployment

For a basic setup using the default file storage:

```bash
# Using docker-compose.yml
docker compose up -d
```

This deploys:
- The MCP Prompts server using file storage on port 3003

### PostgreSQL Deployment

For a setup using PostgreSQL as the storage backend:

```bash
# Using docker-compose.postgres.yml
docker compose -f docker-compose.postgres.yml up -d
```

This deploys:
- A PostgreSQL database server
- The MCP Prompts server configured to use PostgreSQL storage
- Adminer for database management (available at http://localhost:8080)

### Development Environment

For a development environment with hot reloading:

```bash
# Using docker-compose.dev.yml
docker compose -f docker-compose.dev.yml up -d
```

This deploys:
- A PostgreSQL database server
- The MCP Prompts server in development mode with source code mounted from your local directory
- Adminer for database management

### Custom Configurations

You can also create your own Docker Compose configuration by extending our base configurations:

```yaml
# Example custom-compose.yml
version: "3.8"

services:
  mcp-prompts:
    extends:
      file: docker-compose.yml
      service: mcp-file
    environment:
      - CUSTOM_ENV_VAR=value
    volumes:
      - ./my-prompts:/app/data/prompts
```

To run your custom configuration:

```bash
docker compose -f custom-compose.yml up -d
```

## Development

### Development Workflow

#### Setting Up Development Environment

1. **Clone the repository**
   ```bash
   git clone https://github.com/user/mcp-prompt-manager.git
   cd mcp-prompt-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file with the necessary configuration.

### Development Commands

- **Start development server with hot reloading**
  ```bash
  npm run dev
  ```

- **Build the project**
  ```bash
  npm run build
  ```

- **Run unit tests**
  ```bash
  npm test
  ```

- **Run integration tests**
  ```bash
  npm run test:integration
  ```

- **Test build process**
  ```bash
  npm run test:build
  ```

- **Test Docker build**
  ```bash
  npm run test:docker
  ```

- **Build Docker image**
  ```bash
  npm run docker:build
  ```

### Build Process

The build process includes several important steps:

1. **TypeScript Compilation**
   ```bash
   npm run build
   ```

2. **Make Entry Point Executable**
   ```bash
   chmod +x dist/index.js
   ```

### Testing

Run the tests:

```bash
npm test
```

Run the MCP Inspector for testing:

```bash
npm run test:inspector
```

### Directory Structure

The project follows a structured organization to maintain clean separation of concerns:

```
mcp-prompt-manager/
├── .github/workflows/    # CI/CD workflow configurations
├── dist/                 # Built files
├── src/                  # Source code
│   ├── adapters.ts       # Storage adapters
│   ├── interfaces.ts     # Core types and interfaces
│   └── index.ts          # Main entry point
├── scripts/              # Maintenance and utility scripts
├── package.json          # Project metadata and scripts
└── README.md             # Project documentation
```

## Release Process

### Pre-Release Checklist

- All TypeScript errors are resolved
- Code linting passes with no errors
- Code is properly formatted according to project standards
- Unit tests pass
- Integration tests pass
- Build test passes
- Docker build test passes
- Package installation test passes
- README is up-to-date with the latest features and changes
- CHANGELOG is updated with all notable changes

### Version Update

- Update version in `package.json` according to semantic versioning
- Ensure dependencies are up-to-date
- Update any version references in documentation

### Publishing

- Create a git tag for the new version
- Push changes and tag to GitHub
- Publish to npm (`npm publish`)
- Build and push Docker image

### Post-Release Verification

- Verify installation from npm
- Verify package can be run with npx
- Verify Docker image works as expected
- Verify integration with Claude Desktop

## Changelog

### [1.2.20] - 2025-03-14
- Automated version bump

### [1.2.19] - 2024-03-16
#### Fixed
- Fixed TypeScript errors in PostgresAdapter implementation
- Enhanced savePrompt method to properly return the created prompt
- Added updatePrompt method to the PostgresAdapter
- Fixed StorageAdapter interface to include listPrompts and clearAll methods
- Improved error handling in database-tools.ts for the clearAll method
- Enhanced health check endpoint with more detailed information

#### Added
- Added better documentation and error handling for health check endpoint

### [1.2.18] - 2024-03-14
#### Added
- Added HTTP server with health check endpoint
- Added Docker container health checks
- Added ESM module compatibility for Node.js 18-23+
- Enhanced database tools with better error handling

#### Changed
- Improved Docker build process with multi-stage builds
- Streamlined configuration management
- Optimized PostgreSQL adapter connection handling
- Updated dependencies to latest versions

#### Fixed
- Fixed issues with file adapter on certain file systems
- Improved error messages for better debugging
- Fixed template variable extraction

### [1.2.0] - 2025-03-14
#### Changed
- Reorganized codebase structure for better maintainability
- Moved Docker-related files to `docker/` directory
- Moved build scripts to `scripts/build/` directory
- Moved test scripts to `scripts/test/` directory
- Updated GitHub workflows to use new file paths
- Updated Docker Compose configuration to use new file paths
- Added comprehensive development documentation

#### Added
- Created development documentation with detailed instructions
- Created release checklist for release preparation
- Added CHANGELOG.md to track changes

#### Removed
- Removed duplicate and redundant files
- Removed incomplete scripts

### [1.1.0] - 2024-03-01
#### Added
- PGAI vector search for semantic prompt discovery
- Support for embeddings in PostgreSQL
- Improved prompts collection with professional templates
- Batch processing capabilities for prompt collections

#### Changed
- Enhanced prompt processing pipeline
- Improved command-line interface with more options
- Better error handling and validation

### [1.0.0] - 2024-02-15
#### Added
- Initial release of MCP Prompts Server
- Basic prompt management capabilities (add, edit, get, list, delete)
- Template variable substitution
- Tag-based organization
- File-based storage
- Import/export functionality
- MCP protocol compatibility

## Best Practices

1. **Organize with Tags**: Use tags to categorize your prompts for easier retrieval
2. **Use Templates**: Create reusable templates with variables for consistent prompting
3. **Include Metadata**: Add author, version, and other metadata for better organization
4. **Regular Backups**: Use the backup functionality if managing critical prompts
5. **Optimize Large Collections**: Use pagination when retrieving large prompt collections
6. **Use Consistent Naming**: Name prompts clearly and consistently for easy discovery
7. **Tag Effectively**: Use tags to organize prompts by purpose, project, or context
8. **Templatize Reusable Prompts**: Create templates for frequently used prompts with variables
9. **Update Regularly**: Keep your prompts up-to-date as your needs change
10. **Share with Team**: Share effective prompts with your team for consistent interactions

## License

MIT