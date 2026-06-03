# Contributor & Organization Dependency

Base URL: `https://insights.linuxfoundation.org/api`

Concentration analysis endpoints — they show what share of total contributions comes from the top N contributors or organizations, helping identify bus-factor risk.

---

## Contributor Dependency

```
GET /project/{slug}/contributors/contributor-dependency
```

Shows the split between the top N contributors and everyone else, plus the individual list of top contributors.

**Query parameters** — `granularity`, `repos`, `startDate`, `endDate`.

**Response**

```json
{
  "topContributors": {
    "count": 48,
    "percentage": 51.23
  },
  "otherContributors": {
    "count": 15259,
    "percentage": 48.77
  },
  "list": [
    {
      "avatar": "string (URL)",
      "name": "string",
      "contributions": 76613,
      "percentage": 4.13,
      "roles": ["maintainer"],
      "githubHandleArray": ["string"]
    }
  ]
}
```

**Notes**
- `topContributors.count` is the threshold used to define "top" — determined server-side, not a query parameter.
- `list` contains the individual contributor records for each member of the top group.
- `topContributors.percentage + otherContributors.percentage` equals 100.

---

## Organization Dependency

```
GET /project/{slug}/contributors/organization-dependency
```

Same concept as Contributor Dependency, applied to organizations.

**Query parameters** — `granularity`, `repos`, `startDate`, `endDate`.

**Response**

```json
{
  "topOrganizations": {
    "count": 7,
    "percentage": 52.67
  },
  "otherOrganizations": {
    "count": 3,
    "percentage": 47.33
  },
  "list": [
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
- `topOrganizations.count` is server-determined.
- `list` contains the individual org records for the top group.
- OpenTelemetry example: top 7 orgs hold 52.67% of all contributions.
