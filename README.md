# Breach status

A small bilingual status page built with Bun, SvelteKit 3, Svelte 5, and TypeScript. It shows Breach website services, the Moscow control plane, and the Amsterdam and Riga VPN edges. The catalog follows BREA4/vpn-web and the redacted production documentation linked by that repository.

Production: [breach-status.vercel.app](https://breach-status.vercel.app). Vercel project `gridness-projects/breach-status` is connected to this repository's `main` branch.

Pre-production: [breach-status-git-pre-prod-gridness-projects.vercel.app](https://breach-status-git-pre-prod-gridness-projects.vercel.app), deployed from `pre-prod` using Vercel's Preview environment. It requires access through the project's existing Vercel deployment protection.

## Run

```sh
bun install --frozen-lockfile
bun run dev
```

English or Russian is selected from `Accept-Language` before the first render. The language dropdown saves an override in a one-year preference cookie. No account or analytics cookies are used. Fonts are served locally.

Appearance follows the device's light or dark theme by default, including changes while the page is open. The theme dropdown offers Light, System, and Dark choices. An explicit choice is saved in local storage and applied before the first paint; System clears the override. Switching remains available if storage is blocked. Both dropdowns support arrow keys, Home, End, typing an option's first letter, Escape, and outside-click dismissal.

## Analytics

[Vercel Web Analytics](https://vercel.com/gridness-projects/breach-status/analytics) collects page views only when Vercel's `VERCEL_ENV` is `production`. Local development and Preview deployments, including `pre-prod`, do not load the tracker. The integration uses the generic `@vercel/analytics` SDK because its SvelteKit wrapper still depends on `$app/stores`, which SvelteKit 3 removed. The script and collection endpoint use the same origin and fit the existing Content Security Policy.

Page URLs omit query strings and fragments before collection. No custom events are sent. Vercel documents its cookie-free visitor counting in its [Web Analytics privacy documentation](https://vercel.com/docs/analytics/privacy-policy).

## Monitoring

Public HTTPS checks run for `https://brea4.space/` and its password sign-in page. These checks confirm HTTP reachability and expected page content. They do not claim that signing in, managing an account, routing traffic, or establishing a VPN session works.

Other components display **No data** until connected to an observation feed. No node addresses, account credentials, or VPN secrets are included in this repository. A monitor should perform the actual protocol checks from the networks that matter to users.

Service details show only the 90-day history. The headline updates every 60 seconds from current reported statuses and active incidents. Partial healthy coverage reads "Monitored services operational"; "All systems operational" requires every component to report. Components without current data remain labeled "No data", and the headline reports unavailable data when no current statuses remain. Checks expire after five minutes even if refresh fails.

See [docs/monitoring.md](docs/monitoring.md) for the feed contract, all component IDs, freshness rules, and incident publishing. Daily history is displayed only when supplied by a monitor; this stateless app does not invent or retain uptime history.

## Validate

```sh
bun run check
bun test tests
bun run build
bun run test:vercel
bunx playwright install chromium
bun run test:e2e
VERCEL_ENV=production bun run test:e2e -- e2e/analytics.spec.ts
```

GitHub Actions runs the same checks on pushes and pull requests. Browser tests cover desktop and mobile, language detection and persistence, filters, component details, refresh failures, stale data, and incidents.

To check a deployment, set `STATUS_E2E_BASE_URL=https://breach-status.vercel.app` when running `bun run test:e2e`. The tests make read-only requests and simulate status changes inside the test browser.

For protected Preview deployments, set `STATUS_E2E_STORAGE_STATE` to a private Playwright storage-state file containing the deployment's bypass cookie. Keep that file outside the repository. Preview tests do not require disabling deployment protection.

## Deploy from GitHub

Import `BREA4/status` in Vercel, choose the SvelteKit framework, and use `main` as the production branch. `vercel.json` sets Bun installation and the build command. The adapter produces Node.js 22 serverless functions.

The Vercel GitHub app needs access to the repository. Vercel's plan must allow importing a private organization repository. Keep the repository private. Optional server environment variables are listed in `.env.example`; never prefix the feed token with `PUBLIC_`.

After import, pushes to `main` deploy to production and pull requests receive preview deployments. No monitoring feed is required to build or deploy; public website probes work by default.

Push changes to `pre-prod` to update the stable pre-production URL. GitHub Actions validates both `pre-prod` and `main`. After reviewing pre-production, merge `pre-prod` into `main` to publish the same code to production. Vercel rebuilds with the Production environment.

The current Hobby account uses the standard Preview environment for pre-production. Named custom environments require Pro or Enterprise. To add a pre-production-only feed later, scope its environment variables to Preview and the `pre-prod` Git branch, then redeploy that branch. The current pre-production deployment uses public read-only checks and has no monitoring credentials.
