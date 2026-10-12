# Monitoring and incident publishing

## Live observations

The browser fetches `/status/api/status.json` immediately after hydration, every 60 seconds while visible, and when focus or connectivity returns. These requests read published static data; they do not run probes. The `Monitor and publish Pages` GitHub Actions workflow runs probes every five minutes on its `2-59/5 * * * *` schedule, including without visitors. Probes have an eight-second timeout, fixed targets, no redirects, and a 512 KB response limit, except for the update feed and GitHub asset redirects described below. Production contains no mock provider or fabricated successful observations.

The static site preserves observations for up to 15 minutes to allow for scheduling and publication delays, then marks current statuses unknown. Historical bars never expire with the current observation. GitHub does not guarantee exact scheduling. See [GitHub's schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Public probes cover `website` and `login`. A successful response must contain expected page content. HTTP errors indicate an outage; rate limits, access challenges, incorrect content, network errors, and inconclusive responses produce `unknown`. A response slower than three seconds is `degraded`. Every result describes the GitHub Actions runner location, not every user's network.

The `update-server` check uses the same Sparkle endpoint as BREA4/apple-app: `https://brea4.github.io/apple-app-update-server/appcast.xml`. [The public publisher](https://github.com/BREA4/apple-app-update-server/blob/main/scripts/pipeline.py) retains up to 100 recent builds plus the newest stable build if it falls outside that window. The monitor accepts up to 101 entries and a 1 MB feed, covering the publisher's 900 KB XML budget and Sparkle signing comments. It requires signed enclosure metadata and matching build/channel identities, then sends HEAD requests only to the highest build in each published channel. Beta items use `sparkle:channel=beta`; stable items omit the channel. A beta-only feed is valid. An empty feed remains unknown and makes no archive requests.

Archive URLs must use `https://github.com/BREA4/apple-app-update-server/releases/download/VERSION-CHANNEL-build-N/Breach-VERSION-build-N-arm64.zip`, where `CHANNEL` is `beta` or `release`. The tag and filename must agree on version and build. Each checked archive must respond successfully with the byte size stated in the feed. The monitor follows at most two redirects per archive, validating each destination before sending another HEAD request. Only HTTPS URLs on `release-assets.githubusercontent.com` and `objects.githubusercontent.com` are allowed; temporary signed query strings are permitted on those asset hosts. The feed itself cannot redirect, and enclosure URLs cannot contain credentials, queries, or fragments. DTDs, malformed XML, and external entities are rejected. Feed and archive requests share an eight-second deadline and send no authentication credentials. ZIP contents, cryptographic signature verification, and installation are outside this check. The retired Vercel update host is no longer probed.

Two further checks use the real deployed Go control-plane contracts from [vpn-backend PR #2](https://github.com/BREA4/vpn-backend/pull/2), head `0fb6da6f7f7bce3b801f650ae5670205a0ceded8`. The current deployed subscription service reported build `20261003.2307switches`; its `/version` does not supply a verifiable Git revision, so matching the exact running commit is not established.

- `control-api` fetches `https://brea4.space/api/v1/public/capabilities` through the real web gateway. A valid response has boolean `registration_enabled`, `passkey_login`, and `passkey_registration` fields, matching `control-plane/internal/transport/httpapi/account_registration.go`. False capability values are valid configuration and do not mean an API outage. This checks API reachability through vpn-web, not authenticated account or device operations.
- `profile-delivery` fetches `https://sync.fatconfig.space/readyz` and requires the Go HTTP API's JSON readiness contract `{"status":"ready"}`, defined in `control-plane/internal/transport/httpapi/server.go`. The Go process checks its database/epoch dependencies before declaring readiness. This checks subscription-service readiness, not a user's actual profile contents or successful VPN connection.

Account and device operations need authenticated measurements. VPN protocol checks need a monitor; a normal HTTPS request to a listener cannot prove a VLESS, Hysteria2, or TUIC handshake. Use a synthetic client with monitoring credentials and publish only the sanitized result. Services lacking those observations remain `unknown` with no invented history.

## Optional observation feed

Set repository variable or secret `STATUS_FEED_URL` to an operator-controlled HTTPS JSON URL. Set repository secret `STATUS_FEED_TOKEN` only if that URL requires a bearer token. These values are used only by the collection step; the build and browser never receive the token. The URL must not redirect, contain embedded credentials, or point to untrusted content. The collector validates the feed and discards fields outside this contract.

```json
{
  "version": 1,
  "generatedAt": "2026-10-02T09:00:00Z",
  "components": [
    {
      "id": "amsterdam-reality",
      "status": "operational",
      "checkedAt": "2026-10-02T08:59:50Z",
      "history": [{ "date": "2026-10-01", "status": "operational", "uptime": 100 }]
    }
  ],
  "incidents": []
}
```

Example timestamps are illustrative. Use actual observation times. Both `generatedAt` and `checkedAt` must be within five minutes of the current time; up to one minute of future clock skew is accepted. Missing and expired observations stay unknown. Feed failures leave public website probes running. The browser expires published statuses after 15 minutes even if polling stops.

Allowed observation statuses: `operational`, `degraded`, `partial_outage`, `outage`, `maintenance`, `unknown`. Global and group summaries use the same policy. Mixed operational and unknown services show "Monitoring incomplete"; all-unknown services show unavailable data. A known failure or active incident takes precedence. An all-operational headline requires every enabled component to have a fresh healthy observation. Individual unknown components remain "No data". `incomplete` is a presentation state and is never stored as a measured component status. Scheduled incidents do not affect availability until their status changes to `maintenance`.

| Group                | Component IDs                                                  |
| -------------------- | -------------------------------------------------------------- |
| Breach website       | `website`, `login`, `account`, `devices`, `routing`, `support` |
| Breach app           | `update-server`                                                |
| Moscow control plane | `control-api`, `profile-delivery`                              |
| Amsterdam            | `amsterdam-reality`, `amsterdam-hysteria2`, `amsterdam-tuic`   |
| Riga                 | `riga-reality`, `riga-hysteria2`, `riga-tuic`                  |

The catalog is in `src/lib/catalog.ts`. Locations and protocols came from the redacted `vpn-backend/docs/operations/current-production-state.md` referenced by vpn-web, dated August 24, 2026. They are service names, not evidence of current health. vpn-infra's staging inventory was empty when inspected.

Every ID in the table has a boolean setting in `src/data/features.json` named `service-<id>`, such as `service-profile-delivery` or `service-riga-tuic`. Flags default to on. Turning one off stops its public probe, discards its feed observations, and removes it and its history from the page, API, headline, and affected-service lists. Saved history remains on the `monitoring-data` branch within the 90-day retention window and becomes visible if the service is enabled again. Incidents scoped only to disabled services disappear; mixed incidents retain enabled component references. Empty component lists denote global incidents, which remain while any services are enabled. If every service is disabled, no upstream checks run and the snapshot contains no components or incidents. The operator's feed may continue publishing the complete catalog.

## History

Production saves daily summaries in `history.json` on the `monitoring-data` branch. A fresh HTTP or feed observation records the component's worst known status for its UTC date, including active incident impact. Recovery and inconclusive checks cannot erase a known problem. Days with only inconclusive checks have a solid gray bar; days without any observations have a striped gap. Services without observations get no invented history. The last 90 UTC dates are retained; future feed dates are discarded. Saved feed history survives feed failures. Disabling a service hides its saved history without deleting it.

`uptime` is a monitor's measured percentage for that day, or `null` for ordinary status checks. The history heading averages the recorded days within the 90-day window, even before a full 90 days are available. A supplied measured percentage takes precedence. Otherwise, operational and degraded days count as available at 100%; partial outages, outages, and maintenance days count as unavailable at 0%. Missing days and unknown days without a measured percentage are excluded from both the numerator and denominator. One recorded operational day therefore shows 100%, while two available days and one unavailable day show 66.67%. This fallback reports availability by recorded day, using the day's worst recorded status, rather than continuous time-based uptime. The API retains `uptime: null` for those status-only records.

Each day's tooltip shows its measured percentage or availability calculated from its recorded status, formatted with up to two decimal places and no trailing zeros. Missing days display as striped gaps. If no usable recorded days exist, the heading shows "No data" or "No recorded history". Recording begins when storage is configured; earlier unmeasured days cannot be reconstructed.

Only changed daily summaries are committed. The collector validates bounded history JSON, checks its revision before writing, and replaces files atomically. The entire collection and deployment workflow is serialized. A history read, validation, or write failure fails the workflow and preserves the existing Pages deployment; it cannot publish an empty replacement archive. When persistence fails in the history recorder, its returned snapshot still includes this run's observations with `historyRecording: "unavailable"`, so a recorded outage day is not hidden.

The workflow checks out `main` and `monitoring-data` independently, runs `bun run monitor`, commits `history.json` when it changes, then builds a static page and public status JSON. Only the `build/` directory is uploaded. GitHub's token has contents-write permission for the history step; Pages deployment uses a separate job with Pages and OIDC permissions. Optional feed credentials are restricted to collection.

The migration seed is `src/data/history-seed.json`, exported from the former deployment on October 12, 2026. The export contained October 4–6; there were no durable records for October 7–11. Those missing dates stay empty. Actual collection resumes on the migration date. Local collection uses the ignored `.monitoring/` directory and never commits production history by itself.

Configure Settings → Pages → Source as **GitHub Actions** and retain the data branch. Pushes to `main` publish after validation, and the Pages workflow also accepts manual dispatch. There is one production environment and no preview branch. The retired `/api/cron/history` endpoint no longer exists. Five-minute sampling cannot establish continuous uptime or detect every short interruption.

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

The status page does not sign into user accounts, retrieve VPN subscriptions, modify infrastructure, or query management APIs with administrator credentials. All HTTP targets are fixed in collector code. Feed authentication is sent only to the configured feed URL. Public output contains component IDs, statuses, measured latency, observation times, history, and incident reports. Svelte escapes visible copy; CSP restricts scripts, connections, and fonts to the same origin.
