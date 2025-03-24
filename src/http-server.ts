import http from 'node:http';
import { ServerConfig } from './interfaces.js';
import { enableSseInHttpServer } from './sse.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * Create and start a simple HTTP server with health and SSE endpoints
 * @param config Server configuration
 * @param server Optional Server instance for SSE integration
 */
export function startHttpServer(config: ServerConfig, server?: Server): http.Server {
  // Create a simple HTTP server
  const httpServer = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', config.corsOrigin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    // Get the request path
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;
    
    console.error(`HTTP request: ${req.method} ${path}`);
    
    // Health check endpoint
    if (path === '/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'healthy',
        version: config.version,
        timestamp: new Date().toISOString(),
        features: {
          sse: Boolean(config.enableSSE),
          ssePath: config.enableSSE ? (config.ssePath || '/events') : null
        }
      }));
      return;
    }
    
    // Root endpoint with basic info
    if (path === '/') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        name: config.name,
        version: config.version,
        endpoints: [
          '/health',
          ...(config.enableSSE ? [(config.ssePath || '/events')] : [])
        ]
      }));
      return;
    }
    
    // Not found (but not for SSE endpoint, which is handled separately)
    if (!(config.enableSSE && path === (config.ssePath || '/events'))) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });
  
  // Enable SSE if needed
  if (config.enableSSE) {
    enableSseInHttpServer(config, httpServer, server);
  }
  
  // Listen on the specified host and port
  httpServer.listen(config.port, config.host, () => {
    console.error(`HTTP server started on ${config.host}:${config.port}`);
    if (config.enableSSE) {
      console.error(`SSE endpoint available at ${config.ssePath || '/events'}`);
    }
  });
  
  // Handle server errors
  httpServer.on('error', (err) => {
    console.error('HTTP server error:', err);
  });
  
  return httpServer;
} 