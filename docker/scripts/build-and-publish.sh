#!/bin/bash
# Script to build and publish Docker images for MCP-Prompts

set -e

# Default tag
TAG=${1:-latest}

echo "Building MCP-Prompts image with tag: $TAG"

# Build the main image
docker build -t sparesparrow/mcp-prompts:$TAG -f docker/Dockerfile .

# Build the test image
docker build -t sparesparrow/mcp-prompts:test -f docker/Dockerfile.test .

echo "Publishing images to Docker Hub..."

# Push the images
docker push sparesparrow/mcp-prompts:$TAG
docker push sparesparrow/mcp-prompts:test

echo "Images built and published successfully!" 