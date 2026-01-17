#!/usr/bin/env node
/**
 * Package Intel MCP Server - CLI Entry Point
 * HTTP-only transport for Dedalus deployment
 */

import { startHttpTransport } from './transport/index.js';
import { loadConfig } from './config.js';

/**
 * Parse command line arguments
 */
function parseArgs(): { port?: number } {
  const args = process.argv.slice(2);
  const options: { port?: number } = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--port':
        if (i + 1 < args.length) {
          options.port = parseInt(args[i + 1], 10);
          i++;
        }
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
    }
  }
  return options;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Package Intel MCP Server

USAGE:
    package-intel [OPTIONS]

OPTIONS:
    --port <PORT>    Run HTTP server on specified port (default: 8080)
    --help           Print this help message

ENVIRONMENT VARIABLES:
    PORT             HTTP server port (default: 8080)
    NODE_ENV         Set to 'production' for production mode
`);
}

async function main(): Promise<void> {
  const cliOptions = parseArgs();
  const config = loadConfig();
  const port = cliOptions.port || config.port;

  // Handle shutdown
  process.on('SIGINT', () => {
    console.error('\nShutting down Package Intel MCP server...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.error('\nShutting down Package Intel MCP server...');
    process.exit(0);
  });

  try {
    // HTTP transport only
    startHttpTransport(port);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
