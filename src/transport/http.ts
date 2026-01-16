/**
 * Package Intel MCP Server - HTTP Transport
 * Uses StreamableHTTPServerTransport with raw Node.js HTTP
 */

import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';

// Session storage for active connections
const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: Server }>();

/**
 * Handle MCP requests at /mcp endpoint
 */
async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  serverFactory: () => Server
): Promise<void> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id',
    });
    res.end();
    return;
  }

  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');

  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (req.method === 'POST') {
    // Check for existing session
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
      return;
    }

    // Create new session for initialization
    const newSessionId = randomUUID();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
      onsessioninitialized: (id) => {
        console.error(`Session initialized: ${id}`);
      },
    });

    const server = serverFactory();
    sessions.set(newSessionId, { transport, server });

    // Clean up session on close
    transport.onclose = () => {
      console.error(`Session closed: ${newSessionId}`);
      sessions.delete(newSessionId);
    };

    await server.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  if (req.method === 'GET') {
    // SSE stream for server-to-client notifications
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
      return;
    }

    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing or invalid session ID' }));
    return;
  }

  if (req.method === 'DELETE') {
    // Close session
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.close();
      sessions.delete(sessionId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'session closed' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Session not found' }));
    return;
  }

  // Method not allowed
  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method not allowed' }));
}

/**
 * Handle health check requests
 */
function handleHealthCheck(res: ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', server: 'package-intel' }));
}

/**
 * Handle 404 not found
 */
function handleNotFound(res: ServerResponse): void {
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

/**
 * Create and start HTTP transport for the MCP server using StreamableHTTPServerTransport
 */
export async function createHttpTransport(
  server: Server,
  port: number
): Promise<void> {
  // Create a factory function that returns the configured server
  // This allows creating new server instances for each session while sharing the same configuration
  const serverFactory = (): Server => server;

  const httpServer = createHttpServer();

  httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);

    switch (url.pathname) {
      case '/mcp':
        await handleMcpRequest(req, res, serverFactory);
        break;
      case '/health':
        handleHealthCheck(res);
        break;
      default:
        handleNotFound(res);
    }
  });

  return new Promise((resolve) => {
    httpServer.listen(port, () => {
      console.error(`Package Intel MCP server listening on http://localhost:${port}`);
      console.error(`MCP endpoint: http://localhost:${port}/mcp`);
      console.error(`Health check: http://localhost:${port}/health`);
      resolve();
    });
  });
}
