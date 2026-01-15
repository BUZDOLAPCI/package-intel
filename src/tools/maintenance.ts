/**
 * Package Intel MCP Server - Maintenance Signals Tool
 */

import { REGISTRY_URLS, loadConfig } from '../config.js';
import type {
  ApiResponse,
  MaintenanceSignals,
  MaintenanceSignalsInput,
  MaintenanceRating,
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
): ApiResponse<MaintenanceSignals> {
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
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const diff = Math.abs(date1.getTime() - date2.getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Calculate maintenance rating for recency
 * Good: < 90 days, Fair: < 365 days, Poor: >= 365 days
 */
function rateRecency(daysSinceLastRelease: number): MaintenanceRating {
  if (daysSinceLastRelease < 90) return 'good';
  if (daysSinceLastRelease < 365) return 'fair';
  return 'poor';
}

/**
 * Calculate maintenance rating for release frequency
 * Good: >= 4/year, Fair: >= 1/year, Poor: < 1/year
 */
function rateFrequency(releasesPerYear: number): MaintenanceRating {
  if (releasesPerYear >= 4) return 'good';
  if (releasesPerYear >= 1) return 'fair';
  return 'poor';
}

/**
 * Calculate maintenance rating for maturity (version count)
 * Good: >= 10 versions, Fair: >= 3 versions, Poor: < 3 versions
 */
function rateMaturity(totalVersions: number): MaintenanceRating {
  if (totalVersions >= 10) return 'good';
  if (totalVersions >= 3) return 'fair';
  return 'poor';
}

/**
 * Calculate overall maintenance score
 */
function calculateOverallScore(
  recency: MaintenanceRating,
  frequency: MaintenanceRating,
  maturity: MaintenanceRating,
  isDeprecated: boolean
): MaintenanceRating {
  if (isDeprecated) return 'poor';

  const scores: Record<MaintenanceRating, number> = {
    good: 2,
    fair: 1,
    poor: 0,
  };

  // Weight recency most heavily (50%), then frequency (30%), then maturity (20%)
  const weightedScore =
    scores[recency] * 0.5 + scores[frequency] * 0.3 + scores[maturity] * 0.2;

  if (weightedScore >= 1.5) return 'good';
  if (weightedScore >= 0.7) return 'fair';
  return 'poor';
}

/**
 * Calculate releases per year from release dates
 */
function calculateReleasesPerYear(releaseDates: Date[]): number {
  if (releaseDates.length < 2) return 0;

  const sorted = [...releaseDates].sort((a, b) => a.getTime() - b.getTime());
  const firstRelease = sorted[0];
  const lastRelease = sorted[sorted.length - 1];

  const yearsSpan = daysBetween(firstRelease, lastRelease) / 365;
  if (yearsSpan < 0.1) return releaseDates.length * 10; // If all in < 1 month, extrapolate

  return releaseDates.length / yearsSpan;
}

/**
 * Fetch and analyze npm maintenance signals
 */
async function fetchNpmMaintenanceSignals(
  name: string
): Promise<ApiResponse<MaintenanceSignals>> {
  const url = `${REGISTRY_URLS.npm}/${encodeURIComponent(name)}`;

  try {
    const data = await fetchRegistry<NpmPackageResponse>(url);

    // Get all release dates
    const releaseDates: Date[] = [];
    let lastReleaseDate: Date | null = null;
    let isDeprecated = false;
    let deprecationMessage: string | undefined;

    for (const [version, dateStr] of Object.entries(data.time)) {
      if (version === 'created' || version === 'modified') continue;
      const date = new Date(dateStr);
      releaseDates.push(date);
      if (!lastReleaseDate || date > lastReleaseDate) {
        lastReleaseDate = date;
      }
    }

    // Check for deprecation in latest version
    const latestVersion = data['dist-tags']?.latest;
    if (latestVersion && data.versions[latestVersion]?.deprecated) {
      isDeprecated = true;
      deprecationMessage = data.versions[latestVersion].deprecated;
    }

    const now = new Date();
    const daysSinceLastRelease = lastReleaseDate
      ? daysBetween(now, lastReleaseDate)
      : Infinity;
    const releasesPerYear = calculateReleasesPerYear(releaseDates);
    const totalVersions = releaseDates.length;

    const recency = rateRecency(daysSinceLastRelease);
    const frequency = rateFrequency(releasesPerYear);
    const maturity = rateMaturity(totalVersions);
    const maintenanceScore = calculateOverallScore(
      recency,
      frequency,
      maturity,
      isDeprecated
    );

    return {
      ok: true,
      data: {
        package_name: data.name,
        ecosystem: 'npm',
        days_since_last_release: daysSinceLastRelease === Infinity ? -1 : daysSinceLastRelease,
        last_release_date: lastReleaseDate?.toISOString() || null,
        releases_per_year: Math.round(releasesPerYear * 100) / 100,
        total_versions: totalVersions,
        is_deprecated: isDeprecated,
        deprecation_message: deprecationMessage,
        maintenance_score: maintenanceScore,
        score_factors: { recency, frequency, maturity },
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
 * Fetch and analyze PyPI maintenance signals
 */
async function fetchPypiMaintenanceSignals(
  name: string
): Promise<ApiResponse<MaintenanceSignals>> {
  const url = `${REGISTRY_URLS.pypi}/${encodeURIComponent(name)}/json`;

  try {
    const data = await fetchRegistry<PypiPackageResponse>(url);

    // Get all release dates
    const releaseDates: Date[] = [];
    let lastReleaseDate: Date | null = null;

    for (const [, files] of Object.entries(data.releases)) {
      if (!files || files.length === 0) continue;

      const dateStr = files[0].upload_time_iso_8601 || files[0].upload_time;
      if (dateStr) {
        const date = new Date(dateStr);
        releaseDates.push(date);
        if (!lastReleaseDate || date > lastReleaseDate) {
          lastReleaseDate = date;
        }
      }
    }

    // Check for deprecation via classifiers
    const isDeprecated = data.info.classifiers?.some(
      (c) => c.includes('Development Status :: 7 - Inactive') || c.includes('Development Status :: 1 - Planning')
    ) || false;

    const now = new Date();
    const daysSinceLastRelease = lastReleaseDate
      ? daysBetween(now, lastReleaseDate)
      : Infinity;
    const releasesPerYear = calculateReleasesPerYear(releaseDates);
    const totalVersions = releaseDates.length;

    const recency = rateRecency(daysSinceLastRelease);
    const frequency = rateFrequency(releasesPerYear);
    const maturity = rateMaturity(totalVersions);
    const maintenanceScore = calculateOverallScore(
      recency,
      frequency,
      maturity,
      isDeprecated
    );

    return {
      ok: true,
      data: {
        package_name: data.info.name,
        ecosystem: 'pypi',
        days_since_last_release: daysSinceLastRelease === Infinity ? -1 : daysSinceLastRelease,
        last_release_date: lastReleaseDate?.toISOString() || null,
        releases_per_year: Math.round(releasesPerYear * 100) / 100,
        total_versions: totalVersions,
        is_deprecated: isDeprecated,
        maintenance_score: maintenanceScore,
        score_factors: { recency, frequency, maturity },
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
 * Fetch and analyze crates.io maintenance signals
 */
async function fetchCratesMaintenanceSignals(
  name: string
): Promise<ApiResponse<MaintenanceSignals>> {
  const url = `${REGISTRY_URLS.crates}/${encodeURIComponent(name)}`;

  try {
    const data = await fetchRegistry<CratesPackageResponse>(url);

    // Get all release dates (excluding yanked)
    const releaseDates: Date[] = [];
    let lastReleaseDate: Date | null = null;

    for (const version of data.versions) {
      if (version.yanked) continue;
      const date = new Date(version.created_at);
      releaseDates.push(date);
      if (!lastReleaseDate || date > lastReleaseDate) {
        lastReleaseDate = date;
      }
    }

    // Check if all versions are yanked
    const isDeprecated = data.versions.every((v) => v.yanked);

    const now = new Date();
    const daysSinceLastRelease = lastReleaseDate
      ? daysBetween(now, lastReleaseDate)
      : Infinity;
    const releasesPerYear = calculateReleasesPerYear(releaseDates);
    const totalVersions = releaseDates.length;

    const recency = rateRecency(daysSinceLastRelease);
    const frequency = rateFrequency(releasesPerYear);
    const maturity = rateMaturity(totalVersions);
    const maintenanceScore = calculateOverallScore(
      recency,
      frequency,
      maturity,
      isDeprecated
    );

    return {
      ok: true,
      data: {
        package_name: data.crate.name,
        ecosystem: 'crates',
        days_since_last_release: daysSinceLastRelease === Infinity ? -1 : daysSinceLastRelease,
        last_release_date: lastReleaseDate?.toISOString() || null,
        releases_per_year: Math.round(releasesPerYear * 100) / 100,
        total_versions: totalVersions,
        is_deprecated: isDeprecated,
        maintenance_score: maintenanceScore,
        score_factors: { recency, frequency, maturity },
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
 * Get maintenance signals for any supported ecosystem
 */
export async function maintenanceSignals(
  input: MaintenanceSignalsInput
): Promise<ApiResponse<MaintenanceSignals>> {
  const { ecosystem, name } = input;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return createErrorResponse('INVALID_INPUT', 'Package name is required', {
      provided: name,
    });
  }

  const trimmedName = name.trim();

  switch (ecosystem) {
    case 'npm':
      return fetchNpmMaintenanceSignals(trimmedName);
    case 'pypi':
      return fetchPypiMaintenanceSignals(trimmedName);
    case 'crates':
      return fetchCratesMaintenanceSignals(trimmedName);
    default:
      return createErrorResponse(
        'INVALID_INPUT',
        `Unsupported ecosystem: ${ecosystem}. Supported: npm, pypi, crates`,
        { provided: ecosystem }
      );
  }
}
