/**
 * Package Intel MCP Server - Release Timeline Tool
 */

import { REGISTRY_URLS, DEFAULTS, loadConfig } from '../config.js';
import type {
  ApiResponse,
  ReleaseTimeline,
  ReleaseTimelineInput,
  ReleaseEntry,
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
): ApiResponse<ReleaseTimeline> {
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
 * Check if a version is a prerelease
 */
function isPrerelease(version: string): boolean {
  // Common prerelease patterns: alpha, beta, rc, dev, pre, canary, next, etc.
  const prereleasePattern = /[-.]?(alpha|beta|rc|dev|pre|canary|next|snapshot|preview|nightly|a|b)\d*[-.]?/i;
  return prereleasePattern.test(version);
}

/**
 * Fetch and parse npm release timeline
 */
async function fetchNpmTimeline(
  name: string,
  limit: number
): Promise<ApiResponse<ReleaseTimeline>> {
  const url = `${REGISTRY_URLS.npm}/${encodeURIComponent(name)}`;

  try {
    const data = await fetchRegistry<NpmPackageResponse>(url);

    // Build releases from time field
    const releases: ReleaseEntry[] = [];
    for (const [version, dateStr] of Object.entries(data.time)) {
      // Skip 'created' and 'modified' meta keys
      if (version === 'created' || version === 'modified') continue;

      releases.push({
        version,
        date: dateStr,
        is_prerelease: isPrerelease(version),
      });
    }

    // Sort by date descending
    releases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalVersions = releases.length;
    const limitedReleases = releases.slice(0, limit);

    return {
      ok: true,
      data: {
        package_name: data.name,
        ecosystem: 'npm',
        releases: limitedReleases,
        total_versions: totalVersions,
      },
      meta: {
        source: url,
        retrieved_at: new Date().toISOString(),
        pagination: {
          next_cursor: releases.length > limit ? String(limit) : null,
        },
        warnings: [],
      },
    };
  } catch (error) {
    const err = error as Error & { status?: number };

    if (err.name === 'AbortError') {
      return createErrorResponse('TIMEOUT', 'Request to npm registry timed out', {
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
 * Fetch and parse PyPI release timeline
 */
async function fetchPypiTimeline(
  name: string,
  limit: number
): Promise<ApiResponse<ReleaseTimeline>> {
  const url = `${REGISTRY_URLS.pypi}/${encodeURIComponent(name)}/json`;

  try {
    const data = await fetchRegistry<PypiPackageResponse>(url);

    // Build releases from releases field
    const releases: ReleaseEntry[] = [];
    for (const [version, files] of Object.entries(data.releases)) {
      if (!files || files.length === 0) continue;

      // Use the earliest upload time for the version
      const dates = files
        .map((f) => f.upload_time_iso_8601 || f.upload_time)
        .filter(Boolean)
        .sort();

      if (dates.length > 0) {
        releases.push({
          version,
          date: dates[0],
          is_prerelease: isPrerelease(version),
        });
      }
    }

    // Sort by date descending
    releases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalVersions = releases.length;
    const limitedReleases = releases.slice(0, limit);

    return {
      ok: true,
      data: {
        package_name: data.info.name,
        ecosystem: 'pypi',
        releases: limitedReleases,
        total_versions: totalVersions,
      },
      meta: {
        source: url,
        retrieved_at: new Date().toISOString(),
        pagination: {
          next_cursor: releases.length > limit ? String(limit) : null,
        },
        warnings: [],
      },
    };
  } catch (error) {
    const err = error as Error & { status?: number };

    if (err.name === 'AbortError') {
      return createErrorResponse('TIMEOUT', 'Request to PyPI registry timed out', {
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
 * Fetch and parse crates.io release timeline
 */
async function fetchCratesTimeline(
  name: string,
  limit: number
): Promise<ApiResponse<ReleaseTimeline>> {
  const url = `${REGISTRY_URLS.crates}/${encodeURIComponent(name)}`;

  try {
    const data = await fetchRegistry<CratesPackageResponse>(url);

    // Build releases from versions array
    const releases: ReleaseEntry[] = data.versions
      .filter((v) => !v.yanked) // Exclude yanked versions by default
      .map((v) => ({
        version: v.num,
        date: v.created_at,
        is_prerelease: isPrerelease(v.num),
      }));

    // Sort by date descending
    releases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalVersions = releases.length;
    const limitedReleases = releases.slice(0, limit);

    return {
      ok: true,
      data: {
        package_name: data.crate.name,
        ecosystem: 'crates',
        releases: limitedReleases,
        total_versions: totalVersions,
      },
      meta: {
        source: url,
        retrieved_at: new Date().toISOString(),
        pagination: {
          next_cursor: releases.length > limit ? String(limit) : null,
        },
        warnings: [],
      },
    };
  } catch (error) {
    const err = error as Error & { status?: number };

    if (err.name === 'AbortError') {
      return createErrorResponse('TIMEOUT', 'Request to crates.io timed out', {
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
 * Get release timeline for any supported ecosystem
 */
export async function releaseTimeline(
  input: ReleaseTimelineInput
): Promise<ApiResponse<ReleaseTimeline>> {
  const { ecosystem, name, limit: rawLimit } = input;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return createErrorResponse('INVALID_INPUT', 'Package name is required', {
      provided: name,
    });
  }

  // Validate and apply limit
  let limit = rawLimit ?? DEFAULTS.releaseTimelineLimit;
  if (typeof limit !== 'number' || limit < 1) {
    limit = DEFAULTS.releaseTimelineLimit;
  }
  if (limit > DEFAULTS.maxReleaseTimelineLimit) {
    limit = DEFAULTS.maxReleaseTimelineLimit;
  }

  const trimmedName = name.trim();

  switch (ecosystem) {
    case 'npm':
      return fetchNpmTimeline(trimmedName, limit);
    case 'pypi':
      return fetchPypiTimeline(trimmedName, limit);
    case 'crates':
      return fetchCratesTimeline(trimmedName, limit);
    default:
      return createErrorResponse(
        'INVALID_INPUT',
        `Unsupported ecosystem: ${ecosystem}. Supported: npm, pypi, crates`,
        { provided: ecosystem }
      );
  }
}
