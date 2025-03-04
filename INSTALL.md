# Installation Guide for Prompt Manager MCP Server

This document provides detailed instructions for installing and setting up the Prompt Manager MCP server.

## Prerequisites

- Node.js (v14 or higher)
- npm (v7 or higher)
- Claude Desktop (for integration)

## Manual Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/prompt-manager-mcp.git
   cd prompt-manager-mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Configure Claude Desktop**

   Edit your Claude Desktop configuration file:
   
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

   Add the following configuration:
   
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

   Replace `/absolute/path/to` with the actual path to your project directory.

5. **Restart Claude Desktop**

   Close and reopen Claude Desktop to load the MCP server.

## Automatic Installation

For convenience, we provide a script that automates the installation process:

```bash
# Make the script executable
chmod +x install-claude.sh

# Run the installation script
./install-claude.sh
```

The script will:
1. Build the project
2. Find the Claude Desktop configuration directory
3. Update the configuration to include the Prompt Manager
4. Provide instructions for restarting Claude Desktop

## Verifying Installation

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

## Troubleshooting

If you encounter issues:

1. **Server not appearing in Claude**
   - Check that the path in your configuration is correct and absolute
   - Verify that the server builds successfully
   - Check Claude's logs for any error messages

2. **Cannot find prompts**
   - Verify that the `prompts` directory exists and contains JSON files
   - Check the server's console output for any errors

3. **"Command not found" errors**
   - Ensure Node.js is installed and in your PATH
   - Try using the absolute path to the Node.js executable

4. **Permission issues**
   - Make sure the scripts are executable (`chmod +x script.sh`)
   - Verify that you have read/write access to the configuration directory

For more help, check the logs or open an issue on the GitHub repository.