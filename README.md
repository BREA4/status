# Breach status

A small bilingual status page built with Bun, SvelteKit 3, Svelte 5, and TypeScript. It shows Breach website services, macOS software updates, the Moscow control plane, and the Amsterdam and Riga VPN edges. The catalog follows BREA4/vpn-web and BREA4/apple-app, including the redacted production documentation linked by vpn-web.

Production: [breach-status.vercel.app](https://breach-status.vercel.app). Vercel project `gridness-projects/breach-status` is connected to this repository's `main` branch.

Pre-production: [breach-status-git-pre-prod-gridness-projects.vercel.app](https://breach-status-git-pre-prod-gridness-projects.vercel.app), deployed from `pre-prod` using Vercel's Preview environment. It requires access through the project's existing Vercel deployment protection.

## Run

```sh
bun install --frozen-lockfile
bun run dev
```

English or Russian is selected from `Accept-Language` before the first render. The language dropdown saves an override in a one-year preference cookie. No account or analytics cookies are used. Fonts are served locally.

Appearance follows the device's light or dark theme by default, including changes while the page is open. The theme dropdown offers Light, System, and Dark choices. An explicit choice is saved in local storage and applied before the first paint; System clears the override. Switching remains available if storage is blocked. Both dropdowns support arrow keys, Home, End, typing an option's first letter, Escape, and outside-click dismissal.

## Feature flags

Each component has a boolean `service-<component-id>` flag in the project's [Vercel Flags dashboard](https://vercel.com/gridness-projects/breach-status/flags). For example, `service-website`, `service-amsterdam-reality`, and `service-update-server` control the website, Amsterdam VLESS Reality, and macOS update server. [docs/monitoring.md](docs/monitoring.md) lists every component ID.

Turn a service flag off to stop its probes and remove its row, history, API observations, and incident references. Groups with no enabled components disappear. Disabled components cannot affect the overall headline. Page loads and status polls use the same flags, and snapshot caches distinguish enabled service sets. Open pages apply service changes on their next successful poll.

The boolean [`theme-selector`](https://vercel.com/gridness-projects/breach-status/flag/theme-selector) flag controls the appearance dropdown. When off, the dropdown disappears and the page uses light mode from the server render onward, including before hydration and without JavaScript. Device preferences and saved dark overrides are ignored. The saved preference is retained for when the flag is enabled again. Theme changes apply on the next page load.

Service and theme flags default to on if credentials are absent, a flag is missing, or the provider is unavailable. The contact card defaults to off. Only boolean provider values are accepted. New service and theme flags are initialized on in Development, Preview, and Production to preserve the existing page behavior. Configure environments independently with no targeting rules or percentage rollout.

To create missing flags in the linked Vercel project:

```sh
bun run flags:configure
```

This command creates the definitions from `src/lib/features.ts` and applies their default values to all three environments. It preserves existing flags and settings.

The support card is hidden by default. The boolean `contact-support` flag in the project's [Vercel Flags dashboard](https://vercel.com/gridness-projects/breach-status/flag/contact-support) controls the entire card for all visitors, in both languages. Set the served variant to `false` to hide it or `true` to show it. Configure Production and Preview separately, with no targeting rules or percentage rollout.

The server evaluates flags together using `@vercel/flags-core` and Vercel's request-scoped OIDC credentials. Only the resulting UI booleans and enabled observations reach the browser. No SDK key or new browser cookie is required. Flag definitions refresh every 60 seconds, so a dashboard change applies after propagation without redeploying. Open pages need to reload for contact-card changes. If credentials are absent or the provider cannot initialize, the card stays hidden and the status page still renders.

For local development with Vercel credentials, run `vercel env pull .env.local`, then `bun --env-file=.env.local run dev`. Without credentials, support stays hidden. Browser tests expect support to be off by default. Set `STATUS_E2E_SUPPORT_ENABLED=true` when testing a deployment where the flag is on.

## Analytics

[Vercel Web Analytics](https://vercel.com/gridness-projects/breach-status/analytics) collects page views only when Vercel's `VERCEL_ENV` is `production`. Local development and Preview deployments, including `pre-prod`, do not load the tracker. The integration uses the generic `@vercel/analytics` SDK because its SvelteKit wrapper still depends on `$app/stores`, which SvelteKit 3 removed. The script and collection endpoint use the same origin and fit the existing Content Security Policy.

Page URLs omit query strings and fragments before collection. No custom events are sent. Vercel documents its cookie-free visitor counting in its [Web Analytics privacy documentation](https://vercel.com/docs/analytics/privacy-policy).

## Monitoring

Public HTTPS checks run for `https://brea4.space/` and its password sign-in page. These checks confirm HTTP reachability and expected page content. They do not claim that signing in, managing an account, routing traffic, or establishing a VPN session works.

The app update server check follows [Breach's Sparkle hosting](https://breach-updates.vercel.app/appcast.xml). It validates the RSS appcast and signed enclosure metadata, then checks the availability and expected sizes of all published stable/beta ZIPs using HEAD requests. It transfers no release archives and does not verify signatures or perform a macOS installation. A beta-only feed is valid; the monitor does not assume a stable release has been published.

The control API check calls the deployed web gateway at `https://brea4.space/api/v1/public/capabilities` and validates the Go API's boolean capability contract. The profile delivery check validates `{"status":"ready"}` from `https://sync.fatconfig.space/readyz`. These contracts come from the current Go control-plane code in [vpn-backend PR #2](https://github.com/BREA4/vpn-backend/pull/2), rather than the older backend on `main`, and both endpoints were verified on the running deployment. These checks establish public API reachability and subscription-service readiness; they do not create sessions, accounts, devices, or subscriptions.

Account, device-management, and VPN protocol components display **No data** until connected to actual authenticated or protocol observations. No node addresses, account credentials, or VPN secrets are included in this repository. A monitor should perform the actual protocol checks from the networks that matter to users. Production uses real outbound requests and has no mock status provider.

Service details show only the 90-day history. A compact status banner pairs the current headline with a colored circle: green for operational, amber for degraded, red for outages, purple for maintenance, and gray for incomplete or unavailable data. It refreshes immediately after hydration, every 60 seconds while visible, and when the tab becomes visible, the window regains focus, or connectivity returns. There is no refresh control, last-checked timestamp, or monitoring counter. The global banner and group summaries use the same rule: mixed healthy and unknown observations show "Monitoring incomplete", all unknown observations show unavailable data, and "All systems operational" requires every enabled service to have a fresh healthy observation. Known failures and active incidents take precedence over incomplete coverage. Individual unmeasured components remain "No data". Failed requests retry in the background, and checks expire after five minutes even if refresh fails.

Production records checks in private Vercel Blob storage and retains 90 UTC days. Each day shows its worst observed status. It writes only when a daily summary changes, and conditional writes preserve observations from concurrent function instances. A Vercel Cron job records checks once a day even without visitors; normal page loads and polls record further observations. Unmeasured days remain empty. Uptime percentages appear only when a monitor supplies a measured percentage.

See [docs/monitoring.md](docs/monitoring.md) for storage setup, the feed contract, component IDs, freshness rules, and incident publishing. Preview and local development do not write to production history.

## Validate

```sh
bun run check
bun test tests
bun run build
bun run test:vercel
bunx playwright install chromium
bun run test:e2e
bun run test:flags
VERCEL_ENV=production bun run test:e2e -- e2e/analytics.spec.ts
```

GitHub Actions runs the same checks on pushes and pull requests. Browser tests cover desktop and mobile, language detection and persistence, filters, component details, refresh failures, stale data, and incidents. `test:flags` runs a separate local server with a mocked Vercel provider to verify disabled services and forced light mode. It changes no dashboard flags and adds no application override mechanism.

To check a deployment, set `STATUS_E2E_BASE_URL=https://breach-status.vercel.app` when running `bun run test:e2e`. The tests make read-only requests and simulate status changes inside the test browser.

For protected Preview deployments, set `STATUS_E2E_STORAGE_STATE` to a private Playwright storage-state file containing the deployment's bypass cookie. Keep that file outside the repository. Preview tests do not require disabling deployment protection.

## Deploy from GitHub

Import `BREA4/status` in Vercel, choose the SvelteKit framework, and use `main` as the production branch. `vercel.json` sets Bun installation and the build command. The adapter produces Node.js 22 serverless functions.

The Vercel GitHub app needs access to the repository. Vercel's plan must allow importing a private organization repository. Keep the repository private. Optional server environment variables are listed in `.env.example`; never prefix the feed token with `PUBLIC_`.

After import, pushes to `main` deploy to production and pull requests receive preview deployments. No monitoring feed is required to build or deploy; public website probes work by default.

Push changes to `pre-prod` to update the stable pre-production URL. GitHub Actions validates both `pre-prod` and `main`. After reviewing pre-production, merge `pre-prod` into `main` to publish the same code to production. Vercel rebuilds with the Production environment.

The current Hobby account uses the standard Preview environment for pre-production. Named custom environments require Pro or Enterprise. To add a pre-production-only feed later, scope its environment variables to Preview and the `pre-prod` Git branch, then redeploy that branch. The current pre-production deployment uses public read-only checks and has no monitoring credentials.
