# Projects

Base URL: `https://insights.linuxfoundation.org/api`

---

## List Projects

```
GET /project
```

Paginated list of all LFX-tracked open-source projects.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Zero-based page (default: `0`). |
| `pageSize` | number | Records per page (default: `10`). |
| `search` | string | Full-text search on project name/description. |
| `sort` | string | Sort key. |
| `isLF` | boolean | Filter to Linux Foundation projects only. |
| `collectionSlug` | string | Filter to projects in a specific collection. |
| `slugs` | string[] | Filter to specific project slugs. |
| `healthScore` | boolean | Include health score in response. |

**Response**

```json
{
  "page": 0,
  "pageSize": 10,
  "total": 11633,
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "slug": "string",
      "description": "string",
      "logo": "string (URL)",
      "website": "string (URL)",
      "github": "string (URL)",
      "linkedin": "string (URL)",
      "twitter": "string (URL)",
      "repositories": ["string (URL)"],
      "archivedRepositories": ["string (URL)"],
      "excludedRepositories": ["string (URL)"],
      "score": 0.578,
      "rank": 7013,
      "softwareValue": 364737077,
      "healthScore": 90,
      "organizationCount": 6635,
      "contributorCount": 28726,
      "firstCommit": "string (ISO 8601)",
      "firstCommitUrl": "string (URL)",
      "lastVulnerabilityScanStatus": "string",
      "repoLicenses": ["string"],
      "isLF": true,
      "status": "active",
      "maturity": "string",
      "keywords": ["string"],
      "communityPlatforms": ["string"],
      "connectedPlatforms": ["string"],
      "widgets": ["string"]
    }
  ]
}
```

---

## Get Project

```
GET /project/{slug}
```

Returns the same object shape as a single item from the list, with all fields populated.

**Example:** `GET /project/opentelemetry`

---

## Get Activity Types

```
GET /project/{slug}/activity-types
```

Returns the set of trackable activity types for the project, split by platform. Use the `key` values to filter other endpoints by activity type.

**Response**

```json
{
  "git": [
    { "key": "authored-commit",    "label": "Authored a commit" },
    { "key": "co-authored-commit", "label": "Co-authored a commit" },
    { "key": "committed-commit",   "label": "Committed a commit" },
    { "key": "reported-commit",    "label": "Reported a commit" },
    { "key": "reviewed-commit",    "label": "Reviewed a commit" },
    { "key": "signed-off-commit",  "label": "Signed off a commit" }
  ],
  "github": [
    { "key": "authored-commit",               "label": "Authored a commit" },
    { "key": "pull_request-closed",           "label": "Closed a pull request" },
    { "key": "pull_request-comment",          "label": "Commented on a pull request" },
    { "key": "pull_request-merged",           "label": "Merged a pull request" },
    { "key": "pull_request-opened",           "label": "Opened a pull request" },
    { "key": "pull_request-review-requested", "label": "Requested a review for a pull request" },
    { "key": "pull_request-reviewed",         "label": "Reviewed a pull request" }
  ]
}
```
