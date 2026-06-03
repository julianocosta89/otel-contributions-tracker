# LFX Insights API Reference

Base URL: `https://insights.linuxfoundation.org/api`

All endpoints return JSON. No authentication is required for read-only endpoints.

---

## Files

| File | Endpoints |
|------|-----------|
| [projects.md](projects.md) | `GET /project`, `GET /project/{slug}`, `GET /project/{slug}/activity-types` |
| [contributor-leaderboard.md](contributor-leaderboard.md) | `GET /project/{slug}/contributors/contributor-leaderboard` |
| [organization-leaderboard.md](organization-leaderboard.md) | `GET /project/{slug}/contributors/organization-leaderboard` |
| [active-contributors.md](active-contributors.md) | `GET /project/{slug}/contributors/active-contributors`, `active-organizations` |
| [contributor-dependency.md](contributor-dependency.md) | `GET /project/{slug}/contributors/contributor-dependency`, `organization-dependency` |
| [geographical-distribution.md](geographical-distribution.md) | `GET /project/{slug}/contributors/geographical-distribution` |
| [retention.md](retention.md) | `GET /project/{slug}/contributors/retention` |
| [leaderboard.md](leaderboard.md) | `GET /leaderboard` |

---

## Common Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `granularity` | string | Time bucket size. One of `weekly`, `monthly`, `quarterly`, `yearly`. |
| `startDate` | string | ISO 8601 date (`YYYY-MM-DD`). Filters the time window. |
| `endDate` | string | ISO 8601 date (`YYYY-MM-DD`). Filters the time window. |
| `repos` | string[] | Filter by specific repository URLs. |
| `limit` | number | Max records to return (contributor/org leaderboard endpoints). |
| `offset` | number | Zero-based record offset (contributor/org leaderboard endpoints). |
| `page` | number | Zero-based page number (project list, global leaderboard). |
| `pageSize` | number | Records per page (project list, global leaderboard). |

---

## Pagination Patterns

Two pagination styles are used depending on the endpoint family.

### `meta` style — contributor and organization leaderboards

```json
{ "meta": { "offset": 0, "limit": 10, "total": 15307 }, "data": [...] }
```

Iterate by incrementing `offset` by `limit` until `offset >= total`.

### `page` style — project list, global leaderboard

```json
{ "page": 0, "pageSize": 10, "total": 68025, "data": [...] }
```

Iterate by incrementing `page` until `(page + 1) * pageSize >= total`.

---

## OpenTelemetry Reference Values

Useful for sanity-checking responses (as of 2026-06).

| Metric | Value |
|--------|-------|
| Project slug | `opentelemetry` |
| All-time contributors | 15,307 |
| All-time organizations | 3,774 |
| Active contributors (2025) | 4,470 |
| Active organizations (2025) | ~1,111 |
| Maintainer count | 347 |
| Reviewer count | 2,642 |
| Health score | 90 |
| Top contributor (all-time) | Bogdan Drutu — 76,613 contributions (4.13%) |
| Top organization (all-time) | Splunk Inc. — 255,600 contributions (16.13%) |
| Top contributor (2025) | Tyler Yahn — 16,087 contributions (4.23%) |
| Top organization (2025) | Microsoft Corporation — 43,768 contributions (13.92%) |

---

## Known Limitations

- **No OpenAPI spec** — routes are TypeScript source files in `frontend/server/api/` of the [linuxfoundation/insights](https://github.com/linuxfoundation/insights) repo.
- **`retention` requires `granularity=yearly`** — the endpoint returns `400` without it.
- **Date filtering on leaderboards** — `startDate`/`endDate` reduce the active set (lower `total`), but the response structure is unchanged.
- **`collectionSlug` on `/leaderboard`** — must be an exact internal slug; partial matches return empty.
- **No versioning** — this is an internal API with no stability guarantees.
- **Backend** — analytics data is served from TinyBird (`/v0/pipes/`); community/auth data is PostgreSQL.
