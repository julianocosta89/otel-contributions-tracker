# Global Leaderboard

Base URL: `https://insights.linuxfoundation.org/api`

---

## Get Global Leaderboard

```
GET /leaderboard
```

Global project leaderboard across all ~68,000 LFX-tracked projects.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Zero-based page (default: `0`). |
| `pageSize` | number | Records per page (default: `10`). |
| `search` | string | Filter by project name. |
| `maxRank` | number | Return only projects ranked above (better than) this value. |
| `slug` | string | Return a specific project's leaderboard row by slug. |
| `collectionSlug` | string | Filter to projects in a collection — must be an exact internal slug. |

**Response**

```json
{
  "data": [
    {
      "rank": 1,
      "id": "string (UUID)",
      "segmentId": "string (UUID)",
      "name": "string",
      "slug": "string",
      "logoUrl": "string (URL)",
      "leaderboardType": "focused-teams",
      "value": 4473,
      "previousPeriodValue": 0,
      "collectionsSlugs": ["string"],
      "isLF": false,
      "githubHandleArray": [],
      "status": "active",
      "totalCount": 11261
    }
  ],
  "page": 0,
  "pageSize": 10,
  "total": 68025
}
```

**Field reference**

| Field | Type | Description |
|-------|------|-------------|
| `rank` | number | Project rank (1 = highest). |
| `id` | string | Project UUID. |
| `segmentId` | string | Internal segment UUID. |
| `name` | string | Project display name. |
| `slug` | string | URL-friendly identifier (use this for contributor endpoints). |
| `logoUrl` | string | Project logo/avatar URL. |
| `leaderboardType` | string | Metric driving this rank. Known values: `focused-teams`, `codebase-size`. |
| `value` | number | Current period score used for ranking. |
| `previousPeriodValue` | number | Prior period score (for trend display). |
| `collectionsSlugs` | string[] | Collections this project belongs to. |
| `isLF` | boolean | Whether this is a Linux Foundation project. |
| `totalCount` | number | Absolute metric count (e.g. total contributors or lines of code). |
| `status` | string | Project status (e.g. `"active"`). |

**Notes**
- `leaderboardType` determines the meaning of `value` and `totalCount`. `focused-teams` ranks by contributor concentration; `codebase-size` ranks by lines of code.
- `collectionSlug` filter requires an exact internal slug — partial matches return an empty result set.

**Pagination** — increment `page` until `(page + 1) * pageSize >= total`.

---

## Example

Fetch the OpenTelemetry row:
```
GET /leaderboard?slug=opentelemetry
```
