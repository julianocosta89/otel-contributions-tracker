# Contributor Retention

Base URL: `https://insights.linuxfoundation.org/api`

---

## Get Retention

```
GET /project/{slug}/contributors/retention
```

Year-over-year retention rate: the fraction of contributors from the prior year who remained active in the current year.

**Query parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `granularity` | string | **Yes** | Must be `yearly`. Omitting this parameter returns `400`. |
| `repos` | string[] | No | Restrict to specific repository URLs. |

**Response**

```json
{
  "data": [
    {
      "startDate": "2017-01-01",
      "endDate": "2017-12-31",
      "percentage": 0
    },
    {
      "startDate": "2020-01-01",
      "endDate": "2020-12-31",
      "percentage": 49.32
    },
    {
      "startDate": "2025-01-01",
      "endDate": "2025-12-31",
      "percentage": 28.28
    }
  ]
}
```

**Field reference**

| Field | Type | Description |
|-------|------|-------------|
| `data[].startDate` | string | Year start (`YYYY-01-01`). |
| `data[].endDate` | string | Year end (`YYYY-12-31`). |
| `data[].percentage` | number | Retention rate for this year (0–100). |

**Notes**
- `percentage` for the first year of the project is always `0` — there is no prior cohort to compare against.
- `granularity=yearly` is the only accepted value; any other value (or omission) returns `400 Bad Request`.
- OpenTelemetry retention peaked at ~49% in 2020 and has trended down to ~28% by 2025, which is normal for large, growing projects where new contributors always outnumber returning ones.
