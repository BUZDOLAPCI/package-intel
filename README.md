# Package Intel MCP Server

A Model Context Protocol (MCP) server for querying package registries (npm, PyPI, crates.io) to retrieve metadata about packages including versions, release cadence, and maintenance signals.

## Features

- **Multi-Registry Support**: Query npm, PyPI, and crates.io from a single interface
- **Package Summaries**: Get comprehensive package metadata including version, license, and repository info
- **Release Timelines**: Retrieve version history with release dates
- **Maintenance Signals**: Analyze package health with automated scoring

## Installation

```bash
npm install
npm run build
```

## Usage

### As MCP Server (stdio)

```bash
npm start
```

### As HTTP Server

```bash
npm run start:http
# Or with custom port
PORT=8080 npm run start:http
```

### Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "package-intel": {
      "command": "node",
      "args": ["/path/to/package-intel/dist/cli.js"]
    }
  }
}
```

## Tools

### package_summary

Get summary information about a package.

**Parameters:**
- `ecosystem` (required): `"npm"` | `"pypi"` | `"crates"`
- `name` (required): Package name

**Example:**
```json
{
  "ecosystem": "npm",
  "name": "lodash"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "name": "lodash",
    "version": "4.17.21",
    "description": "Lodash modular utilities.",
    "homepage": "https://lodash.com/",
    "repository": "https://github.com/lodash/lodash",
    "license": "MIT",
    "keywords": ["modules", "stdlib", "util"]
  },
  "meta": {
    "source": "https://registry.npmjs.org/lodash",
    "retrieved_at": "2024-01-15T10:30:00.000Z",
    "pagination": { "next_cursor": null },
    "warnings": []
  }
}
```

### release_timeline

Get the release history of a package.

**Parameters:**
- `ecosystem` (required): `"npm"` | `"pypi"` | `"crates"`
- `name` (required): Package name
- `limit` (optional): Maximum releases to return (default: 20, max: 100)

**Example:**
```json
{
  "ecosystem": "pypi",
  "name": "requests",
  "limit": 5
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "package_name": "requests",
    "ecosystem": "pypi",
    "releases": [
      {
        "version": "2.31.0",
        "date": "2023-05-22T10:00:00.000Z",
        "is_prerelease": false
      },
      {
        "version": "2.30.0",
        "date": "2023-05-01T10:00:00.000Z",
        "is_prerelease": false
      }
    ],
    "total_versions": 87
  },
  "meta": {
    "source": "https://pypi.org/pypi/requests/json",
    "retrieved_at": "2024-01-15T10:30:00.000Z",
    "pagination": { "next_cursor": "5" },
    "warnings": []
  }
}
```

### maintenance_signals

Analyze maintenance health signals for a package.

**Parameters:**
- `ecosystem` (required): `"npm"` | `"pypi"` | `"crates"`
- `name` (required): Package name

**Example:**
```json
{
  "ecosystem": "crates",
  "name": "serde"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "package_name": "serde",
    "ecosystem": "crates",
    "days_since_last_release": 45,
    "last_release_date": "2023-12-01T10:00:00.000Z",
    "releases_per_year": 12.5,
    "total_versions": 156,
    "is_deprecated": false,
    "maintenance_score": "good",
    "score_factors": {
      "recency": "good",
      "frequency": "good",
      "maturity": "good"
    }
  },
  "meta": {
    "source": "https://crates.io/api/v1/crates/serde",
    "retrieved_at": "2024-01-15T10:30:00.000Z",
    "pagination": { "next_cursor": null },
    "warnings": []
  }
}
```

## Maintenance Score Calculation

The maintenance score is calculated based on three factors:

### Recency (50% weight)
- **Good**: Last release < 90 days ago
- **Fair**: Last release < 365 days ago
- **Poor**: Last release >= 365 days ago

### Frequency (30% weight)
- **Good**: >= 4 releases per year
- **Fair**: >= 1 release per year
- **Poor**: < 1 release per year

### Maturity (20% weight)
- **Good**: >= 10 total versions
- **Fair**: >= 3 total versions
- **Poor**: < 3 total versions

If a package is deprecated, the score is automatically set to "poor".

## Error Handling

All tools return errors in a consistent envelope format:

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Package 'nonexistent' not found on npm",
    "details": {
      "package": "nonexistent",
      "ecosystem": "npm"
    }
  },
  "meta": {
    "retrieved_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### Error Codes

- `INVALID_INPUT`: Invalid parameters or package not found
- `UPSTREAM_ERROR`: Registry API returned an unexpected error
- `RATE_LIMITED`: Registry rate limit exceeded
- `TIMEOUT`: Request timed out
- `PARSE_ERROR`: Failed to parse registry response
- `INTERNAL_ERROR`: Unexpected server error

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `REQUEST_TIMEOUT` | `30000` | Request timeout in ms |
| `USER_AGENT` | `package-intel/0.1.0` | User agent for registry requests |
| `CACHE_TTL` | `300` | Cache TTL in seconds |
| `LOG_LEVEL` | `info` | Log level: debug, info, warn, error |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck

# Development mode (watch)
npm run dev
```

## License

MIT
