# Organization Leaderboard

Base URL: `https://insights.linuxfoundation.org/api`

---

## Get Organization Leaderboard

```
GET /project/{slug}/contributors/organization-leaderboard
```

Ranked list of organizations by contribution volume. Without date filters, returns all-time totals.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | string | Filter window start (`YYYY-MM-DD`). |
| `endDate` | string | Filter window end (`YYYY-MM-DD`). |
| `limit` | number | Max organizations to return (default: `10`). |
| `offset` | number | Record offset for pagination (default: `0`). |
| `granularity` | string | Time granularity — does not change data shape, affects aggregation. |
| `repos` | string[] | Restrict to specific repository URLs. |

**Response**

```json
{
  "meta": {
    "offset": 0,
    "limit": 10,
    "total": 3774
  },
  "data": [
    {
      "id": "string (UUID)",
      "slug": "string",
      "logo": "string (URL)",
      "name": "string",
      "contributions": 255600,
      "percentage": 16.13,
      "website": "string (URL)"
    }
  ]
}
```

**Notes**
- `contributions` is a weighted activity count across all activity types.
- `website` may be an empty string.
- Date filtering reduces `meta.total` to the set of organizations active in that window (e.g., 1,111 for all of 2025).

**Pagination** — increment `offset` by `limit` until `offset >= meta.total`.

---

## Examples

Top 5 organizations, all time:
```
GET /project/opentelemetry/contributors/organization-leaderboard?limit=5
```

Top 5 organizations in 2025:
```
GET /project/opentelemetry/contributors/organization-leaderboard?startDate=2025-01-01&endDate=2025-12-31&limit=5
```

Response for the 2025 query (verified):
```json
{
  "meta": { "offset": 0, "limit": 5, "total": 1111 },
  "data": [
    { "name": "Microsoft Corporation", "contributions": 43768, "percentage": 13.92 },
    { "name": "Splunk Inc.",           "contributions": 33603, "percentage": 10.69 },
    { "name": "Elastic",               "contributions": 32239, "percentage": 10.25 },
    { "name": "Datadog, Inc.",         "contributions": 21496, "percentage":  6.84 },
    { "name": "Grafana Labs",          "contributions": 17118, "percentage":  5.44 }
  ]
}
```
