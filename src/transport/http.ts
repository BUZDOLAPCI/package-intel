/**
 * Package Intel MCP Server - HTTP Transport
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';

/**
 * Create and start HTTP transport for the MCP server using SSE
 */
export async function createHttpTransport(
  server: Server,
  port: number
): Promise<void> {
  const transports = new Map<string, SSEServerTransport>();

  const httpServer = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://localhost:${port}`);

      // Health check endpoint
      if (url.pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', server: 'package-intel' }));
        return;
      }

      // SSE endpoint for MCP connection
      if (url.pathname === '/sse' && req.method === 'GET') {
        const sessionId = crypto.randomUUID();
        const transport = new SSEServerTransport(`/message/${sessionId}`, res);
        transports.set(sessionId, transport);

        res.on('close', () => {
          transports.delete(sessionId);
        });

        await server.connect(transport);
        return;
      }

      // Message endpoint for MCP messages
      if (url.pathname.startsWith('/message/') && req.method === 'POST') {
        const sessionId = url.pathname.split('/')[2];
        const transport = transports.get(sessionId);

        if (!transport) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Session not found' }));
          return;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            await transport.handlePostMessage(req, res, body);
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({ error: 'Failed to process message' })
            );
          }
        });
        return;
      }

      // 404 for unknown routes
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  );

  return new Promise((resolve) => {
    httpServer.listen(port, () => {
      console.error(`Package Intel MCP server listening on http://localhost:${port}`);
      console.error(`SSE endpoint: http://localhost:${port}/sse`);
      console.error(`Health check: http://localhost:${port}/health`);
      resolve();
    });
  });
}
