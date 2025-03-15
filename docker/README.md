# MCP-Prompts Docker Configuration

This directory contains Docker configurations for MCP-Prompts, providing consistent containerized environments for development, testing, and production use.

## Docker Compose Configurations

The project uses multiple Docker Compose configurations for different purposes:

### Base Configuration (`docker-compose.yml`)
- Located at project root
- Provides the base configuration for the MCP-Prompts server
- Used as a foundation for all other configurations

### Development Environment (`docker/docker-compose.dev.yml`)
- Includes a development server with live reloading
- Uses a separate PostgreSQL database on port 5442
- Exposes port 3004 for web access
- Enables Node.js inspector on port 9229

### Integration Testing (`docker/docker-compose.integration.yml`)
- Sets up multiple MCP server instances:
  - File-based server on port 3005
  - Memory-based server on port 3010
  - GitHub-based server on port 3011
- Configures persistent volume for file data

### PostgreSQL Support (`docker/docker-compose.postgres.yml`)
- Adds PostgreSQL database for production use
- Includes Adminer for database management

### Test Environment (`docker/docker-compose.test.yml`)
- Configures unit and integration test environments
- Uses a separate test PostgreSQL database
- Doesn't expose external ports

### PGAI Support (`docker/docker-compose.pgai.yml`)
- Configures AI-assisted PostgreSQL environment

## Common Usage

### Start Base Server
```bash
docker compose up -d
```

### Start Development Environment
```bash
docker compose -f docker-compose.yml -f docker/docker-compose.dev.yml up -d
```

### Start with PostgreSQL
```bash
docker compose -f docker-compose.yml -f docker/docker-compose.postgres.yml up -d
```

### Run Tests
```bash
docker compose -f docker-compose.yml -f docker/docker-compose.test.yml up -d
```

### Run Integration Tests
```bash
docker compose -f docker-compose.yml -f docker/docker-compose.integration.yml up -d
```

## Building and Publishing Images

A convenience script is provided for building and publishing Docker images:

```bash
./docker/scripts/build-and-publish.sh [tag]
```

This script builds both the main and test images and publishes them to Docker Hub.

## Helper Scripts

Additional utility scripts in the `docker/scripts` directory:
- `cleanup-docker-files.sh`: Cleans up any orphaned Docker files
- `build-and-publish.sh`: Builds and publishes Docker images

## Container Health Checks

All containers include health checks to ensure they're running properly. You can check container health with:

```bash
docker compose ps
```

## Volumes

The following volumes are used:
- `mcp-prompts-file-data`: For file-based prompt storage
- `mcp-prompts_postgres_data`: For PostgreSQL data persistence
- `mcp-prompts_postgres_test_data`: For test database data

## Networks

All containers connect to the `mcp-network` for internal communication.

## Directory Structure

- `Dockerfile.production` - Production-optimized Dockerfile for MCP Prompts server
- `Dockerfile.dev` - Development environment with hot reloading
- `Dockerfile.test` - Test environment for running automated tests
- `docker-compose.*.yml` - Various Docker Compose configurations for different scenarios
- `postgres/` - PostgreSQL initialization scripts
- `scripts/` - Utility scripts for Docker management
- `legacy/` - Deprecated Docker files kept for reference

## Container Architecture

The MCP Prompts project uses several containers for different purposes:

1. **postgres**: PostgreSQL database for storing prompts (when using PostgreSQL storage)
2. **mcp-prompts**: MCP Prompts server with file storage (default)
3. **mcp-postgres**: MCP Prompts server with PostgreSQL storage
4. **mcp-mdc**: MCP Prompts server with MDC storage (for Cursor Rules)
5. **adminer**: Web-based PostgreSQL client (development only)

## Storage Adapters

The MCP Prompts server supports multiple storage backends:

- **File Storage**: Default storage that saves prompts to the filesystem
- **PostgreSQL Storage**: Stores prompts in a PostgreSQL database
- **MDC Storage**: Stores prompts as Cursor Rules in MDC format

## Network Configuration

- The containers run on a custom bridge network (`mcp-network`)
- Configured with subnet `172.28.0.0/16` and gateway `172.28.0.1`
- Each container has internal service discovery via container name

## Volume Management

- `postgres_data`: Persistent volume for PostgreSQL data
- `mcp-data`: Persistent volume for MCP Prompts file storage
- `mdc_storage`: Persistent volume for MDC (Cursor Rules) storage

## Testing Docker Configurations

To test all Docker Compose configurations:

```bash
./docker/scripts/test-docker-configurations.sh
```

## Cleaning Up Docker Resources

```bash
docker compose down -v
docker network prune
```

## Image Publishing

When creating new releases, build and publish the Docker image:

```bash
docker build -t sparesparrow/mcp-prompts:latest -f docker/Dockerfile.production .
docker tag sparesparrow/mcp-prompts:latest sparesparrow/mcp-prompts:x.y.z
docker push sparesparrow/mcp-prompts:latest
docker push sparesparrow/mcp-prompts:x.y.z
```

## Best Practices

1. Always use named volumes for persistent data
2. Include health checks for all services
3. Use appropriate restart policies based on the environment
4. Separate development, testing, and production configurations
5. Use environment variables for configuration
6. Follow the principle of least privilege for container security 