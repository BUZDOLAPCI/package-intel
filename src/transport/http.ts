/**
 * Package Intel MCP Server - HTTP Transport
 * Uses stateless JSON-RPC handling for MCP compatibility
 */

import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import { packageSummary, releaseTimeline, maintenanceSignals } from '../tools/index.js';
import type {
  PackageSummaryInput,
  ReleaseTimelineInput,
  MaintenanceSignalsInput,
  Ecosystem,
} from '../types.js';

/**
 * JSON-RPC request structure
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC response structure
 */
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Tool definition for MCP
 */
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Tool definitions for package-intel
 */
const toolDefinitions: ToolDefinition[] = [
  {
    name: 'package_summary',
    description:
      'Get summary information about a package from npm, PyPI, or crates.io. Returns name, version, description, homepage, repository, license, keywords, and download counts (where available).',
    inputSchema: {
      type: 'object',
      properties: {
        ecosystem: {
          type: 'string',
          enum: ['npm', 'pypi', 'crates'],
          description: 'The package ecosystem to query',
        },
        name: {
          type: 'string',
          description: 'The name of the package',
        },
      },
      required: ['ecosystem', 'name'],
    },
  },
  {
    name: 'release_timeline',
    description:
      'Get the release history of a package with version numbers and dates, sorted by date descending. Useful for understanding release cadence and version progression.',
    inputSchema: {
      type: 'object',
      properties: {
        ecosystem: {
          type: 'string',
          enum: ['npm', 'pypi', 'crates'],
          description: 'The package ecosystem to query',
        },
        name: {
          type: 'string',
          description: 'The name of the package',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of releases to return (default: 20, max: 100)',
        },
      },
      required: ['ecosystem', 'name'],
    },
  },
  {
    name: 'maintenance_signals',
    description:
      'Analyze maintenance health signals for a package. Returns days since last release, release frequency, total versions, deprecation status, and an overall maintenance score (good/fair/poor).',
    inputSchema: {
      type: 'object',
      properties: {
        ecosystem: {
          type: 'string',
          enum: ['npm', 'pypi', 'crates'],
          description: 'The package ecosystem to query',
        },
        name: {
          type: 'string',
          description: 'The name of the package',
        },
      },
      required: ['ecosystem', 'name'],
    },
  },
];

/**
 * Validate ecosystem value
 */
function isValidEcosystem(value: unknown): value is Ecosystem {
  return value === 'npm' || value === 'pypi' || value === 'crates';
}

/**
 * Handle a single JSON-RPC request
 */
async function handleJsonRpcRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'package-intel',
              version: '0.1.0',
            },
          },
        };
      }

      case 'tools/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: toolDefinitions,
          },
        };
      }

      case 'tools/call': {
        const toolName = params?.name as string;
        const args = params?.arguments as Record<string, unknown>;

        let result: unknown;

        switch (toolName) {
          case 'package_summary': {
            const input: PackageSummaryInput = {
              ecosystem: args?.ecosystem as Ecosystem,
              name: args?.name as string,
            };
            if (!isValidEcosystem(input.ecosystem)) {
              return {
                jsonrpc: '2.0',
                id,
                result: {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify({
                        ok: false,
                        error: {
                          code: 'INVALID_INPUT',
                          message: `Invalid ecosystem: ${input.ecosystem}. Must be one of: npm, pypi, crates`,
                          details: { provided: input.ecosystem },
                        },
                        meta: { retrieved_at: new Date().toISOString() },
                      }),
                    },
                  ],
                },
              };
            }
            result = await packageSummary(input);
            break;
          }

          case 'release_timeline': {
            const input: ReleaseTimelineInput = {
              ecosystem: args?.ecosystem as Ecosystem,
              name: args?.name as string,
              limit: args?.limit as number | undefined,
            };
            if (!isValidEcosystem(input.ecosystem)) {
              return {
                jsonrpc: '2.0',
                id,
                result: {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify({
                        ok: false,
                        error: {
                          code: 'INVALID_INPUT',
                          message: `Invalid ecosystem: ${input.ecosystem}. Must be one of: npm, pypi, crates`,
                          details: { provided: input.ecosystem },
                        },
                        meta: { retrieved_at: new Date().toISOString() },
                      }),
                    },
                  ],
                },
              };
            }
            result = await releaseTimeline(input);
            break;
          }

          case 'maintenance_signals': {
            const input: MaintenanceSignalsInput = {
              ecosystem: args?.ecosystem as Ecosystem,
              name: args?.name as string,
            };
            if (!isValidEcosystem(input.ecosystem)) {
              return {
                jsonrpc: '2.0',
                id,
                result: {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify({
                        ok: false,
                        error: {
                          code: 'INVALID_INPUT',
                          message: `Invalid ecosystem: ${input.ecosystem}. Must be one of: npm, pypi, crates`,
                          details: { provided: input.ecosystem },
                        },
                        meta: { retrieved_at: new Date().toISOString() },
                      }),
                    },
                  ],
                },
              };
            }
            result = await maintenanceSignals(input);
            break;
          }

          default:
            return {
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: `Unknown tool: ${toolName}`,
              },
            };
        }

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        };
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: `Internal error: ${message}`,
      },
    };
  }
}

