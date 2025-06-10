#!/usr/bin/env node

/**
 * MCP Prompts Server Startup Script
 * 
 * This script provides a convenient way to start the MCP Prompts server
 * with the correct environment variables.
 * 
 * Usage:
 *   npm run start:server
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createServer } from '../index.js';
import { StorageConfig } from '../interfaces.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

/**
 * Function to load environment variables from .env file
 * @param filePath Path to the .env file
 */
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    console.error(`Environment file not found: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach(line => {
    // Skip empty lines and comments
    if (!line || line.startsWith('#')) return;
    
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
      console.log(`Set environment variable: ${key.trim()}=${value.trim()}`);
    }
  });
}

// Load the .env file
const envFile = path.join(rootDir, '.env');
loadEnvFile(envFile);

// Set default values if not set in .env
process.env.STORAGE_TYPE = process.env.STORAGE_TYPE || 'memory';
process.env.HTTP_SERVER = process.env.HTTP_SERVER || 'true';
process.env.PORT = process.env.PORT || '3000';
process.env.ENABLE_SSE = process.env.ENABLE_SSE || 'true';
process.env.SSE_PATH = process.env.SSE_PATH || '/sse';
process.env.HOST = process.env.HOST || '0.0.0.0';

// Log the configuration being used
console.log('\nStarting MCP Prompts server with configuration:');
console.log(`STORAGE_TYPE=${process.env.STORAGE_TYPE}`);
console.log(`HTTP_SERVER=${process.env.HTTP_SERVER}`);
console.log(`PORT=${process.env.PORT}`);
console.log(`ENABLE_SSE=${process.env.ENABLE_SSE}`);
console.log(`SSE_PATH=${process.env.SSE_PATH}`);
console.log(`HOST=${process.env.HOST || '0.0.0.0'}`);
console.log();

const DEFAULT_CONFIG: StorageConfig = {
  type: process.env.STORAGE_TYPE as 'file' | 'memory' | 'postgres' || 'memory',
  promptsDir: process.env.PROMPTS_DIR,
  backupsDir: process.env.BACKUPS_DIR,
  pgHost: process.env.PG_HOST,
  pgPort: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : undefined,
  pgUser: process.env.PG_USER,
  pgPassword: process.env.PG_PASSWORD,
  pgDatabase: process.env.PG_DATABASE
};

async function main() {
  try {
    // Create and initialize the MCP server
    const server = await createServer(DEFAULT_CONFIG);

    // Start HTTP server if enabled
    if (process.env.HTTP_SERVER === 'true') {
      const port = parseInt(process.env.PORT || '3000', 10);
      const host = process.env.HOST || '0.0.0.0'; // Use 0.0.0.0 for external access

      const app = express();
      app.use(express.json());

      // Enable CORS if corsOrigin is set
      if (process.env.CORS_ORIGIN) {
        const cors = await import('cors');
        app.use(cors.default({ origin: process.env.CORS_ORIGIN }));
      }

      // Map to store transports by session ID
      const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

      // Handle POST requests for client-to-server communication
      /*
      app.post('/mcp', async (req: Request, res: Response) => {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
          // Reuse existing transport
          transport = transports[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
          // New initialization request
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId) => {
              // Store the transport by session ID
              transports[sessionId] = transport;
            }
          });

          // Clean up transport when closed
          transport.onclose = () => {
            if (transport.sessionId) {
              delete transports[transport.sessionId];
            }
          };

          // Connect to the MCP server
          await server.connect(transport);
        } else {
          // Invalid request
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided',
            },
            id: null,
          });
          return;
        }

        // Handle the request
        await transport.handleRequest(req, res, req.body);
      });
      */

      // Reusable handler for GET and DELETE requests
      /*
      const handleSessionRequest = async (req: express.Request, res: express.Response) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
          res.status(400).send('Invalid or missing session ID');
          return;
        }

        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
      };
      */

      // Handle GET requests for server-to-client notifications via SSE
      /*
      app.get('/mcp', handleSessionRequest);
      */

      // Handle DELETE requests for session termination
      /*
      app.delete('/mcp', handleSessionRequest);
      */

      app.listen(port, host, () => {
        console.log(`MCP Streamable HTTP Server listening on http://${host}:${port}`);
      });
    }

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
