# Development foundation

This environment runs a React/Vite private library shell, an Effect API with
Better Auth, an idle Effect worker, and PostgreSQL with pgvector. Provider
integration, saved items, queue processing, and deployment remain future work. Worker readiness proves its initialized
database dependencies; it does not enqueue or process diagnostic jobs.

## Tools and first preparation

Use nvm-windows to select Node **24.21.0**, Corepack **0.36.0**, and the repository's
pnpm **10.34.6**. Docker Desktop with Compose Watch support is required; the current
configuration was prepared with Compose **2.39.4**. Exact dependency versions and
the lockfile are committed. Initial installation and image builds need network
access; ordinary development startup uses the prepared local dependencies.
The workflow documentation check requires Python 3 with no third-party packages.

```powershell
nvm use 24.21.0
npm install --global corepack@0.36.0
corepack prepare pnpm@10.34.6 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm exec playwright install chromium
```

Playwright's browser installation is an explicit preparation step, not a
postinstall or a test-time download. The screen uses local CSS and system fonts.

From the repository root, run the offline preflight before development:

```powershell
node scripts/check-environment.mjs
```

The default checks Node's active version, agreement between `.nvmrc` and
`package.json`, the pnpm declaration, `.npmrc` policy, Dockerfile pins, and the
exported Compose project and host ports. It uses only Node's standard library.
Each JSON result has a name and a `pass` or `fail` status. Any failure exits
nonzero. No check installs tools, downloads assets, or starts services.
The Dockerfile check recognizes the pinned bootstrap and frozen dependency
install used here. Review that check when changing the Dockerfile's tool commands
or introducing additional build stages.

`--runtime` also checks Docker daemon access, Compose configuration, and the
installed Playwright Chromium executable. Each subprocess has a ten-second
timeout. This checks browser files, not whether Chromium can launch. Neither mode
proves service readiness or recovery after a dependency failure. Those require
the running application and remain separate runtime verification.

## Isolated synthetic auth verification

Choose a new project name and four unused ports before starting a workspace.
Never share these values with another worktree. The runner checks runtime
prerequisites before starting services, creates a new synthetic database, applies
committed migrations, and generates credentials only in process environments.
It runs Compose `down` for its selected project when it stops, including after a
failed check. It retains databases and volumes and never resets an installation.

```powershell
$env:COMPOSE_PROJECT_NAME = 'sprout-auth-verification'
$env:SPROUT_DB_PORT = '55439'
$env:SPROUT_API_PORT = '3103'
$env:SPROUT_WORKER_PORT = '3104'
$env:SPROUT_WEB_PORT = '5183'
node scripts/auth-workspace.mjs
```

The default runs local apps with container PostgreSQL, then the real integration
and browser suites. Add `--compose` to build and verify all services in Compose.
Initial image builds can require network access. Prepared image layers and the
platform's package cache are the offline alternative. Host tests still use the
prepared host Playwright Chromium installation in both modes.

Use `--integration-only` or `--e2e-only` for an independent CI suite on a fresh
synthetic database. Both jobs retain their actual test commands. Quality, build,
and unit-test jobs remain separate. The runner owns its synthetic credential
environment and service shutdown, so CI never writes credentials to environment
files or prints raw Compose logs.

Add `--interactive` in an interactive terminal to keep the workspace available.
Commands are `integration`, `e2e`, `check`, `restart`, `restart-runtime`, `status`,
and `stop`. `restart` restarts the API. `restart-runtime` restarts both API and
worker while retaining the database, for persistence verification.
Run integration once on the initially empty database. It provisions two test
owners. E2E then uses the first owner without attempting production bootstrap
on the intentional two-owner fixture. Open the selected loopback web port for
browser inspection. Runtime output is redacted before it reaches the terminal.

The runner restarts the API before each browser project so desktop and mobile
have independent in-memory rate-limit buckets. Both projects exercise the real
sign-in flow with production limits. Their artifacts and `.last-run.json` records
are retained separately under `test-results/desktop` and `test-results/mobile`.

An existing volume requires its original `POSTGRES_PASSWORD` in the parent
process environment. A new project and unused ports avoid changing that volume.
The runner refuses an existing volume without its credential. It does not print
or recover that credential for you.

## Operator-managed development

The synthetic runner is a test utility. For a retained personal installation,
provide credentials through private inherited environment variables. Do not
put them in command arguments, `.env` files, or shell history.

Before starting services, set a unique `COMPOSE_PROJECT_NAME` and distinct
`SPROUT_DB_PORT`, `SPROUT_API_PORT`, `SPROUT_WORKER_PORT`, and `SPROUT_WEB_PORT`.
Provide `POSTGRES_PASSWORD`, `MIGRATION_DATABASE_URL`, `AUTH_DATABASE_URL`,
`API_DATABASE_URL`, `WORKER_DATABASE_URL`, `MAINTENANCE_DATABASE_URL`,
`BETTER_AUTH_SECRET`, and canonical `SPROUT_ORIGIN` privately. Compose database
URLs use the `postgres` service hostname and port 5432. Host-side maintenance
commands use the selected loopback database port instead. Compose accepts no
passwordless database fallback.

Run `corepack pnpm check:runtime` with that environment before services. Start
PostgreSQL, then run the one-shot migration service, which configures separate
SCRAM-authenticated logins. Provision the owner explicitly with
`corepack pnpm auth:bootstrap` using host-side `MAINTENANCE_DATABASE_URL`,
`SPROUT_OWNER_NAME`, `SPROUT_OWNER_EMAIL`, and `SPROUT_OWNER_PASSWORD` in a private
maintenance process. The command hashes before its transaction and creates no
browser session. A complete installation returns `AlreadyProvisioned` without
changing credentials. `InconsistentInstallation` requires operator investigation.
No HTTP registration, bootstrap, or recovery endpoint exists.