/**
 * Read the request body as a string
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/**
 * Send a JSON response
 */
function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Handle health check endpoint
 */
function handleHealthCheck(res: ServerResponse): void {
  sendJson(res, 200, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'package-intel',
    version: '0.1.0',
  });
}

/**
 * Handle not found
 */
function handleNotFound(res: ServerResponse): void {
  sendJson(res, 404, { error: 'Not found' });
}

/**
 * Handle method not allowed
 */
function handleMethodNotAllowed(res: ServerResponse): void {
  sendJson(res, 405, { error: 'Method not allowed' });
}

/**
 * Handle MCP JSON-RPC endpoint
 */
async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await readBody(req);
    const request: JsonRpcRequest = JSON.parse(body);

    if (!request.jsonrpc || request.jsonrpc !== '2.0') {
      sendJson(res, 400, {
        jsonrpc: '2.0',
        id: request.id || 0,
        error: {
          code: -32600,
          message: 'Invalid Request: missing or invalid jsonrpc version',
        },
      });
      return;
    }

    const response = await handleJsonRpcRequest(request);
    sendJson(res, 200, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    sendJson(res, 500, {
      ok: false,
      error: message,
    });
  }
}

/**
 * Create and configure the HTTP server
 */
export function createHttpServer(): Server {
  const httpServer = createServer();

  httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url!, `http://${req.headers.host || 'localhost'}`);
    const method = req.method?.toUpperCase();

    try {
      switch (url.pathname) {
        case '/mcp':
          if (method === 'POST') {
            await handleMcpRequest(req, res);
          } else {
            handleMethodNotAllowed(res);
          }
          break;

        case '/health':
          if (method === 'GET') {
            handleHealthCheck(res);
          } else {
            handleMethodNotAllowed(res);
          }
          break;

        default:
          handleNotFound(res);
      }
    } catch (error) {
      console.error('Server error:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      sendJson(res, 500, { ok: false, error: message });
    }
  });

  return httpServer;
}

/**
 * Start the HTTP transport
 */
export function startHttpTransport(port: number): Server {
  const isProduction = process.env.NODE_ENV === 'production';
  const host = isProduction ? '0.0.0.0' : 'localhost';
  const httpServer = createHttpServer();

  httpServer.listen(port, host, () => {
    const displayUrl = isProduction ? `Port ${port}` : `http://localhost:${port}`;
    console.error(`Package Intel MCP server listening on ${displayUrl}`);
    console.error(`MCP endpoint: ${isProduction ? '/mcp' : `http://localhost:${port}/mcp`}`);
    console.error(`Health check: ${isProduction ? '/health' : `http://localhost:${port}/health`}`);
  });

  return httpServer;
}

/**
 * Create and start HTTP transport for the MCP server
 * @deprecated Use startHttpTransport instead. This function is kept for backward compatibility.
 */
export async function createHttpTransport(
  _server: unknown,
  port: number
): Promise<void> {
  startHttpTransport(port);
}
