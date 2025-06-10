// mcp-prompts/src/scripts/start-server.ts
import express from 'express';
import { createServer } from '../index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StorageConfig } from '../interfaces.js';

async function main() {
  console.log('Starting MCP Prompts Server...');

  const config: StorageConfig = {
    type: process.env.STORAGE_TYPE as 'file' | 'memory' | 'postgres' || 'memory',
    promptsDir: process.env.PROMPTS_DIR,
    backupsDir: process.env.BACKUPS_DIR,
    pgHost: process.env.PG_HOST,
    pgPort: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : undefined,
    pgUser: process.env.PG_USER,
    pgPassword: process.env.PG_PASSWORD,
    pgDatabase: process.env.PG_DATABASE
  };

  const mcpServer = await createServer(config);

  if (process.env.HTTP_SERVER === 'true') {
    const app = express();
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    let transport: SSEServerTransport;

    app.get("/", async (req, res) => {
      console.log("SSE connection initiated.");
      transport = new SSEServerTransport("/", res);
      try {
        await mcpServer.connect(transport);
        console.log("MCP Server connected to SSE transport.");
      } catch (error) {
        console.error("Error connecting server to SSE transport:", error);
      }
    });

    app.post("/", express.json(), async (req, res) => {
      if (!transport) {
        console.error("POST to / received before SSE connection was established.");
        return res.status(400).send("No active SSE transport. Please connect to / first.");
      }
      console.log("Handling POST message.");
      await transport.handlePostMessage(req, res);
    });

    app.listen(port, host, () => {
      console.log(`MCP Prompts Server listening on http://${host}:${port}`);
      console.log("Connect to / to establish a connection.");
    }).on('error', (err: NodeJS.ErrnoException) => {
      console.error('Server failed to start:', err);
      process.exit(1);
    });
  }
}

main().catch(err => {
  console.error("Unhandled error in main:", err);
  process.exit(1);
});
