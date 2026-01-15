/**
 * Package Intel MCP Server - Package Summary Tool
 */

import { REGISTRY_URLS, loadConfig } from '../config.js';
import type {
  ApiResponse,
  PackageSummary,
  PackageSummaryInput,
  NpmPackageResponse,
  PypiPackageResponse,
  CratesPackageResponse,
  ErrorCode,
} from '../types.js';

const config = loadConfig();

/**
 * Create an error response
 */
function createErrorResponse(
  code: ErrorCode,
  message: string,
  details: Record<string, unknown> = {}
): ApiResponse<PackageSummary> {
  return {
    ok: false,
    error: { code, message, details },
    meta: { retrieved_at: new Date().toISOString() },
  };
}

/**
 * Fetch data from a registry URL
 */
async function fetchRegistry<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeout);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': config.userAgent,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      (error as Error & { status: number }).status = response.status;
      throw error;
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse repository URL from various formats
 */
function parseRepositoryUrl(
  repo: string | { type: string; url: string } | undefined | null
): string | null {
  if (!repo) return null;

  let url = typeof repo === 'string' ? repo : repo.url;
  if (!url) return null;

  // Clean up git+https:// or git:// prefixes
  url = url.replace(/^git\+/, '').replace(/^git:\/\//, 'https://');
  // Remove .git suffix
  url = url.replace(/\.git$/, '');
  // Handle git@github.com: format
  if (url.startsWith('git@')) {
    url = url.replace('git@', 'https://').replace(':', '/');
  }

  return url;
}

/**
 * Fetch and parse npm package summary
 */
async function fetchNpmSummary(name: string): Promise<ApiResponse<PackageSummary>> {
  const url = `${REGISTRY_URLS.npm}/${encodeURIComponent(name)}`;

  try {
    const data = await fetchRegistry<NpmPackageResponse>(url);
    const latestVersion = data['dist-tags']?.latest;
    const versionData = latestVersion ? data.versions[latestVersion] : null;

    return {
      ok: true,
      data: {
        name: data.name,
        version: latestVersion || 'unknown',
        description: data.description || versionData?.description || null,
        homepage: data.homepage || versionData?.homepage || null,
        repository: parseRepositoryUrl(data.repository || versionData?.repository),
        license:
          typeof data.license === 'string'
            ? data.license
            : typeof versionData?.license === 'string'
              ? versionData.license
              : (versionData?.license as { type: string } | undefined)?.type || null,
        keywords: data.keywords || versionData?.keywords || [],
      },
      meta: {
        source: url,
        retrieved_at: new Date().toISOString(),
        pagination: { next_cursor: null },
        warnings: [],
      },
    };
  } catch (error) {
    const err = error as Error & { status?: number };

    if (err.name === 'AbortError') {
      return createErrorResponse('TIMEOUT', `Request to npm registry timed out`, {
        package: name,
      });
    }

    if (err.status === 404) {
      return createErrorResponse('INVALID_INPUT', `Package '${name}' not found on npm`, {
        package: name,
        ecosystem: 'npm',
      });
    }

    if (err.status === 429) {
      return createErrorResponse('RATE_LIMITED', 'npm registry rate limit exceeded', {
        package: name,
      });
    }

    return createErrorResponse('UPSTREAM_ERROR', `Failed to fetch from npm: ${err.message}`, {
      package: name,
      originalError: err.message,
    });
  }
}

/**
 * Fetch and parse PyPI package summary
 */
async function fetchPypiSummary(name: string): Promise<ApiResponse<PackageSummary>> {
  const url = `${REGISTRY_URLS.pypi}/${encodeURIComponent(name)}/json`;

  try {
    const data = await fetchRegistry<PypiPackageResponse>(url);
    const info = data.info;

    // Try to find repository URL from project_urls
    let repository: string | null = null;
    if (info.project_urls) {
      repository =
        info.project_urls.Repository ||
        info.project_urls.Source ||
        info.project_urls.GitHub ||
        info.project_urls['Source Code'] ||
        null;
    }

    // Parse keywords (comma-separated string in PyPI)
    const keywords = info.keywords
      ? info.keywords.split(/[,\s]+/).filter((k) => k.length > 0)
      : [];

    return {
      ok: true,
      data: {
        name: info.name,
        version: info.version,
        description: info.summary,
        homepage: info.home_page || info.project_url,
        repository,
        license: info.license,
        keywords,
      },
      meta: {
        source: url,
        retrieved_at: new Date().toISOString(),
        pagination: { next_cursor: null },
        warnings: [],
      },
    };
  } catch (error) {
    const err = error as Error & { status?: number };

    if (err.name === 'AbortError') {
      return createErrorResponse('TIMEOUT', `Request to PyPI registry timed out`, {
        package: name,
      });
    }

    if (err.status === 404) {
      return createErrorResponse('INVALID_INPUT', `Package '${name}' not found on PyPI`, {
        package: name,
        ecosystem: 'pypi',
      });
    }

    if (err.status === 429) {
      return createErrorResponse('RATE_LIMITED', 'PyPI rate limit exceeded', {
        package: name,
      });
    }

    return createErrorResponse('UPSTREAM_ERROR', `Failed to fetch from PyPI: ${err.message}`, {
      package: name,
      originalError: err.message,
    });
  }
}

/**
 * Fetch and parse crates.io package summary
 */
async function fetchCratesSummary(name: string): Promise<ApiResponse<PackageSummary>> {
  const url = `${REGISTRY_URLS.crates}/${encodeURIComponent(name)}`;

  try {
    const data = await fetchRegistry<CratesPackageResponse>(url);
    const crate = data.crate;
    const latestVersion = data.versions.find((v) => v.num === crate.max_version);

    return {
      ok: true,
      data: {
        name: crate.name,
        version: crate.max_stable_version || crate.max_version,
        description: crate.description,
        homepage: crate.homepage,
        repository: crate.repository,
        license: latestVersion?.license || null,
        keywords: crate.keywords || [],
        downloads: {
          total: crate.downloads,
          weekly: crate.recent_downloads || undefined,
        },
      },
      meta: {
        source: url,
        retrieved_at: new Date().toISOString(),
        pagination: { next_cursor: null },
        warnings: [],
      },
    };
  } catch (error) {
    const err = error as Error & { status?: number };

    if (err.name === 'AbortError') {
      return createErrorResponse('TIMEOUT', `Request to crates.io timed out`, {
        package: name,
      });
    }

    if (err.status === 404) {
      return createErrorResponse('INVALID_INPUT', `Crate '${name}' not found on crates.io`, {
        package: name,
        ecosystem: 'crates',
      });
    }

    if (err.status === 429) {
      return createErrorResponse('RATE_LIMITED', 'crates.io rate limit exceeded', {
        package: name,
      });
    }

    return createErrorResponse('UPSTREAM_ERROR', `Failed to fetch from crates.io: ${err.message}`, {
      package: name,
      originalError: err.message,
    });
  }
}

/**
 * Get package summary for any supported ecosystem
 */
export async function packageSummary(
  input: PackageSummaryInput
): Promise<ApiResponse<PackageSummary>> {
  const { ecosystem, name } = input;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return createErrorResponse('INVALID_INPUT', 'Package name is required', {
      provided: name,
    });
  }

  const trimmedName = name.trim();

  switch (ecosystem) {
    case 'npm':
      return fetchNpmSummary(trimmedName);
    case 'pypi':
      return fetchPypiSummary(trimmedName);
    case 'crates':
      return fetchCratesSummary(trimmedName);
    default:
      return createErrorResponse(
        'INVALID_INPUT',
        `Unsupported ecosystem: ${ecosystem}. Supported: npm, pypi, crates`,
        { provided: ecosystem }
      );
  }
}
