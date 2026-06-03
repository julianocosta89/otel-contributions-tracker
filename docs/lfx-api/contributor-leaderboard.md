# Contributor Leaderboard

Base URL: `https://insights.linuxfoundation.org/api`

---

## Get Contributor Leaderboard

```
GET /project/{slug}/contributors/contributor-leaderboard
```

Ranked list of individual contributors by contribution volume. Without date filters, returns all-time totals.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | string | Filter window start (`YYYY-MM-DD`). |
| `endDate` | string | Filter window end (`YYYY-MM-DD`). |
| `limit` | number | Max contributors to return (default: `10`). |
| `offset` | number | Record offset for pagination (default: `0`). |
| `granularity` | string | Time granularity — does not change data shape, affects aggregation. |
| `repos` | string[] | Restrict to specific repository URLs. |

**Response**

```json
{
  "meta": {
    "offset": 0,
    "limit": 10,
    "total": 15307
  },
  "data": [
    {
      "avatar": "string (URL)",
      "name": "string",
      "contributions": 76613,
      "percentage": 4.13,
      "roles": ["maintainer", "contributor"],
      "githubHandleArray": ["string"]
    }
  ]
}
```

**Notes**
- `contributions` is a weighted activity count, not a raw commit count.
- `roles` values observed: `"maintainer"`, `"contributor"`, `"reviewer"`.
- `githubHandleArray` may contain multiple handles when a contributor has used different GitHub accounts.
- Date filtering reduces `meta.total` to the active contributor set in that window (e.g., 4,470 for all of 2025).

**Pagination** — increment `offset` by `limit` until `offset >= meta.total`.

---

## Examples

Top 5 contributors, all time:
```
GET /project/opentelemetry/contributors/contributor-leaderboard?limit=5
```

Top 5 contributors in 2025:
```
GET /project/opentelemetry/contributors/contributor-leaderboard?startDate=2025-01-01&endDate=2025-12-31&limit=5
```

Response for the 2025 query (verified):
```json
{
  "meta": { "offset": 0, "limit": 5, "total": 4470 },
  "data": [
    { "name": "Tyler Yahn",      "contributions": 16087, "percentage": 4.23, "roles": ["maintainer"],              "githubHandleArray": ["MrAlias"] },
    { "name": "Trask Stalnaker", "contributions": 15267, "percentage": 4.01, "roles": ["maintainer"],              "githubHandleArray": ["trask"] },
    { "name": "Damien MATHIEU",  "contributions": 9133,  "percentage": 2.40, "roles": ["contributor","maintainer"],"githubHandleArray": ["dmathieu"] },
    { "name": "Antoine Toulme",  "contributions": 8676,  "percentage": 2.28, "roles": ["maintainer"],              "githubHandleArray": ["thel1988","atoulme"] },
    { "name": "Yang Song",       "contributions": 7736,  "percentage": 2.03, "roles": ["maintainer"],              "githubHandleArray": ["songy23"] }
  ]
}
```
