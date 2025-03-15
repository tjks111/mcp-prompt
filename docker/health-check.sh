#!/bin/sh

# Health check script for MCP Prompts Docker containers
# This script checks if wget is installed and then uses it to check the health endpoint

# Enable debug mode
set -x

# Get the port from the environment or default to 3003
PORT=${PORT:-3003}

# Check if wget is available
if ! command -v wget >/dev/null 2>&1; then
  echo "wget not found, installing..."
  apk add --no-cache wget || { echo "Failed to install wget"; exit 1; }
fi

# Print environment info for debugging
echo "Checking health for port: $PORT"
echo "Environment variables:"
env | grep -E 'PORT|HOST|STORAGE|NODE_ENV'

# Check if the process is running
if ! ps aux | grep -v grep | grep -q node; then
  echo "Node process is not running!"
  exit 1
fi

# Try to connect to the server first to see if it's up
if ! wget -q --spider --timeout=5 http://localhost:$PORT/; then
  echo "Server on port $PORT is not responding to basic requests"
  # Continue to check health endpoint anyway
fi

# Perform health check with more verbose output
echo "Checking health endpoint..."
if wget -q --spider --timeout=10 http://localhost:$PORT/health; then
  echo "Health check passed!"
  exit 0
else
  echo "Health check failed for http://localhost:$PORT/health"
  # Try one more time with full output for debugging
  wget --spider -S http://localhost:$PORT/health || true
  exit 1
fi 