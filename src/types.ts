/**
 * Package Intel MCP Server - Type Definitions
 */

// Supported package ecosystems
export type Ecosystem = 'npm' | 'pypi' | 'crates';

// Standard response envelope for success
export interface SuccessResponse<T> {
  ok: true;
  data: T;
  meta: ResponseMeta;
}

// Standard response envelope for errors
export interface ErrorResponse {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    details: Record<string, unknown>;
  };
  meta: {
    retrieved_at: string;
  };
}

export type ErrorCode =
  | 'INVALID_INPUT'
  | 'UPSTREAM_ERROR'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'INTERNAL_ERROR';

export interface ResponseMeta {
  source?: string;
  retrieved_at: string;
  pagination?: {
    next_cursor: string | null;
  };
  warnings: string[];
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// Package summary data
export interface PackageSummary {
  name: string;
  version: string;
  description: string | null;
  homepage: string | null;
  repository: string | null;
  license: string | null;
  keywords: string[];
  downloads?: {
    weekly?: number;
    monthly?: number;
    total?: number;
  };
}

// Release timeline entry
export interface ReleaseEntry {
  version: string;
  date: string;
  is_prerelease: boolean;
}

// Release timeline data
export interface ReleaseTimeline {
  package_name: string;
  ecosystem: Ecosystem;
  releases: ReleaseEntry[];
  total_versions: number;
}

// Maintenance score rating
export type MaintenanceRating = 'good' | 'fair' | 'poor';

// Maintenance signals data
export interface MaintenanceSignals {
  package_name: string;
  ecosystem: Ecosystem;
  days_since_last_release: number;
  last_release_date: string | null;
  releases_per_year: number;
  total_versions: number;
  is_deprecated: boolean;
  deprecation_message?: string;
  maintenance_score: MaintenanceRating;
  score_factors: {
    recency: MaintenanceRating;
    frequency: MaintenanceRating;
    maturity: MaintenanceRating;
  };
}

// Tool input schemas
export interface PackageSummaryInput {
  ecosystem: Ecosystem;
  name: string;
}

export interface ReleaseTimelineInput {
  ecosystem: Ecosystem;
  name: string;
  limit?: number;
}

export interface MaintenanceSignalsInput {
  ecosystem: Ecosystem;
  name: string;
}

// Registry API response types (raw)
export interface NpmPackageResponse {
  name: string;
  'dist-tags': {
    latest: string;
    [key: string]: string;
  };
  versions: {
    [version: string]: {
      name: string;
      version: string;
      description?: string;
      homepage?: string;
      repository?: { type: string; url: string } | string;
      license?: string | { type: string };
      keywords?: string[];
      deprecated?: string;
    };
  };
  time: {
    created: string;
    modified: string;
    [version: string]: string;
  };
  description?: string;
  homepage?: string;
  repository?: { type: string; url: string } | string;
  license?: string;
  keywords?: string[];
}

export interface PypiPackageResponse {
  info: {
    name: string;
    version: string;
    summary: string | null;
    home_page: string | null;
    project_url: string | null;
    project_urls: Record<string, string> | null;
    license: string | null;
    keywords: string | null;
    classifiers: string[];
  };
  releases: {
    [version: string]: Array<{
      upload_time: string;
      upload_time_iso_8601: string;
    }>;
  };
  urls: Array<{
    upload_time: string;
    upload_time_iso_8601: string;
  }>;
}

export interface CratesPackageResponse {
  crate: {
    id: string;
    name: string;
    description: string | null;
    homepage: string | null;
    repository: string | null;
    max_version: string;
    max_stable_version: string | null;
    downloads: number;
    recent_downloads: number | null;
    keywords: string[];
    categories: string[];
  };
  versions: Array<{
    id: number;
    crate: string;
    num: string;
    created_at: string;
    updated_at: string;
    yanked: boolean;
    license: string | null;
  }>;
}

// Server configuration
export interface ServerConfig {
  port: number;
  requestTimeout: number;
  userAgent: string;
  cacheTtl: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// Tool handler type
export type ToolHandler<TInput, TOutput> = (
  input: TInput
) => Promise<ApiResponse<TOutput>>;
