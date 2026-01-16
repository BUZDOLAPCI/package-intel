/**
 * Package Intel MCP Server - HTTP Transport
 * Uses StreamableHTTPServerTransport with raw Node.js HTTP
 */

import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { createStandaloneServer } from '../server.js';

// Session storage for active connections
const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: Server }>();

/**
 * Create a new session with fresh server and transport instances
 */
async function createNewSession(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const serverInstance = createStandaloneServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, { transport, server: serverInstance });
      console.error(`New Package Intel session created: ${sessionId}`);
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
      console.error(`Package Intel session closed: ${transport.sessionId}`);
    }
  };

  try {
    await serverInstance.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('Streamable HTTP connection error:', error);
    res.statusCode = 500;
    res.end('Internal server error');
  }
}

/**
 * Handle MCP requests at /mcp endpoint
 */
async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  // Handle existing session requests
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      res.statusCode = 404;
      res.end('Session not found');
      return;
    }
    return await session.transport.handleRequest(req, res);
  }

  // Create new session for POST requests without session ID
  if (req.method === 'POST') {
    await createNewSession(req, res);
    return;
  }

  res.statusCode = 400;
  res.end('Invalid request');
}

/**
 * Handle health check requests
 */
function handleHealthCheck(res: ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'package-intel',
    version: '0.1.0'
  }));
}

/**
 * Handle 404 not found
 */
function handleNotFound(res: ServerResponse): void {
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

/**
 * Start HTTP transport for the MCP server using StreamableHTTPServerTransport
 */
export function startHttpTransport(port: number): void {
  const httpServer = createHttpServer();
  const isProduction = process.env.NODE_ENV === 'production';
  const host = isProduction ? '0.0.0.0' : 'localhost';

  httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    switch (url.pathname) {
      case '/mcp':
        await handleMcpRequest(req, res);
        break;
      case '/health':
        handleHealthCheck(res);
        break;
      default:
        handleNotFound(res);
    }
  });

  httpServer.listen(port, host, () => {
    const displayUrl = isProduction ? `Port ${port}` : `http://localhost:${port}`;
    console.error(`Package Intel MCP server listening on ${displayUrl}`);
    console.error(`MCP endpoint: ${isProduction ? '/mcp' : `http://localhost:${port}/mcp`}`);
    console.error(`Health check: ${isProduction ? '/health' : `http://localhost:${port}/health`}`);
  });
}

/**
 * Create and start HTTP transport for the MCP server using StreamableHTTPServerTransport
 * @deprecated Use startHttpTransport instead. This function is kept for backward compatibility.
 */
export async function createHttpTransport(
  _server: Server,
  port: number
): Promise<void> {
  startHttpTransport(port);
}
