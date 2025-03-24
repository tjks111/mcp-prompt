/**
 * Server-Sent Events (SSE) implementation for MCP Prompts
 * 
 * This module provides functionality for creating SSE servers and clients
 * for the MCP Prompts project. It implements the MCP SSE transport layer
 * following best practices.
 */

import type { IncomingMessage, Server as HttpServer } from 'node:http';
import { ServerResponse } from 'node:http';
import EventEmitter from 'node:events';
import {
  ServerConfig,
} from './interfaces.js';
import { SSEServerTransport} from '@modelcontextprotocol/sdk/server/sse.js';
import  type { Server as MCPServer } from '@modelcontextprotocol/sdk/server/index.js';
import { Express } from 'express';

// Define the interfaces that were previously imported
interface SseClient {
  id: string;
  req: IncomingMessage;
  res: ServerResponse;
  connected: boolean;
  connectedAt: Date;
  lastActivity: Date;
  history: Array<{
    timestamp: Date;
    event: string;
    data: string;
  }>;
  metadata: Record<string, string>;
  intervals?: {
    heartbeat: NodeJS.Timeout;
    timeout: NodeJS.Timeout;
  };
}

interface SseManagerOptions {
  heartbeatInterval?: number;
  clientTimeout?: number;
  messageHistory?: number;
}

interface SseOptions {
  clientId?: string;
  metadata?: Record<string, string>;
  initialMessage?: any;
}

interface TransportImplementation {
  sendMessage: (message: any, clientId?: string) => boolean;
  getClients: () => string[];
}

/**
 * Manager for SSE clients and message broadcasting
 */
export class SseManager extends EventEmitter {
  private clients: Map<string, SseClient> = new Map();
  private _options: SseManagerOptions;
  private _transportImpl: TransportImplementation | null = null;
  private sseTransport: SSEServerTransport | null = null;
  
  constructor(options: SseManagerOptions = {}) {
    super();
    this._options = {
      heartbeatInterval: options.heartbeatInterval || 30000,
      clientTimeout: options.clientTimeout || 60000,
      messageHistory: options.messageHistory || 50,
      ...options
    };
  }
  
  /**
   * Get SSE transport implementation that can be passed to MCP Server
   */
  public get transportImpl(): TransportImplementation {
    if (!this._transportImpl) {
      // Create a transport implementation
      this._transportImpl = {
        sendMessage: (message, clientId) => {
          if (clientId) {
            // Send to specific client
            const client = this.clients.get(clientId);
            if (client) {
              this._writeToClient(client, message);
              return true;
            }
            return false;
          } else {
            // Broadcast to all clients
            let sent = false;
            for (const client of this.clients.values()) {
              this._writeToClient(client, message);
              sent = true;
            }
            return sent;
          }
        },
        
        getClients: () => {
          return Array.from(this.clients.keys());
        }
      };
    }
    
    return this._transportImpl;
  }
  
  /**
   * Get the SSE server transport that can be used with the MCP Server
   */
  public getSseTransport(): SSEServerTransport {
    if (!this.sseTransport) {
      // Create a custom SSE transport with default endpoint
      // Note: In newer versions, we need to provide endpoint and response 
      // but the actual transport will be managed through our custom implementation
      const endpoint = '/events';
      const dummyResponse = new ServerResponse({} as IncomingMessage);
      this.sseTransport = new SSEServerTransport(endpoint, dummyResponse);
    }
    
    return this.sseTransport;
  }
  
