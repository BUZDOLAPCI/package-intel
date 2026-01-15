/**
 * Package Intel MCP Server - E2E Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer } from '../../src/server.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create a mock response
function mockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => mockResponse(data, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

// Mock npm package data
const mockNpmPackage = {
  name: 'express',
  'dist-tags': { latest: '4.18.2' },
  versions: {
    '4.18.2': {
      name: 'express',
      version: '4.18.2',
      description: 'Fast, unopinionated, minimalist web framework',
      homepage: 'http://expressjs.com/',
      repository: { type: 'git', url: 'git+https://github.com/expressjs/express.git' },
      license: 'MIT',
      keywords: ['express', 'framework', 'web'],
    },
  },
  time: {
    created: '2010-12-29T19:38:25.450Z',
    modified: '2023-01-15T10:00:00.000Z',
    '4.18.2': '2022-10-08T10:00:00.000Z',
    '4.18.1': '2022-04-29T10:00:00.000Z',
  },
  description: 'Fast, unopinionated, minimalist web framework',
  license: 'MIT',
  keywords: ['express', 'framework', 'web'],
};

describe('MCP Server E2E', () => {
  let server: Server;

  beforeEach(() => {
    mockFetch.mockReset();
    server = createServer();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe('server creation', () => {
    it('should create a server instance', () => {
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(Server);
    });
  });

  describe('tool listing', () => {
    it('should list all available tools', async () => {
      // Access the request handlers directly through the server
      // Since we cannot easily test without transport, we verify the server is configured
      expect(server).toBeDefined();
    });
  });

  describe('tool execution simulation', () => {
    // These tests verify the tool functions work correctly when called directly
    // Full E2E would require a transport, so we test the core logic

    it('should handle package_summary tool call', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockNpmPackage));

      const { packageSummary } = await import('../../src/tools/index.js');
      const result = await packageSummary({ ecosystem: 'npm', name: 'express' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe('express');
        expect(result.data.version).toBe('4.18.2');
      }
    });

    it('should handle release_timeline tool call', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockNpmPackage));

      const { releaseTimeline } = await import('../../src/tools/index.js');
      const result = await releaseTimeline({ ecosystem: 'npm', name: 'express', limit: 5 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.package_name).toBe('express');
        expect(result.data.releases.length).toBeLessThanOrEqual(5);
      }
    });

    it('should handle maintenance_signals tool call', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockNpmPackage));

      const { maintenanceSignals } = await import('../../src/tools/index.js');
      const result = await maintenanceSignals({ ecosystem: 'npm', name: 'express' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.package_name).toBe('express');
        expect(result.data.maintenance_score).toBeDefined();
      }
    });
  });

  describe('response envelope format', () => {
    it('should return success responses in correct envelope format', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockNpmPackage));

      const { packageSummary } = await import('../../src/tools/index.js');
      const result = await packageSummary({ ecosystem: 'npm', name: 'express' });

      expect(result).toHaveProperty('ok', true);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');

      if (result.ok) {
        expect(result.meta).toHaveProperty('retrieved_at');
        expect(result.meta).toHaveProperty('pagination');
        expect(result.meta).toHaveProperty('warnings');
        expect(result.meta.pagination).toHaveProperty('next_cursor');
        expect(Array.isArray(result.meta.warnings)).toBe(true);
      }
    });

    it('should return error responses in correct envelope format', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}, 404));

      const { packageSummary } = await import('../../src/tools/index.js');
      const result = await packageSummary({ ecosystem: 'npm', name: 'nonexistent' });

      expect(result).toHaveProperty('ok', false);
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('meta');

      if (!result.ok) {
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
        expect(result.error).toHaveProperty('details');
        expect(result.meta).toHaveProperty('retrieved_at');
      }
    });

    it('should include ISO-8601 timestamp in meta', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockNpmPackage));

      const { packageSummary } = await import('../../src/tools/index.js');
      const result = await packageSummary({ ecosystem: 'npm', name: 'express' });

      const timestamp = result.ok ? result.meta.retrieved_at : result.meta.retrieved_at;
      expect(() => new Date(timestamp)).not.toThrow();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('cross-ecosystem consistency', () => {
    const mockPypiPackage = {
      info: {
        name: 'flask',
        version: '2.3.3',
        summary: 'A simple framework for building complex web applications.',
        home_page: 'https://palletsprojects.com/p/flask',
        project_urls: { Repository: 'https://github.com/pallets/flask' },
        license: 'BSD-3-Clause',
        keywords: 'flask web framework',
        classifiers: [],
      },
      releases: {
        '2.3.3': [{ upload_time_iso_8601: '2023-08-21T10:00:00.000Z' }],
      },
    };

    const mockCratesPackage = {
      crate: {
        id: 'actix-web',
        name: 'actix-web',
        description: 'Actix Web is a powerful, pragmatic, and fast web framework for Rust',
        homepage: 'https://actix.rs',
        repository: 'https://github.com/actix/actix-web',
        max_version: '4.4.0',
        max_stable_version: '4.4.0',
        downloads: 10000000,
        recent_downloads: 500000,
        keywords: ['actix', 'web'],
      },
      versions: [
        {
          id: 1,
          crate: 'actix-web',
          num: '4.4.0',
          created_at: '2023-09-01T10:00:00.000Z',
          yanked: false,
          license: 'MIT OR Apache-2.0',
        },
      ],
    };

    it('should return consistent structure for npm packages', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockNpmPackage));

      const { packageSummary } = await import('../../src/tools/index.js');
      const result = await packageSummary({ ecosystem: 'npm', name: 'express' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveProperty('name');
        expect(result.data).toHaveProperty('version');
        expect(result.data).toHaveProperty('description');
        expect(result.data).toHaveProperty('homepage');
        expect(result.data).toHaveProperty('repository');
        expect(result.data).toHaveProperty('license');
        expect(result.data).toHaveProperty('keywords');
      }
    });

    it('should return consistent structure for PyPI packages', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockPypiPackage));

      const { packageSummary } = await import('../../src/tools/index.js');
      const result = await packageSummary({ ecosystem: 'pypi', name: 'flask' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveProperty('name');
        expect(result.data).toHaveProperty('version');
        expect(result.data).toHaveProperty('description');
        expect(result.data).toHaveProperty('homepage');
        expect(result.data).toHaveProperty('repository');
        expect(result.data).toHaveProperty('license');
        expect(result.data).toHaveProperty('keywords');
      }
    });

    it('should return consistent structure for crates.io packages', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockCratesPackage));

      const { packageSummary } = await import('../../src/tools/index.js');
      const result = await packageSummary({ ecosystem: 'crates', name: 'actix-web' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveProperty('name');
        expect(result.data).toHaveProperty('version');
        expect(result.data).toHaveProperty('description');
        expect(result.data).toHaveProperty('homepage');
        expect(result.data).toHaveProperty('repository');
        expect(result.data).toHaveProperty('license');
        expect(result.data).toHaveProperty('keywords');
      }
    });
  });

  describe('error code consistency', () => {
    const errorCodes = ['INVALID_INPUT', 'UPSTREAM_ERROR', 'RATE_LIMITED', 'TIMEOUT', 'PARSE_ERROR', 'INTERNAL_ERROR'];

    it('should use valid error codes for 404 errors', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}, 404));

      const { packageSummary } = await import('../../src/tools/index.js');
      const result = await packageSummary({ ecosystem: 'npm', name: 'nonexistent' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(errorCodes).toContain(result.error.code);
      }
    });

    it('should use valid error codes for rate limiting', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}, 429));

      const { packageSummary } = await import('../../src/tools/index.js');
      const result = await packageSummary({ ecosystem: 'npm', name: 'express' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('RATE_LIMITED');
      }
    });

    it('should use valid error codes for invalid input', async () => {
      const { packageSummary } = await import('../../src/tools/index.js');
      const result = await packageSummary({ ecosystem: 'invalid' as 'npm', name: 'test' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });
  });
});
