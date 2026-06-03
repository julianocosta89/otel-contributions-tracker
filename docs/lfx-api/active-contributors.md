# Active Contributors & Active Organizations (Time Series)

Base URL: `https://insights.linuxfoundation.org/api`

Both endpoints return the same shape — a summary block plus a bucketed time series. They differ only in the field name inside each data item (`contributors` vs `organizations`).

---

## Active Contributors

```
GET /project/{slug}/contributors/active-contributors
```

Time series of unique active contributor counts across the project's history.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `granularity` | string | Bucket size: `weekly`, `monthly`, `quarterly`, `yearly` (default: `quarterly`). |
| `startDate` | string | Window start (`YYYY-MM-DD`). |
| `endDate` | string | Window end (`YYYY-MM-DD`). |
| `repos` | string[] | Restrict to specific repository URLs. |
| `includeCodeContributions` | boolean | Include git commit activity. |
| `includeCollaborations` | boolean | Include PR review/comment activity. |

**Response**

```json
{
  "summary": {
    "current": 15306,
    "previous": 0,
    "percentageChange": 100,
    "changeValue": 15306,
    "periodFrom": "2010-01-01T00:00:00.000Z",
    "periodTo": "2026-06-03T11:30:58.064Z"
  },
  "maintainerCount": 347,
  "reviewerCount": 2642,
  "data": [
    {
      "startDate": "2023-01-01",
      "endDate": "2023-12-31",
      "contributors": 3309
    },
    {
      "startDate": "2024-01-01",
      "endDate": "2024-12-31",
      "contributors": 4264
    },
    {
      "startDate": "2025-01-01",
      "endDate": "2025-12-31",
      "contributors": 4470
    }
  ]
}
```

---

## Active Organizations

```
GET /project/{slug}/contributors/active-organizations
```

Identical shape to Active Contributors. The only difference is the field name in each data item.

**Response data item**

```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "organizations": 510
}
```

The `summary`, `maintainerCount`, and `reviewerCount` root fields are the same as Active Contributors.

---

## Notes

- `summary.current` is the total unique count across the **entire requested period**, not a per-bucket value.
- `summary.previous` is the equivalent count for the prior period of the same length (used for % change UI cards).
- `maintainerCount` and `reviewerCount` reflect the full project lifetime, regardless of date filters.
- When no date range is specified, `periodFrom` defaults to the project's first commit date.
- Bucket boundaries align to calendar boundaries for `monthly`, `quarterly`, and `yearly` granularities.

---

## Examples

Monthly active contributors for 2023–2025 (verified):
```
GET /project/opentelemetry/contributors/active-contributors?granularity=yearly&startDate=2023-01-01&endDate=2025-12-31
```

Response:
```json
{
  "summary": {
    "current": 9655,
    "previous": 4801,
    "percentageChange": 101.10,
    "changeValue": 4854,
    "periodFrom": "2023-01-01T00:00:00.000+00:00",
    "periodTo": "2025-12-31T00:00:00.000+00:00"
  },
  "maintainerCount": 325,
  "reviewerCount": 1727,
  "data": [
    { "startDate": "2023-01-01", "endDate": "2023-12-31", "contributors": 3309 },
    { "startDate": "2024-01-01", "endDate": "2024-12-31", "contributors": 4264 },
    { "startDate": "2025-01-01", "endDate": "2025-12-31", "contributors": 4470 }
  ]
}
```
