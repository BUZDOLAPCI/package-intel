/**
 * Package Intel MCP Server - Unit Tests for Tools
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { packageSummary, releaseTimeline, maintenanceSignals } from '../../src/tools/index.js';

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

// Sample mock data for npm
const mockNpmPackage = {
  name: 'lodash',
  'dist-tags': { latest: '4.17.21' },
  versions: {
    '4.17.21': {
      name: 'lodash',
      version: '4.17.21',
      description: 'Lodash modular utilities.',
      homepage: 'https://lodash.com/',
      repository: { type: 'git', url: 'git+https://github.com/lodash/lodash.git' },
      license: 'MIT',
      keywords: ['modules', 'stdlib', 'util'],
    },
    '4.17.20': {
      name: 'lodash',
      version: '4.17.20',
    },
  },
  time: {
    created: '2012-04-23T17:17:21.587Z',
    modified: '2023-01-15T10:00:00.000Z',
    '4.17.20': '2020-08-12T20:00:00.000Z',
    '4.17.21': '2021-02-20T15:42:04.000Z',
  },
  description: 'Lodash modular utilities.',
  homepage: 'https://lodash.com/',
  repository: { type: 'git', url: 'git+https://github.com/lodash/lodash.git' },
  license: 'MIT',
  keywords: ['modules', 'stdlib', 'util'],
};

// Sample mock data for PyPI
const mockPypiPackage = {
  info: {
    name: 'requests',
    version: '2.31.0',
    summary: 'Python HTTP for Humans.',
    home_page: 'https://requests.readthedocs.io',
    project_url: null,
    project_urls: {
      Repository: 'https://github.com/psf/requests',
      Documentation: 'https://requests.readthedocs.io',
    },
    license: 'Apache 2.0',
    keywords: 'http client python',
    classifiers: [
      'Development Status :: 5 - Production/Stable',
      'License :: OSI Approved :: Apache Software License',
    ],
  },
  releases: {
    '2.30.0': [{ upload_time: '2023-05-01T10:00:00', upload_time_iso_8601: '2023-05-01T10:00:00.000Z' }],
    '2.31.0': [{ upload_time: '2023-05-22T10:00:00', upload_time_iso_8601: '2023-05-22T10:00:00.000Z' }],
  },
  urls: [],
};

// Sample mock data for crates.io
const mockCratesPackage = {
  crate: {
    id: 'serde',
    name: 'serde',
    description: 'A generic serialization/deserialization framework',
    homepage: 'https://serde.rs',
    repository: 'https://github.com/serde-rs/serde',
    max_version: '1.0.188',
    max_stable_version: '1.0.188',
    downloads: 200000000,
    recent_downloads: 10000000,
    keywords: ['serde', 'serialization'],
    categories: [],
  },
  versions: [
    {
      id: 1,
      crate: 'serde',
      num: '1.0.188',
      created_at: '2023-08-15T10:00:00.000Z',
      updated_at: '2023-08-15T10:00:00.000Z',
      yanked: false,
      license: 'MIT OR Apache-2.0',
    },
    {
      id: 2,
      crate: 'serde',
      num: '1.0.187',
      created_at: '2023-07-20T10:00:00.000Z',
      updated_at: '2023-07-20T10:00:00.000Z',
      yanked: false,
      license: 'MIT OR Apache-2.0',
    },
    {
      id: 3,
      crate: 'serde',
      num: '1.0.186-alpha',
      created_at: '2023-07-15T10:00:00.000Z',
      updated_at: '2023-07-15T10:00:00.000Z',
      yanked: false,
      license: 'MIT OR Apache-2.0',
    },
  ],
};

describe('package_summary', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('npm', () => {
    it('should return package summary for npm package', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockNpmPackage));

      const result = await packageSummary({ ecosystem: 'npm', name: 'lodash' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe('lodash');
        expect(result.data.version).toBe('4.17.21');
        expect(result.data.description).toBe('Lodash modular utilities.');
        expect(result.data.license).toBe('MIT');
        expect(result.data.keywords).toEqual(['modules', 'stdlib', 'util']);
        expect(result.data.repository).toBe('https://github.com/lodash/lodash');
        expect(result.meta.source).toContain('registry.npmjs.org');
      }
    });

    it('should handle npm 404 error', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}, 404));

      const result = await packageSummary({ ecosystem: 'npm', name: 'nonexistent-package-xyz' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toContain('not found');
      }
    });
  });

  describe('pypi', () => {
    it('should return package summary for PyPI package', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockPypiPackage));

      const result = await packageSummary({ ecosystem: 'pypi', name: 'requests' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe('requests');
        expect(result.data.version).toBe('2.31.0');
        expect(result.data.description).toBe('Python HTTP for Humans.');
        expect(result.data.license).toBe('Apache 2.0');
        expect(result.data.repository).toBe('https://github.com/psf/requests');
        expect(result.meta.source).toContain('pypi.org');
      }
    });

    it('should handle PyPI 404 error', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}, 404));

      const result = await packageSummary({ ecosystem: 'pypi', name: 'nonexistent-package-xyz' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toContain('not found');
      }
    });
  });

  describe('crates', () => {
    it('should return package summary for crates.io package', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockCratesPackage));

      const result = await packageSummary({ ecosystem: 'crates', name: 'serde' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe('serde');
        expect(result.data.version).toBe('1.0.188');
        expect(result.data.description).toBe('A generic serialization/deserialization framework');
        expect(result.data.license).toBe('MIT OR Apache-2.0');
        expect(result.data.downloads?.total).toBe(200000000);
        expect(result.meta.source).toContain('crates.io');
      }
    });

    it('should handle crates.io 404 error', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}, 404));

      const result = await packageSummary({ ecosystem: 'crates', name: 'nonexistent-crate-xyz' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toContain('not found');
      }
    });
  });

  describe('validation', () => {
    it('should handle invalid ecosystem', async () => {
      const result = await packageSummary({ ecosystem: 'invalid' as 'npm', name: 'test' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toContain('Unsupported ecosystem');
      }
    });

    it('should handle empty package name', async () => {
      const result = await packageSummary({ ecosystem: 'npm', name: '' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toContain('Package name is required');
      }
    });
  });
});

describe('release_timeline', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('npm', () => {
    it('should return release timeline for npm package', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockNpmPackage));

      const result = await releaseTimeline({ ecosystem: 'npm', name: 'lodash' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.package_name).toBe('lodash');
        expect(result.data.ecosystem).toBe('npm');
        expect(result.data.releases.length).toBeGreaterThan(0);
        expect(result.data.releases[0].version).toBeDefined();
        expect(result.data.releases[0].date).toBeDefined();
        expect(typeof result.data.releases[0].is_prerelease).toBe('boolean');
      }
    });

    it('should respect limit parameter', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockNpmPackage));

      const result = await releaseTimeline({ ecosystem: 'npm', name: 'lodash', limit: 1 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.releases.length).toBe(1);
      }
    });
  });

  describe('pypi', () => {
    it('should return release timeline for PyPI package', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockPypiPackage));

      const result = await releaseTimeline({ ecosystem: 'pypi', name: 'requests' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.package_name).toBe('requests');
        expect(result.data.ecosystem).toBe('pypi');
        expect(result.data.releases.length).toBeGreaterThan(0);
      }
    });
  });

  describe('crates', () => {
    it('should return release timeline for crates.io package', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockCratesPackage));

      const result = await releaseTimeline({ ecosystem: 'crates', name: 'serde' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.package_name).toBe('serde');
        expect(result.data.ecosystem).toBe('crates');
        expect(result.data.releases.length).toBeGreaterThan(0);
      }
    });

    it('should detect prerelease versions', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockCratesPackage));

      const result = await releaseTimeline({ ecosystem: 'crates', name: 'serde' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const alphaVersion = result.data.releases.find((r) => r.version === '1.0.186-alpha');
        expect(alphaVersion?.is_prerelease).toBe(true);

        const stableVersion = result.data.releases.find((r) => r.version === '1.0.188');
        expect(stableVersion?.is_prerelease).toBe(false);
      }
    });
  });

  describe('validation', () => {
    it('should handle invalid ecosystem', async () => {
      const result = await releaseTimeline({ ecosystem: 'invalid' as 'npm', name: 'test' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('should handle empty package name', async () => {
      const result = await releaseTimeline({ ecosystem: 'npm', name: '' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });
  });
});

describe('maintenance_signals', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('npm', () => {
    it('should return maintenance signals for npm package', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockNpmPackage));

      const result = await maintenanceSignals({ ecosystem: 'npm', name: 'lodash' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.package_name).toBe('lodash');
        expect(result.data.ecosystem).toBe('npm');
        expect(typeof result.data.days_since_last_release).toBe('number');
        expect(typeof result.data.releases_per_year).toBe('number');
        expect(typeof result.data.total_versions).toBe('number');
        expect(typeof result.data.is_deprecated).toBe('boolean');
        expect(['good', 'fair', 'poor']).toContain(result.data.maintenance_score);
        expect(result.data.score_factors).toBeDefined();
      }
    });

    it('should detect deprecated npm packages', async () => {
      const deprecatedPackage = {
        ...mockNpmPackage,
        versions: {
          '4.17.21': {
            ...mockNpmPackage.versions['4.17.21'],
            deprecated: 'This package is deprecated',
          },
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse(deprecatedPackage));

      const result = await maintenanceSignals({ ecosystem: 'npm', name: 'lodash' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.is_deprecated).toBe(true);
        expect(result.data.deprecation_message).toBe('This package is deprecated');
        expect(result.data.maintenance_score).toBe('poor');
      }
    });
  });

  describe('pypi', () => {
    it('should return maintenance signals for PyPI package', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockPypiPackage));

      const result = await maintenanceSignals({ ecosystem: 'pypi', name: 'requests' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.package_name).toBe('requests');
        expect(result.data.ecosystem).toBe('pypi');
        expect(typeof result.data.days_since_last_release).toBe('number');
        expect(typeof result.data.releases_per_year).toBe('number');
      }
    });

    it('should detect inactive PyPI packages via classifiers', async () => {
      const inactivePackage = {
        ...mockPypiPackage,
        info: {
          ...mockPypiPackage.info,
          classifiers: ['Development Status :: 7 - Inactive'],
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse(inactivePackage));

      const result = await maintenanceSignals({ ecosystem: 'pypi', name: 'requests' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.is_deprecated).toBe(true);
        expect(result.data.maintenance_score).toBe('poor');
      }
    });
  });

  describe('crates', () => {
    it('should return maintenance signals for crates.io package', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockCratesPackage));

      const result = await maintenanceSignals({ ecosystem: 'crates', name: 'serde' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.package_name).toBe('serde');
        expect(result.data.ecosystem).toBe('crates');
        expect(typeof result.data.days_since_last_release).toBe('number');
        expect(typeof result.data.releases_per_year).toBe('number');
      }
    });

    it('should detect yanked crates as deprecated', async () => {
      const yankedCrate = {
        ...mockCratesPackage,
        versions: mockCratesPackage.versions.map((v) => ({ ...v, yanked: true })),
      };
      mockFetch.mockResolvedValueOnce(mockResponse(yankedCrate));

      const result = await maintenanceSignals({ ecosystem: 'crates', name: 'serde' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.is_deprecated).toBe(true);
      }
    });
  });

  describe('score calculation', () => {
    it('should calculate good score for active packages', async () => {
      // Package with recent release (within 90 days) and good frequency
      const activePackage = {
        ...mockNpmPackage,
        time: {
          created: '2020-01-01T00:00:00.000Z',
          modified: new Date().toISOString(),
          '1.0.0': '2020-01-01T00:00:00.000Z',
          '1.1.0': '2020-06-01T00:00:00.000Z',
          '1.2.0': '2021-01-01T00:00:00.000Z',
          '1.3.0': '2021-06-01T00:00:00.000Z',
          '1.4.0': '2022-01-01T00:00:00.000Z',
          '1.5.0': '2022-06-01T00:00:00.000Z',
          '1.6.0': '2023-01-01T00:00:00.000Z',
          '1.7.0': '2023-06-01T00:00:00.000Z',
          '1.8.0': '2024-01-01T00:00:00.000Z',
          '1.9.0': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse(activePackage));

      const result = await maintenanceSignals({ ecosystem: 'npm', name: 'lodash' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.maintenance_score).toBe('good');
        expect(result.data.score_factors.recency).toBe('good');
      }
    });

    it('should calculate poor score for stale packages', async () => {
      // Package with no releases in over a year
      const stalePackage = {
        ...mockNpmPackage,
        time: {
          created: '2020-01-01T00:00:00.000Z',
          modified: '2021-01-01T00:00:00.000Z',
          '1.0.0': '2020-01-01T00:00:00.000Z',
          '1.0.1': '2020-06-01T00:00:00.000Z',
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse(stalePackage));

      const result = await maintenanceSignals({ ecosystem: 'npm', name: 'lodash' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.score_factors.recency).toBe('poor');
      }
    });
  });

  describe('validation', () => {
    it('should handle invalid ecosystem', async () => {
      const result = await maintenanceSignals({ ecosystem: 'invalid' as 'npm', name: 'test' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('should handle empty package name', async () => {
      const result = await maintenanceSignals({ ecosystem: 'npm', name: '' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });
  });
});

describe('error handling', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle rate limiting (429)', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}, 429));

    const result = await packageSummary({ ecosystem: 'npm', name: 'lodash' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RATE_LIMITED');
    }
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await packageSummary({ ecosystem: 'npm', name: 'lodash' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UPSTREAM_ERROR');
    }
  });
});
