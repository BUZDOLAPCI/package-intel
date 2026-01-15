/**
 * Package Intel MCP Server - Configuration
 */

import type { ServerConfig } from './types.js';

/**
 * Load configuration from environment variables with defaults
 */
export function loadConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
    userAgent: process.env.USER_AGENT || 'package-intel/0.1.0',
    cacheTtl: parseInt(process.env.CACHE_TTL || '300', 10),
    logLevel: (process.env.LOG_LEVEL as ServerConfig['logLevel']) || 'info',
  };
}

/**
 * Registry base URLs
 */
export const REGISTRY_URLS = {
  npm: 'https://registry.npmjs.org',
  pypi: 'https://pypi.org/pypi',
  crates: 'https://crates.io/api/v1/crates',
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
  releaseTimelineLimit: 20,
  maxReleaseTimelineLimit: 100,
} as const;
