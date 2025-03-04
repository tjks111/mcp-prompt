#!/bin/bash

# Exit on error
set -e

# Get the absolute path to the project directory
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BUILD_DIR="$PROJECT_DIR/build"

echo "Building the project..."
bash "$PROJECT_DIR/build.sh"

# Get the platform-specific Claude configuration directory
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  CONFIG_DIR="$HOME/Library/Application Support/Claude"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Linux
  CONFIG_DIR="$HOME/.config/Claude"
else
  # Windows (untested)
  CONFIG_DIR="$APPDATA/Claude"
fi

echo "Detected Claude configuration directory: $CONFIG_DIR"

# Create the configuration directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

# Create or update the Claude configuration
CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
if [ -f "$CONFIG_FILE" ]; then
  echo "Found existing Claude configuration, updating..."
  # Create a backup of the existing configuration
  cp "$CONFIG_FILE" "$CONFIG_FILE.backup"
  
  # Check if the configuration already has an mcpServers section
  if grep -q "\"mcpServers\"" "$CONFIG_FILE"; then
    # Replace or add the prompt-manager entry
    TMP_FILE=$(mktemp)
    jq ".mcpServers.\"prompt-manager\" = {\"command\": \"node\", \"args\": [\"$BUILD_DIR/index.js\"]}" "$CONFIG_FILE" > "$TMP_FILE"
    mv "$TMP_FILE" "$CONFIG_FILE"
  else
    # Add the mcpServers section
    TMP_FILE=$(mktemp)
    jq ". += {\"mcpServers\": {\"prompt-manager\": {\"command\": \"node\", \"args\": [\"$BUILD_DIR/index.js\"]}}}" "$CONFIG_FILE" > "$TMP_FILE"
    mv "$TMP_FILE" "$CONFIG_FILE"
  fi
else
  echo "Creating new Claude configuration..."
  # Create a new configuration file
  echo "{\"mcpServers\": {\"prompt-manager\": {\"command\": \"node\", \"args\": [\"$BUILD_DIR/index.js\"]}}}" > "$CONFIG_FILE"
fi

echo "Configuration updated successfully:"
cat "$CONFIG_FILE"

echo "Installation complete! Please restart Claude Desktop to use the Prompt Manager."