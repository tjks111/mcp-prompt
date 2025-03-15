import http from 'node:http';
import { ServerConfig } from './interfaces.js';

/**
 * Create and start a simple HTTP server with health and SSE endpoints
 * @param config Server configuration
 */
export function startHttpServer(config: ServerConfig) {
  // Create a simple HTTP server
  const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', config.corsOrigin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    // Get the request path
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;
    
    console.error(`HTTP request: ${req.method} ${path}`);
    
    // SSE endpoint
    if (config.enableSSE && path === (config.ssePath || '/events')) {
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      // Send a welcome message
      res.write(`data: ${JSON.stringify({ type: 'connect', message: 'Connected to MCP Prompts SSE stream' })}\n\n`);
      
      // Keep the connection alive with heartbeat
      const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
      }, 30000);
      
      // Handle client disconnect
      req.on('close', () => {
        clearInterval(heartbeat);
        console.error('SSE connection closed');
      });
      
      return;
    }
    
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
    
    // Not found
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
  });
  
  // Listen on the specified host and port
  server.listen(config.port, config.host, () => {
    console.error(`HTTP server started on ${config.host}:${config.port}`);
    if (config.enableSSE) {
      console.error(`SSE endpoint available at ${config.ssePath || '/events'}`);
    }
  });
  
  // Handle server errors
  server.on('error', (err) => {
    console.error('HTTP server error:', err);
  });
  
  return server;
} 