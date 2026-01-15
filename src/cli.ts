#!/usr/bin/env node
/**
 * Package Intel MCP Server - CLI Entry Point
 */

import { createServer } from './server.js';
import { createStdioTransport, createHttpTransport } from './transport/index.js';
import { loadConfig } from './config.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const useHttp = args.includes('--http') || args.includes('-h');
  const config = loadConfig();

  const server = createServer();

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.error('\nShutting down Package Intel MCP server...');
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('\nShutting down Package Intel MCP server...');
    await server.close();
    process.exit(0);
  });

  try {
    if (useHttp) {
      await createHttpTransport(server, config.port);
    } else {
      console.error('Package Intel MCP server starting in stdio mode...');
      await createStdioTransport(server);
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