Start API, worker, and web only after successful migration and provisioning.
`docker compose up --build --watch` supports source updates after preparation.
API receives its private-data login, auth login, and signing secret. Worker
receives only its own readiness login. Migration, maintenance, owner, and
PostgreSQL administrator credentials must never enter either serving process.
Local API and worker reject these privileged environment variables at startup.

For local apps, use `DATABASE_URL` for that process's runtime login, `PORT`, and
`HOST`. API additionally needs `AUTH_DATABASE_URL`, `BETTER_AUTH_SECRET`, and
`SPROUT_ORIGIN`. Set `SPROUT_LOOPBACK_DEVELOPMENT=true` only for an explicit
loopback HTTP origin. Vite uses `API_PROXY_URL`; it preserves `/api/auth` and
rewrites only `/api/health`. HTTPS ingress and real Galaxy access require
separate cookie and device evidence.

## Migrations and readiness

`corepack pnpm db:generate` creates a reviewed migration for intentional schema
changes. `corepack pnpm migrate` applies committed files under an advisory lock;
it neither resets the database nor generates schemas on startup. The initial
migration enables pgvector. For full Compose after changing migrations, run:

```powershell
docker compose build migrate api worker
docker compose run --rm migrate
docker compose up -d api worker
```

Each backend exposes `/health/live` (the HTTP process is serving) and
`/health/ready`. Ready checks a bounded PostgreSQL query, the complete ordered
Drizzle migration history, and the installed vector extension. Failed dependencies
return HTTP 503 with named statuses, without connection strings or SQL errors.
The worker requires only these database dependencies until durable processing is
initialized in its own issue. Database failure keeps liveness available and makes
readiness fail; connectivity recovery permits readiness to recover automatically.

## Verification

The workspace has applications `web`, `api`, and `worker`, and shared packages
`ui`, `contracts`, `database`, and `runtime`. Cross-package imports use public
`@sprout/*` exports. Web may import UI and browser-safe contracts; API and worker
compose runtime services; runtime may import contracts and database. Backend
dependencies and Node built-ins cannot enter UI, web, or contracts. Nx's ESLint
rules enforce the project graph and reject workspace dependency cycles. Use
`import type` declarations rather than inline `import()` types so the boundary
rules can validate type dependencies too. Future domain modules should be added
by their owning issue.

Typed ESLint checks reject unhandled promises, unsafe values and narrowing
assertions, and non-null assertions. Source imports across supported JavaScript
and TypeScript extensions follow the same ownership rules. Inline ESLint
configuration cannot disable these checks. The policy tests exercise rejected
code and permitted dependencies through the installed linter. Typed probes use
in-memory text against existing project files and do not write to source trees.

UI components share semantic Tailwind tokens through `packages/ui`; the initial
Button is a source-owned shadcn-style component. Prefer these tokens and public
components over screen-specific duplicate primitives. Motion is configured to
respect the user's reduced-motion preference; this foundation screen introduces
no unnecessary animations. Fonts and assets must remain locally available.

```powershell
corepack pnpm check
corepack pnpm run doctor
corepack pnpm check:affected
corepack pnpm test:integration
corepack pnpm test:e2e
```

Quality checks formatting, lint, React Doctor, public package boundaries,
workspace cycles and TypeScript. `doctor` scans the full React workspace and
fails on warnings or errors. It uses pinned React Doctor 0.9.18, disables
telemetry and the network-backed supply-chain scan, and limits lint workers
within each project. React Doctor can still scan multiple projects concurrently.
Prepare its platform-specific dependencies during installation before going offline.
It runs inside both `check` and the required CI `quality` job.
Nx caches builds locally and includes dependent projects in affected
checks. `check:affected` uses Nx's public CLI; set `NX_BASE` to choose its base
revision. CI checks every project when its base revision is unavailable.
Unit tests cover readiness failure semantics, migration history, configuration,
and import boundaries. Integration tests exercise real PostgreSQL roles,
bootstrap, sessions, RLS, pool cleanup, and outages. Browser tests exercise the
sign-in and shell journeys on desktop and mobile viewports. Auth traces are
disabled because trace network bodies can retain passwords. Screenshots capture
only the authenticated shell and contain no credentials. CI has separate
quality, build, test, integration and E2E jobs; there is no deployment stage.

## Prepared offline use

Before going offline, install dependencies for the target OS, build/pull the
Docker images, and explicitly install Playwright Chromium for that OS. Native
Node and browser artifacts are OS-specific; Windows node_modules cannot be
copied into Linux containers. Transfer the repository via a Git bundle, the
pnpm store plus Corepack cache, and the platform's Playwright browser cache when
preparing another machine. For an existing installation:

```powershell
corepack pnpm install --offline --frozen-lockfile
docker image save -o sprout-development-images.tar sprout-api-development:local sprout-worker-development:local sprout-web-development:local sprout-migrate-development:local pgvector/pgvector:0.8.1-pg17-bookworm
# On the prepared recipient: docker image load -i sprout-development-images.tar
docker compose up --pull never --no-build --watch
```

The image export example uses the default `sprout` project. For an explicit
worktree project, substitute its project name in all four application image
tags, and load and start with that same `COMPOSE_PROJECT_NAME`. Transfer prepared
Node and Corepack installers or caches as well as the pnpm store. Once prepared,
`node scripts/check-environment.mjs --runtime` checks prerequisites offline.

An image rebuild after dependency changes requires those dependencies in the
build environment. Offline startup uses the already-built image; it does not run
an install, pull a browser, or fetch CDN assets. Keep the offline bundle outside
Git and never include secrets or development database data in it.
