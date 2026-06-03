# Geographical Distribution

Base URL: `https://insights.linuxfoundation.org/api`

---

## Get Geographical Distribution

```
GET /project/{slug}/contributors/geographical-distribution
```

Contributor counts grouped by country, based on location data inferred from GitHub profiles.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `granularity` | string | Time granularity: `weekly`, `monthly`, `quarterly`, `yearly`. |
| `repos` | string[] | Restrict to specific repository URLs. |

**Response**

```json
{
  "summary": {
    "totalContributions": 0
  },
  "data": [
    {
      "name": "United States",
      "code": "US",
      "flag": "🇺🇸",
      "count": 1180,
      "percentage": 8
    }
  ]
}
```

**Field reference**

| Field | Type | Description |
|-------|------|-------------|
| `summary.totalContributions` | number | Aggregate count — may be `0` when location data is sparse. |
| `data[].name` | string | Country display name. |
| `data[].code` | string | ISO 3166-1 alpha-2 country code (e.g. `"US"`, `"DE"`). |
| `data[].flag` | string | Country flag emoji. |
| `data[].count` | number | Number of contributors from this country. |
| `data[].percentage` | number | Share of total located contributors (integer, not decimal). |

**Notes**
- Countries with unknown affiliation are omitted entirely from `data`.
- `summary.totalContributions` is often `0` because most contributors do not expose a public location — use `data[].count` values directly.
- `percentage` values sum to approximately 100 across all returned countries.
