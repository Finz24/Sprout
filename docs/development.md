# Development foundation

This environment runs a React/Vite screen, an Effect API, an idle Effect worker,
and PostgreSQL with pgvector. It deliberately has no login, provider integration,
queue processing, or deployment setup yet. Worker readiness proves its initialized
database dependencies; it does not enqueue or process diagnostic jobs.

## Tools and first preparation

Use nvm-windows to select Node **24.21.0**, Corepack **0.36.0**, and the repository's
pnpm **10.34.6**. Docker Desktop with Compose Watch support is required; the current
configuration was prepared with Compose **2.39.4**. Exact dependency versions and
the lockfile are committed. Initial installation and image builds need network
access; ordinary development startup uses the prepared local dependencies.

```powershell
nvm use 24.21.0
npm install --global corepack@0.36.0
corepack prepare pnpm@10.34.6 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm exec playwright install chromium
docker compose build
```

Playwright's browser installation is an explicit preparation step, not a
postinstall or a test-time download. The screen uses local CSS and system fonts.

## Full Compose development

```powershell
docker compose up --build --watch
```

Open <http://127.0.0.1:5173>. API and worker listen on loopback ports 3001 and 3002.
For detached startup, run `docker compose up -d --build --wait`, then run
`docker compose watch --no-up` in a separate terminal to enable source updates.
Compose starts PostgreSQL, applies committed migrations once, then starts the API
and worker. Failed migrations block startup. Application source edits are synced
to the running Linux containers; Vite and tsx reload them. Dependency manifest or
lockfile edits rebuild images rather than syncing host node_modules.

PostgreSQL uses a persistent named volume. The originals volume reserves private
local storage for a later issue; the foundation does not write originals. This
development-only PostgreSQL configuration uses trust authentication on the
private Compose network and a **loopback-only** host binding at port 54329. Use
only disposable development data; deployment and real credentials are a later
decision. No password is embedded in the repository.

`docker compose stop` preserves data. Do not use `down --volumes` to restart.

## Local apps with container PostgreSQL

```powershell
docker compose up -d postgres
corepack pnpm migrate
corepack pnpm dev
```

Local defaults point at the loopback database. Optional `DATABASE_URL`, `PORT`,
`HOST`, and `DATABASE_POOL_SIZE` come from environment variables. API and worker
use different default ports. `API_PROXY_URL` controls Vite's API proxy. Never
commit environment files or connection credentials.

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
`/health/ready`. Ready checks a bounded PostgreSQL query, the latest committed
Drizzle migration hash, and the installed vector extension. Failed dependencies
return HTTP 503 with named statuses, without connection strings or SQL errors.
The worker requires only these database dependencies until durable processing is
initialized in its own issue. Database failure keeps liveness available and makes
readiness fail; connectivity recovery permits readiness to recover automatically.

## Verification

The workspace has applications `web`, `api`, and `worker`, and shared packages
`ui`, `contracts`, `database`, and `runtime`. Cross-package imports use public
`@sprout/*` exports. Web may import UI and browser-safe contracts; API and worker
compose runtime services; runtime may import contracts and database. Backend
dependencies and Node built-ins cannot enter UI, web, or contracts. Import cycles
fail quality checks. Future domain modules should be added by their owning issue.

UI components share semantic Tailwind tokens through `packages/ui`; the initial
Button is a source-owned shadcn-style component. Prefer these tokens and public
components over screen-specific duplicate primitives. Motion is configured to
respect the user's reduced-motion preference; this foundation screen introduces
no unnecessary animations. Fonts and assets must remain locally available.

```powershell
corepack pnpm check
corepack pnpm check:affected
corepack pnpm test:integration
corepack pnpm test:e2e
```

Quality checks formatting, lint, public package boundaries, import cycles and
TypeScript. Nx caches builds locally and includes dependent projects in affected
checks. If the base revision is absent, the affected wrapper checks every project.
Unit tests cover readiness failure semantics and configuration/import boundaries.
Integration currently checks only live/ready endpoints. E2E currently exercises
the simple screen, navigation and reload on desktop and mobile. CI has separate
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

An image rebuild after dependency changes requires those dependencies in the
build environment. Offline startup uses the already-built image; it does not run
an install, pull a browser, or fetch CDN assets. Keep the offline bundle outside
Git and never include secrets or development database data in it.
