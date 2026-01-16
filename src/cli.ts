#!/usr/bin/env node
/**
 * Package Intel MCP Server - CLI Entry Point
 */

import { createServer } from './server.js';
import { createStdioTransport, createHttpTransport } from './transport/index.js';
import { loadConfig } from './config.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const useStdio = args.includes('--stdio');
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
    if (useStdio) {
      console.error('Package Intel MCP server starting in stdio mode...');
      await createStdioTransport(server);
    } else {
      // Default to HTTP transport on port 8080
      await createHttpTransport(server, config.port);
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
