/**
 * Package Intel MCP Server - Main Entry Point
 */

// Export server factory
export { createServer, createStandaloneServer } from './server.js';

// Export transport factories
export { createStdioTransport, createHttpTransport } from './transport/index.js';

// Export tools for direct usage
export { packageSummary, releaseTimeline, maintenanceSignals } from './tools/index.js';

// Export types
export type {
  Ecosystem,
  ApiResponse,
  SuccessResponse,
  ErrorResponse,
  ErrorCode,
  ResponseMeta,
  PackageSummary,
  PackageSummaryInput,
  ReleaseTimeline,
  ReleaseTimelineInput,
  ReleaseEntry,
  MaintenanceSignals,
  MaintenanceSignalsInput,
  MaintenanceRating,
  ServerConfig,
} from './types.js';

// Export config utilities
export { loadConfig, REGISTRY_URLS, DEFAULTS } from './config.js';
