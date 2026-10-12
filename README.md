# Breach status

A small bilingual status page built with Bun, SvelteKit 3, Svelte 5, and TypeScript. It shows Breach website services, macOS software updates, the Moscow control plane, and the Amsterdam and Riga VPN edges. The catalog follows BREA4/vpn-web and BREA4/apple-app, including the redacted production documentation linked by vpn-web.

Production: [brea4.github.io/status](https://brea4.github.io/status/). GitHub Pages serves a static build from `main`. GitHub Actions collects observations every five minutes, whether anyone visits or not. There is one production environment.

## Run

```sh
bun install --frozen-lockfile
bun run dev
```

Static HTML uses English. After hydration, the browser selects English or Russian from its language preferences or the one-year preference cookie. No account or analytics cookies are used. Fonts are served locally.

Appearance follows the device's light or dark theme by default, including changes while the page is open. The theme dropdown offers Light, System, and Dark choices. An explicit choice is saved in local storage and applied before the first paint; System clears the override. Switching remains available if storage is blocked. Both dropdowns support arrow keys, Home, End, typing an option's first letter, Escape, and outside-click dismissal.

## Feature settings

Edit `src/data/features.json` to change boolean service and UI settings. `service-<component-id>: false` stops the component's probes and hides its row, history, and incident references. Saved history stays on the `monitoring-data` branch and becomes visible if the service is enabled again. `theme-selector` controls the appearance dropdown, and `contact-support` controls the support card.

The migration preserves the last production settings: routing, support, and the Amsterdam components are hidden, appearance selection is disabled, and the support card is hidden. Missing service settings default to on, appearance selection defaults to on, and the support card defaults to off. Push configuration changes to `main`; a validated push triggers publication. Open pages apply service visibility on their next status poll. UI settings apply on the next page load.

The site has no analytics integration and no Vercel runtime dependencies.

## Monitoring

Public HTTPS checks run for `https://brea4.space/` and its password sign-in page. These checks confirm HTTP reachability and expected page content. They do not claim that signing in, managing an account, routing traffic, or establishing a VPN session works.

The app update server check follows [Breach's Sparkle feed on GitHub Pages](https://brea4.github.io/apple-app-update-server/appcast.xml) and downloads hosted in [GitHub Releases](https://github.com/BREA4/apple-app-update-server/releases). It validates the RSS appcast, signed enclosure metadata, and matching build/channel identities, then checks the newest published stable and beta ZIP sizes using HEAD requests. GitHub's asset redirects are validated before each request. Retained older releases do not add archive requests. It transfers no release archives and does not verify signatures or perform a macOS installation. A beta-only feed is valid; an empty feed remains unknown until a release is available.

The control API check calls the deployed web gateway at `https://brea4.space/api/v1/public/capabilities` and validates the Go API's boolean capability contract. The profile delivery check validates `{"status":"ready"}` from `https://sync.fatconfig.space/readyz`. These contracts come from the current Go control-plane code in [vpn-backend PR #2](https://github.com/BREA4/vpn-backend/pull/2), rather than the older backend on `main`, and both endpoints were verified on the running deployment. These checks establish public API reachability and subscription-service readiness; they do not create sessions, accounts, devices, or subscriptions.

Account, device-management, and VPN protocol components display **No data** until connected to actual authenticated or protocol observations. No node addresses, account credentials, or VPN secrets are included in this repository. A monitor should perform the actual protocol checks from the networks that matter to users. Production uses real outbound requests and has no mock status provider.

Service details show only the 90-day history. A compact status banner pairs the current headline with a colored circle: green for operational, amber for degraded, red for outages, purple for maintenance, and gray for incomplete or unavailable data. It refreshes immediately after hydration, every 60 seconds while visible, and when the tab becomes visible, the window regains focus, or connectivity returns. There is no refresh control, last-checked timestamp, or monitoring counter. The global banner and group summaries use the same rule: mixed healthy and unknown observations show "Monitoring incomplete", all unknown observations show unavailable data, and "All systems operational" requires every enabled service to have a fresh healthy observation. Known failures and active incidents take precedence over incomplete coverage. Individual unmeasured components remain "No data". Failed requests retry in the background, and published checks expire after 15 minutes even if refresh fails. The optional upstream observation feed still requires measurements within five minutes.

The `Monitor and publish Pages` workflow runs at minutes 2, 7, 12, and so on. It reads `history.json` from the `monitoring-data` branch, runs the public checks, and commits changed daily summaries back to that branch. It then builds and deploys the static page and `/status/api/status.json`. Jobs are serialized so an older check cannot overwrite newer history or a deployment.

Each of the last 90 UTC days keeps its worst recorded status. Recovery and inconclusive checks cannot erase an outage. Recorded inconclusive days use a solid gray bar; only dates with no observations use striped gaps. The uptime percentage averages available recorded days, preferring measured percentages when supplied. Otherwise operational and degraded days count as available, and outage or maintenance days count as unavailable. Missing and unknown days without a measured percentage are excluded. These are daily summaries, not continuous time-based uptime.

The old production export is retained in `src/data/history-seed.json` and seeded into the data branch. It contains October 4–6, 2026; October 7–11 had no saved records and cannot be reconstructed. Local development and browser tests never write to the production data branch.

See [docs/monitoring.md](docs/monitoring.md) for workflow setup, the feed contract, component IDs, freshness rules, and incident publishing. Preview and local development do not write to production history.

## Validate

```sh
bun run check
bun test tests
STATUS_FEATURES_FILE=tests/features-enabled.json bun run build
bun run test:static
bunx playwright install chromium
bun run test:e2e
bun run test:flags
```

GitHub Actions runs these checks on pushes to `main` and pull requests. Tests cover desktop and mobile, language persistence, themes, service settings, stale data, incidents, and filled history bars for outage and inconclusive days. `test:flags` builds the disabled-settings fixture and verifies it independently, including without JavaScript.

For a deployment, run the relevant tests with `STATUS_E2E_BASE_URL=https://brea4.github.io/status/`. The full theme suite uses the enabled-settings fixture; production currently disables appearance selection.

## Deploy with GitHub Pages

Configure repository Settings → Pages → Source as **GitHub Actions**. Initialize a `monitoring-data` branch containing a validated version-1 `history.json`, using `src/data/history-seed.json` for an initial migration. Keep that branch: it is the durable history store.

The `.github/workflows/pages.yml` workflow publishes after a successful validation of `main`, on its five-minute schedule, or through **Run workflow**. It uses the Pages-provided base path, uploads only `build/`, and publishes with the built-in GitHub token. Optional `STATUS_FEED_URL` can be a repository variable or secret; `STATUS_FEED_TOKEN` must be a repository secret. Credentials are passed only to the collection step and never to the static build.

GitHub schedules can be delayed or dropped during load. The browser polls the published JSON every 60 seconds, but checks run every five minutes. After 15 minutes without a fresh observation, the current status becomes unknown while recorded history remains visible. Five-minute samples can miss shorter interruptions. In public repositories, GitHub disables scheduled workflows after 60 days without repository activity; daily history commits normally provide activity while monitoring remains enabled.

To collect locally without changing production:

```sh
mkdir -p .monitoring
cp src/data/history-seed.json .monitoring/history.json
bun --env-file=.env run monitor
BASE_PATH=/status bun run build
BASE_PATH=/status bun run test:static
```

Omit `--env-file` if no feed credentials are configured. The collector writes only to the ignored `.monitoring` directory. Invalid or unreadable history aborts publication instead of replacing the existing archive.
