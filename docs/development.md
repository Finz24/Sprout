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
The workflow documentation check requires Python 3 with no third-party packages.

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

From the repository root, run the offline preflight before development:

```powershell
node scripts/check-environment.mjs
node scripts/check-environment.mjs --runtime
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

## Isolate a worktree

The default project remains `sprout`, including `sprout_postgres-data` and
`sprout_originals`. Keep that identity when resuming existing development data.
Changing project identity selects different volumes. It does not migrate data.

For concurrent worktrees, explicitly choose a unique `COMPOSE_PROJECT_NAME` and
four unused host ports. Reuse that choice in every terminal for the worktree.
Compose also accepts `-p`, which takes precedence over `COMPOSE_PROJECT_NAME`.
Application image tags include the selected project name so builds in one
worktree do not replace another worktree's tags. The four `SPROUT_*_PORT`
variables change loopback host bindings only. Container ports and internal URLs
stay fixed. Defaults are database 54329, API 3001, worker 3002, and web 5173.

Set this example in each terminal before running Compose, local apps, migrations,
or tests. Choose different values if another worktree already uses these ports:

```powershell
$env:COMPOSE_PROJECT_NAME = 'sprout-bc5fe128'
$env:SPROUT_DB_PORT = '55439'
$env:SPROUT_API_PORT = '3103'
$env:SPROUT_WORKER_PORT = '3104'
$env:SPROUT_WEB_PORT = '5183'
$env:DATABASE_URL = "postgresql://sprout@127.0.0.1:$($env:SPROUT_DB_PORT)/sprout"
$env:API_URL = "http://127.0.0.1:$($env:SPROUT_API_PORT)"
$env:WORKER_URL = "http://127.0.0.1:$($env:SPROUT_WORKER_PORT)"
$env:WEB_URL = "http://127.0.0.1:$($env:SPROUT_WEB_PORT)"
node scripts/check-environment.mjs
docker compose config --quiet
```

The preflight validates project syntax and distinct port numbers. It does not
load Compose `.env` files or observe a later `-p` flag. Use `docker compose config`
to inspect those resolved settings. It does not reserve ports or infer whether
another worktree owns a database. Check the project and URLs before migrations
or tests. Integration tests use `API_URL` and
`WORKER_URL`; Playwright uses `WEB_URL`. Local database commands use `DATABASE_URL`.
Compose supplies its own internal database URL. These exported local URLs do not
change container-to-container routing. Open `WEB_URL` for the selected worktree.

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

For an isolated worktree, set the project, ports, and URLs above before starting
PostgreSQL or migrating. Run local services in separate terminals with those
same settings. Use these commands instead of `pnpm dev` to select separate ports:

```powershell
$env:HOST = '127.0.0.1'
$env:PORT = $env:SPROUT_API_PORT
corepack pnpm exec tsx watch --conditions=development apps/api/src/main.ts
```

```powershell
$env:HOST = '127.0.0.1'
$env:PORT = $env:SPROUT_WORKER_PORT
corepack pnpm exec tsx watch --conditions=development apps/worker/src/main.ts
```

```powershell
$env:API_PROXY_URL = $env:API_URL
corepack pnpm exec vite --config apps/web/vite.config.ts apps/web --host 127.0.0.1 --port $env:SPROUT_WEB_PORT
```

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
corepack pnpm check:affected
corepack pnpm test:integration
corepack pnpm test:e2e
```

Quality checks formatting, lint, public package boundaries, workspace cycles and
TypeScript. Nx caches builds locally and includes dependent projects in affected
checks. `check:affected` uses Nx's public CLI; set `NX_BASE` to choose its base
revision. CI checks every project when its base revision is unavailable.
Unit tests cover readiness failure semantics, migration history, configuration
and the configured import boundaries. Vitest integration tests check the API and
worker's live/ready endpoints. E2E currently exercises
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

The image export example uses the default `sprout` project. For an explicit
worktree project, substitute its project name in all four application image
tags, and load and start with that same `COMPOSE_PROJECT_NAME`. Transfer prepared
Node and Corepack installers or caches as well as the pnpm store. Once prepared,
`node scripts/check-environment.mjs --runtime` checks prerequisites offline.

An image rebuild after dependency changes requires those dependencies in the
build environment. Offline startup uses the already-built image; it does not run
an install, pull a browser, or fetch CDN assets. Keep the offline bundle outside
Git and never include secrets or development database data in it.
