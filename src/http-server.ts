import http from 'node:http';
import { ServerConfig } from './interfaces.js';

/**
 * Create and start a simple HTTP server with a health endpoint
 * @param config Server configuration
 */
export function startHttpServer(config: ServerConfig) {
  // Create a simple HTTP server
  const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
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
        endpoints: ['/health'],
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
  });
  
  // Handle server errors
  server.on('error', (err) => {
    console.error('HTTP server error:', err);
  });
} 