  /**
   * Handle a new client connection
   * @param req The HTTP request
   * @param res The HTTP response
   * @param options Connection options
   * @returns The client ID
   */
  public handleConnection(
    req: IncomingMessage,
    res: ServerResponse,
    options: SseOptions = {}
  ): string {
    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    });
    
    // Force flush headers
    res.flushHeaders();
    
    // Generate a client ID if not provided
    const clientId = options.clientId || `client_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Create the client object
    const client: SseClient = {
      id: clientId,
      req,
      res,
      connected: true,
      connectedAt: new Date(),
      lastActivity: new Date(),
      history: [],
      metadata: options.metadata || {},
    };
    
    // Store the client
    this.clients.set(clientId, client);
    console.error(`SSE client connected: ${clientId}`);
    
    // Set up heartbeat interval for this client
    const heartbeatInterval = setInterval(() => {
      if (client && client.connected) {
        this._sendHeartbeat(client);
      }
    }, this._options.heartbeatInterval || 30000);
    
    // Set up client timeout checker
    const timeoutChecker = setInterval(() => {
      if (client && client.connected) {
        const now = new Date();
        const timeSinceLastActivity = now.getTime() - client.lastActivity.getTime();
        
        if (timeSinceLastActivity > (this._options.clientTimeout || 60000)) {
          console.error(`SSE client timed out: ${clientId}`);
          this._disconnectClient(clientId);
        }
      }
    }, (this._options.clientTimeout || 60000) / 2);
    
    // Store the intervals so we can clear them when client disconnects
    client.intervals = {
      heartbeat: heartbeatInterval,
      timeout: timeoutChecker,
    };
    
    // Handle client disconnect
    req.on('close', () => {
      this._disconnectClient(clientId);
    });
    
    // Send initial message if specified
    if (options.initialMessage) {
      this._writeToClient(client, options.initialMessage);
    }
    
    // Send welcome message
    this._writeToClient(client, {
      event: 'connected',
      data: JSON.stringify({
        clientId,
        connectedAt: client.connectedAt.toISOString(),
        message: 'Connected to SSE stream',
        metadata: client.metadata,
      }),
    });
    
    // Emit connection event
    this.emit('connection', clientId, client);
    
    return clientId;
  }
  
  /**
   * Send a message to a specific client
   * @param clientId The client ID
   * @param message The message to send
   * @returns Success status
   */
  public sendToClient(clientId: string, message: any): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }
    
    return this._writeToClient(client, message);
  }
  
  /**
   * Broadcast a message to all connected clients
   * @param message The message to broadcast
   * @returns Number of clients the message was sent to
   */
  public broadcast(message: any): number {
    let sentCount = 0;
    
    for (const client of this.clients.values()) {
      if (this._writeToClient(client, message)) {
        sentCount++;
      }
    }
    
    return sentCount;
  }
  
  /**
   * Disconnect a client
   * @param clientId The client ID to disconnect
   */
  public disconnectClient(clientId: string): boolean {
    return this._disconnectClient(clientId);
  }
  
  /**
   * Get active client count
   */
  public get clientCount(): number {
    return this.clients.size;
  }
  
  /**
   * Get a list of connected client IDs
   */
  public getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }
  
  /**
   * Internal method to write to a client
   */
  private _writeToClient(client: SseClient, message: any): boolean {
    if (!client || !client.connected) {
      return false;
    }
    
    try {
      // Update last activity timestamp
      client.lastActivity = new Date();
      
      // Prepare the message based on format
      let eventName = 'message';
      let eventData: string;
      
      if (typeof message === 'string') {
        eventData = message;
      } else if (message.event && message.data) {
        // { event, data } format
        eventName = message.event;
        eventData = typeof message.data === 'string' ? message.data : JSON.stringify(message.data);
      } else {
        // Any other object
        eventData = JSON.stringify(message);
      }
      
      // Create the SSE message format
      const sseMessage = `event: ${eventName}\ndata: ${eventData}\n\n`;
      
      // Add to history if needed
      if (this._options.messageHistory && this._options.messageHistory > 0 && eventName !== 'heartbeat') {
        client.history.push({
          timestamp: new Date(),
          event: eventName,
          data: eventData,
        });
        
        // Trim history if it exceeds the limit
        if (client.history.length > (this._options.messageHistory || 50)) {
          client.history.shift();
        }
      }
      
      // Write to the response
      client.res.write(sseMessage);
      
      return true;
    } catch (err) {
      console.error(`Error writing to SSE client ${client.id}:`, err);
      this._disconnectClient(client.id);
      return false;
    }
  }
  
  /**
   * Send a heartbeat to keep the connection alive
   */
  private _sendHeartbeat(client: SseClient): void {
    if (client && client.connected) {
      this._writeToClient(client, {
        event: 'heartbeat',
        data: new Date().toISOString(),
      });
    }
  }
  
  /**
   * Internal method to disconnect a client
   */
  private _disconnectClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }
    
    // Clear intervals
    if (client.intervals) {
      clearInterval(client.intervals.heartbeat);
      clearInterval(client.intervals.timeout);
    }
    
    // Mark as disconnected
    client.connected = false;
    
    // Try to end the response
    try {
      client.res.end();
    } catch (e) {
      // Ignore errors when ending response
    }
    
    // Remove from clients map
    this.clients.delete(clientId);
    
    // Emit disconnect event
    this.emit('disconnection', clientId);
    console.error(`SSE client disconnected: ${clientId}`);
    
    return true;
  }
}

// SseManager singleton instance
let sseManager: SseManager | null = null;

/**
 * Get the global SSE manager instance
 */
export function getSseManager(options?: SseManagerOptions): SseManager {
  if (!sseManager) {
    sseManager = new SseManager(options);
  }
  return sseManager;
}

/**
 * Enable SSE in an HTTP server with optional MCP server integration
 */
export function enableSseInHttpServer(
  config: ServerConfig,
  httpServer: HttpServer,
  mcpServer?: MCPServer
): SseManager {
  // Create or get the SSE manager
  const manager = getSseManager();
  
  // Set up the SSE endpoint handler
  const ssePath = config.ssePath || '/events';
  
  // Handle SSE connections through the HTTP server
  httpServer.on('request', (req, res) => {
    if (req && req.url && req.url.startsWith(ssePath)) {
      // Get client ID and metadata from query parameters
      const url = new URL(req.url, `http://${req.headers.host}`);
      const clientId = url.searchParams.get('clientId') || undefined;
      const metadata: Record<string, string> = {};
      
      // Extract metadata from query parameters
      for (const [key, value] of url.searchParams.entries()) {
        if (key !== 'clientId') {
          metadata[key] = value;
        }
      }
      
      // Handle the SSE connection
      manager.handleConnection(req, res, { clientId, metadata });
    }
  });
  
  // If MCP server is provided, integrate with it 
  if (mcpServer) {
    // With the latest SDK, we need to register our SSE transport with the server
    // But we will let the server.connect() call handle this in index.ts
    console.error('SSE manager initialized for MCP server');
  }
  
  return manager;
}

export function setupSSE(app: Express, path: string) {
  app.get(path, (req, res) => {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Send initial connection message
    res.write('event: connected\ndata: {}\n\n');

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(keepAlive);
    });
  });
} 


