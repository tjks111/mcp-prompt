# MCP-Prompts Server

A Model Context Protocol (MCP) server for managing prompts and templates, allowing standardized sharing and application of prompts across MCP-compatible applications.

## Overview

MCP-Prompts provides a focused, efficient prompt management system built on MCP server standards. It allows you to:

- Store and organize prompts and templates
- Apply variables to templates to generate prompts dynamically
- Filter and search prompts by tags, categories, and content
- Integrate with Claude Desktop and other MCP clients
- Deploy as a standalone service or as part of a larger MCP ecosystem

## Installation

### NPM Global Installation

```bash
# Install globally
npm install -g @sparesparrow/prompts

# Run the server
mcp-prompts
```

### Local Installation

```bash
# Clone the repository
git clone https://github.com/sparesparrow/mcp-prompts.git
cd mcp-prompts

# Install dependencies
npm install

# Build the project
npm run build

# Run the server
npm start
```

## Configuration

MCP-Prompts can be configured using environment variables:

```bash
# Storage configuration
STORAGE_TYPE=file            # Options: file, postgres, memory
PROMPTS_DIR=/path/to/prompts # Directory for file storage
BACKUPS_DIR=/path/to/backups # Directory for backups

# Server configuration
NODE_ENV=production          # Environment: production, development
HTTP_SERVER=false            # Enable/disable HTTP API server
PORT=3003                    # HTTP server port
HOST=0.0.0.0                 # HTTP server host
LOG_LEVEL=info               # Log level: debug, info, warn, error

# PostgreSQL configuration (if using postgres storage)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=mcp_prompts
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_SSL=false
# Or use connection string:
POSTGRES_CONNECTION_STRING=postgresql://postgres:postgres@localhost:5432/mcp_prompts
```

## Docker Deployment

### Using Docker Run

```bash
docker run -d \
  --name mcp-prompts \
  -p 3003:3003 \
  -v /path/to/prompts:/app/data/prompts \
  -v /path/to/backups:/app/data/backups \
  -e STORAGE_TYPE=file \
  -e HTTP_SERVER=true \
  sparesparrow/mcp-prompts:latest
```

### Using Docker Compose

Basic setup with file storage:

```yaml
# docker-compose.yml
version: '3.8'

services:
  mcp-prompts:
    image: sparesparrow/mcp-prompts:latest
    container_name: mcp-prompts
    environment:
      - NODE_ENV=production
      - STORAGE_TYPE=file
      - PROMPTS_DIR=/app/data/prompts
      - BACKUPS_DIR=/app/data/backups
      - LOG_LEVEL=info
      - HTTP_SERVER=false
      - PORT=3003
      - HOST=0.0.0.0
    volumes:
      - mcp-data:/app/data
    ports:
      - "3000:3000"
      - "3003:3003"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3003/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s
    restart: unless-stopped

volumes:
  mcp-data:
```

With PostgreSQL:

```yaml
# docker-compose.postgres.yml
version: '3.8'

services:
  postgres:
    image: postgres:14
    container_name: mcp-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: mcp_prompts
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    restart: unless-stopped

  mcp-prompts:
    image: sparesparrow/mcp-prompts:latest
    container_name: mcp-prompts-pg
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      - NODE_ENV=production
      - STORAGE_TYPE=postgres
      - POSTGRES_CONNECTION_STRING=postgresql://postgres:postgres@postgres:5432/mcp_prompts
      - PROMPTS_DIR=/app/data/prompts
      - BACKUPS_DIR=/app/data/backups
      - LOG_LEVEL=info
      - HTTP_SERVER=true
      - PORT=3003
      - HOST=0.0.0.0
    volumes:
      - prompts_data:/app/data
    ports:
      - "3003:3003"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3003/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s
    restart: unless-stopped

volumes:
  postgres_data:
    name: mcp-postgres-data
  prompts_data:
```

## Usage with Claude Desktop

Add the MCP-Prompts server to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "node",
      "args": ["/path/to/mcp-prompts/build/index.js"],
      "env": {
        "STORAGE_TYPE": "file",
        "PROMPTS_DIR": "/path/to/prompts"
      }
    }
  }
}
```

## API Usage

MCP-Prompts provides an HTTP API when running with `HTTP_SERVER=true`:

### Endpoints

- `GET /health`: Server health check
- `GET /prompts`: List all prompts
- `GET /prompts/:id`: Get a prompt by ID
- `POST /prompts`: Create a new prompt
- `PUT /prompts/:id`: Update a prompt
- `DELETE /prompts/:id`: Delete a prompt
- `POST /templates/:id/apply`: Apply variables to a template

### Example: Creating a Prompt

```bash
curl -X POST http://localhost:3003/prompts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Simple Greeting",
    "content": "Hello, world!",
    "tags": ["greeting", "simple"]
  }'
```

### Example: Creating a Template

```bash
curl -X POST http://localhost:3003/prompts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom Greeting",
    "content": "Hello, {{name}}! Welcome to {{service}}.",
    "isTemplate": true,
    "tags": ["greeting", "template"]
  }'
```

### Example: Applying a Template

```bash
curl -X POST http://localhost:3003/templates/custom-greeting/apply \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "name": "John",
      "service": "MCP-Prompts"
    }
  }'
```

## MCP Protocol Integration

MCP-Prompts implements the following MCP tools:

- `add_prompt`: Create a new prompt
- `get_prompt`: Retrieve a prompt by ID
- `update_prompt`: Update an existing prompt
- `list_prompts`: List prompts with filtering options
- `delete_prompt`: Delete a prompt
- `apply_template`: Apply variables to a template

Example MCP tool invocation (using MCP JSON-RPC):

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tool",
  "params": {
    "name": "list_prompts",
    "params": {
      "isTemplate": true,
      "tags": ["greeting"]
    }
  }
}
```

## Development

### Project Structure

```
/
├── src/                     # Source code
│   ├── adapters/            # Storage adapters (file, postgres, memory)
│   ├── interfaces/          # TypeScript interfaces
│   ├── services/            # Business logic
│   ├── tools/               # MCP tools implementation
│   ├── utils/               # Utilities
│   └── index.ts             # Main entry point
├── scripts/                 # Build and utility scripts
├── tests/                   # Test files
├── docker/                  # Docker configuration files
├── .github/workflows/       # GitHub Actions workflows
└── .devcontainer/           # VS Code devcontainer configuration
```

### Development Setup

```bash
# Clone the repository
git clone https://github.com/sparesparrow/mcp-prompts.git
cd mcp-prompts

# Install dependencies
npm install

# Run in development mode (with auto-reload)
npm run dev

# Run tests
npm test

# Run integration tests
npm run test:integration

# Run Docker tests
npm run test:docker
```

### Running in a Development Container

VS Code users can use the included devcontainer configuration:

1. Install the "Remote - Containers" extension
2. Open the project folder in VS Code
3. Click "Reopen in Container" when prompted
4. The container will set up the development environment automatically

### Building for Production

```bash
# Build the project
npm run build

# Start the server in production mode
npm start

# Build the Docker image
npm run docker:build

# Run with Docker Compose
npm run docker:up
```

## Containerized Testing

MCP-Prompts includes several scripts for containerized testing:

```bash
# Run all Docker tests
./scripts/test/docker-test.sh

# Test with PostgreSQL storage
./scripts/test/run-postgres-tests.sh

# Test the Docker build
./scripts/test/test-docker-build.sh

# Test with fixed Dockerfile
./scripts/test/test-fixed-docker.sh
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

Please ensure your code follows our coding standards and includes appropriate tests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.