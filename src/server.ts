/**
 * Package Intel MCP Server - Server Setup
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { packageSummary, releaseTimeline, maintenanceSignals } from './tools/index.js';
import type {
  PackageSummaryInput,
  ReleaseTimelineInput,
  MaintenanceSignalsInput,
  Ecosystem,
} from './types.js';

/**
 * Create and configure the MCP server
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'package-intel',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
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
      ],
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'package_summary': {
          const input = args as unknown as PackageSummaryInput;
          if (!isValidEcosystem(input.ecosystem)) {
            return {
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
            };
          }
          const result = await packageSummary(input);
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        }

        case 'release_timeline': {
          const input = args as unknown as ReleaseTimelineInput;
          if (!isValidEcosystem(input.ecosystem)) {
            return {
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
            };
          }
          const result = await releaseTimeline(input);
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        }

        case 'maintenance_signals': {
          const input = args as unknown as MaintenanceSignalsInput;
          if (!isValidEcosystem(input.ecosystem)) {
            return {
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
            };
          }
          const result = await maintenanceSignals(input);
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  ok: false,
                  error: {
                    code: 'INVALID_INPUT',
                    message: `Unknown tool: ${name}`,
                    details: { provided: name },
                  },
                  meta: { retrieved_at: new Date().toISOString() },
                }),
              },
            ],
          };
      }
    } catch (error) {
      const err = error as Error;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: `Tool execution failed: ${err.message}`,
                details: { tool: name },
              },
              meta: { retrieved_at: new Date().toISOString() },
            }),
          },
        ],
      };
    }
  });

  return server;
}

/**
 * Validate ecosystem value
 */
function isValidEcosystem(value: unknown): value is Ecosystem {
  return value === 'npm' || value === 'pypi' || value === 'crates';
}
