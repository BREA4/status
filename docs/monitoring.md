# Monitoring and incident publishing

## Live observations

The page polls `/api/status` every 60 seconds while visible. It checks again when a background tab becomes visible. The server shares in-flight work and caches observations for 60 seconds per function instance. The API has a 30-second Vercel cache. Probes have an eight-second timeout, fixed targets, no redirects, and a 512 KB response limit.

Public probes cover `website` and `login`. A successful response must contain expected page content. HTTP errors indicate an outage; rate limits, access challenges, incorrect content, network errors, and inconclusive responses produce `unknown`. A response slower than three seconds is `degraded`. Every result describes the Vercel monitoring location, not every user's network.

The other checks need a monitor. A normal HTTPS request to a VPN listener cannot prove a VLESS, Hysteria2, or TUIC handshake. Use a synthetic client with monitoring credentials and publish only the sanitized result.

## Optional observation feed

Set `STATUS_FEED_URL` to an operator-controlled HTTPS JSON URL. Set `STATUS_FEED_TOKEN` only if that URL requires a bearer token. These values are server-only. The URL must not redirect, contain embedded credentials, or point to untrusted content. The server validates the feed and discards fields outside this contract.

```json
{
  "version": 1,
  "generatedAt": "2026-10-02T09:00:00Z",
  "components": [
    {
      "id": "amsterdam-reality",
      "status": "operational",
      "checkedAt": "2026-10-02T08:59:50Z",
      "history": [
        { "date": "2026-10-01", "status": "operational", "uptime": 100 }
      ]
    }
  ],
  "incidents": []
}
```

Example timestamps are illustrative. Use actual observation times. Both `generatedAt` and `checkedAt` must be within five minutes of the current time; up to one minute of future clock skew is accepted. Missing and expired observations stay unknown. Feed failures leave public website probes running. The browser also expires statuses if polling stops.

Allowed statuses: `operational`, `degraded`, `partial_outage`, `outage`, `maintenance`, `unknown`. A group's state is its worst current observation or active incident. Unknown components prevent an all-operational headline. Scheduled incidents do not affect availability until their status changes to `maintenance`.

| Group | Component IDs |
| --- | --- |
| Breach website | `website`, `login`, `account`, `devices`, `routing`, `support` |
| Moscow control plane | `control-api`, `profile-delivery` |
| Amsterdam | `amsterdam-reality`, `amsterdam-hysteria2`, `amsterdam-tuic` |
| Riga | `riga-reality`, `riga-hysteria2`, `riga-tuic` |

The catalog is in `src/lib/catalog.ts`. Locations and protocols came from the redacted `vpn-backend/docs/operations/current-production-state.md` referenced by vpn-web, dated August 24, 2026. They are service names, not evidence of current health. vpn-infra's staging inventory was empty when inspected.

## History

Each component can include up to 90 unique UTC dates. `uptime` is the monitor's measured percentage for that day, or `null` if it cannot calculate one. Missing dates display as striped gaps with no percentage. The page does not infer 90-day uptime from a point-in-time probe. The feed must retain its own history; Vercel function memory is not durable storage.

## Publish incidents

Add bilingual reports to `src/data/incidents.json` and push a reviewed change, or include them in the feed's `incidents` array. Feed entries take precedence when IDs match. Messages are rendered as escaped text, never HTML. Reports require the following shape:

```json
{
  "id": "example-maintenance",
  "title": { "en": "Amsterdam maintenance", "ru": "Работы в Амстердаме" },
  "status": "scheduled",
  "impact": "maintenance",
  "startedAt": "2026-10-04T00:00:00Z",
  "updatedAt": "2026-10-02T09:00:00Z",
  "components": ["amsterdam-reality"],
  "updates": [
    {
      "at": "2026-10-02T09:00:00Z",
      "message": {
        "en": "A short interruption is expected during maintenance.",
        "ru": "Во время работ возможен кратковременный перерыв."
      }
    }
  ]
}
```

Allowed incident stages: `investigating`, `identified`, `monitoring`, `resolved`, `scheduled`, `maintenance`. Unresolved incidents continue to affect their listed components until an operator resolves them. An empty record is displayed as no published incidents, not proof of uninterrupted service.

## Boundaries

The status page does not sign into user accounts, retrieve VPN subscriptions, modify infrastructure, or query management APIs with administrator credentials. All HTTP targets are fixed in server code. Feed authentication is sent only to the configured feed URL. Public output contains component IDs, statuses, measured latency, observation times, history, and incident reports. Svelte escapes visible copy; CSP restricts scripts, connections, and fonts to the same origin.
