#!/bin/bash
# Clean up legacy Docker files and configurations

set -e

# Change to the project root directory
cd "$(dirname "$0")/../.."
ROOT_DIR=$(pwd)

echo "=== MCP Prompts Docker Cleanup ==="
echo "Cleaning up legacy Docker files..."

# Create backup directory for legacy files
BACKUP_DIR="docker/legacy_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Backup and remove legacy Dockerfiles that have been consolidated
if ls docker/Dockerfile.*.bak &> /dev/null; then
  echo "Moving legacy Dockerfiles to backup..."
  mv docker/Dockerfile.*.bak "$BACKUP_DIR/" 2>/dev/null || true
fi

# Clean up legacy docker-compose files
if ls docker/docker-compose.*.bak &> /dev/null; then
  echo "Moving legacy docker-compose files to backup..."
  mv docker/docker-compose.*.bak "$BACKUP_DIR/" 2>/dev/null || true
fi

# Clean up any .tgz files left by npm pack
echo "Cleaning up npm pack files..."
find . -name "sparesparrow-mcp-prompts-*.tgz" -type f -delete

# Clean up temporary test files
echo "Cleaning up test files..."
find . -name "test-*.json" -type f -delete
find . -name "temp-*.json" -type f -delete

# Clean up redundant Docker files
echo "Cleaning up redundant Docker files..."
if [ -f "docker/Dockerfile.dynamic" ]; then
  mv docker/Dockerfile.dynamic "$BACKUP_DIR/" 2>/dev/null || true
fi

if [ -f "docker/docker-compose.dynamic.yml" ]; then
  mv docker/docker-compose.dynamic.yml "$BACKUP_DIR/" 2>/dev/null || true
fi

if [ -f "docker/docker-compose.core.yml" ]; then
  mv docker/docker-compose.core.yml "$BACKUP_DIR/" 2>/dev/null || true
fi

# Move the existing legacy directory to backup if it exists
if [ -d "docker/legacy" ]; then
  echo "Moving legacy Docker directory to backup..."
  mv docker/legacy "$BACKUP_DIR/legacy" 2>/dev/null || true
fi

# Clean up build and publish scripts
echo "Cleaning up old scripts..."
for script in "docker/scripts/apply-docker-config.sh" "docker/scripts/setup-docker-dirs.sh"; do
  if [ -f "$script" ]; then
    echo "Moving $script to backup..."
    mkdir -p "$BACKUP_DIR/scripts"
    mv "$script" "$BACKUP_DIR/scripts/" 2>/dev/null || true
  fi
done

# Update .dockerignore file
echo "Updating .dockerignore file..."
cat > .dockerignore << 'EOF'
node_modules
npm-debug.log
.git
.gitignore
.github
.vscode
.idea
coverage
*.md
!README.md
.env*
*.tgz
Dockerfile*
docker-compose*
.dockerignore
legacy*
backup*
temp*
test-*
EOF

echo "Cleanup complete! Legacy files have been moved to: $BACKUP_DIR" 