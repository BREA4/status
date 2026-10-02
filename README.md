# Breach status

A small bilingual status page built with Bun, SvelteKit 3, Svelte 5, and TypeScript. It shows Breach website services, the Moscow control plane, and the Amsterdam and Riga VPN edges. The catalog follows BREA4/vpn-web and the redacted production documentation linked by that repository.

Production: [breach-status.vercel.app](https://breach-status.vercel.app). Vercel project `gridness-projects/breach-status` is connected to this repository's `main` branch.

## Run

```sh
bun install --frozen-lockfile
bun run dev
```

English or Russian is selected from `Accept-Language` before the first render. The language buttons save an override in a one-year preference cookie. No account or analytics cookies are used. Fonts are served locally.

## Monitoring

Public HTTPS checks run for `https://brea4.space/` and its password sign-in page. These checks confirm HTTP reachability and expected page content. They do not claim that signing in, managing an account, routing traffic, or establishing a VPN session works.

Other components display **No data** until connected to an observation feed. No node addresses, account credentials, or VPN secrets are included in this repository. A monitor should perform the actual protocol checks from the networks that matter to users.

See [docs/monitoring.md](docs/monitoring.md) for the feed contract, all component IDs, freshness rules, and incident publishing. Daily history is displayed only when supplied by a monitor; this stateless app does not invent or retain uptime history.

## Validate

```sh
bun run check
bun test tests
bun run build
bunx playwright install chromium
bun run test:e2e
```

GitHub Actions runs the same checks on pushes and pull requests. Browser tests cover desktop and mobile, language detection and persistence, filters, component details, refresh failures, stale data, and incidents.

To check a deployment, set `STATUS_E2E_BASE_URL=https://breach-status.vercel.app` when running `bun run test:e2e`. The tests make read-only requests and simulate status changes inside the test browser.

## Deploy from GitHub

Import `BREA4/status` in Vercel, choose the SvelteKit framework, and use `main` as the production branch. `vercel.json` sets Bun installation and the build command. The adapter produces Node.js 22 serverless functions.

The Vercel GitHub app needs access to the repository. Vercel's plan must allow importing a private organization repository. Keep the repository private. Optional server environment variables are listed in `.env.example`; never prefix the feed token with `PUBLIC_`.

After import, pushes to `main` deploy to production and pull requests receive preview deployments. No monitoring feed is required to build or deploy; public website probes work by default.
