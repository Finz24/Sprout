# Development foundation

This environment runs a React/Vite screen, an Effect API, an idle Effect worker,
and PostgreSQL with pgvector. Better Auth provides private owner access; the
sidebar, empty library, search and unselected inspector provide the navigation
shell. Saving, AI, queue processing and deployment remain later work. Worker readiness proves its initialized
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

Before starting the API, supply `BETTER_AUTH_SECRET` (32+ characters) through the
process environment. Keep the same secret across API restarts to preserve signed
sessions. `AUTH_ORIGIN` is the exact browser origin (default
`http://127.0.0.1:5173`). HTTPS origins use secure cookies. There is no committed
secret, automatic account creation, public signup or HTTP provisioning endpoint.
Use a secret manager to inject the signing secret; do not put it in an env file.

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

## Provision the owner

After migrations, run `corepack pnpm owner:bootstrap` locally with
`SPROUT_OWNER_EMAIL`, `SPROUT_OWNER_NAME` and `SPROUT_OWNER_PASSWORD` supplied
through the environment. The password must contain at least 12 characters.
Bootstrap hashes it with Better Auth's password adapter and atomically creates
the user, credential account and private workspace. An advisory transaction lock
prevents concurrent provisioning; a populated installation is rejected without
changing the existing owner. It never prints credentials. Clear the provisioning
variables afterward. In PowerShell, read a password without putting it in shell
history:

```powershell
$env:SPROUT_OWNER_EMAIL = Read-Host 'Owner email'
$env:SPROUT_OWNER_NAME = Read-Host 'Owner name'
$env:SPROUT_OWNER_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host 'Owner password' -AsSecureString)).Password
corepack pnpm owner:bootstrap
Remove-Item Env:SPROUT_OWNER_PASSWORD, Env:SPROUT_OWNER_EMAIL, Env:SPROUT_OWNER_NAME
```

Sessions live in PostgreSQL, expire after an absolute 24 hours by default, and
survive browser reload and API restart with the same signing secret. Set
`SESSION_TTL_SECONDS` (1 to 604800) to choose another lifetime. Cookie caching and
sliding refresh are disabled; logout revokes the stored session. The GUI clears
expired sessions and revalidates on window focus. Public signup stays disabled.

Every private API operation calls the exported `WorkspaceAccess` boundary, which
independently resolves the authenticated session. The database operation resolves
that live token again in a transaction under `sprout_private`, a non-superuser,
non-BYPASSRLS role. Forced row security on the workspace ownership anchor uses
the session token, never an owner-ID header or worker identity. `SET LOCAL` role
and token scope end on commit or rollback; failed rollback destroys the pooled
connection. The worker exposes health only and has no private HTTP operations.
Future feature tables and worker publication must enforce equivalent ownership;
this issue does not authorize jobs or implement Saved-item storage. The local
trust-authenticated development administrator is for migrations/bootstrap/auth,
not a deployment or untrusted SQL security boundary.

## Isolated worktree verification

Use a unique Compose project and different loopback ports. Named volumes follow
the project name. Never use another thread's project or reset its data. For local
apps with isolated container PostgreSQL:

```powershell
$env:POSTGRES_PORT = '55439'
$env:API_PORT = '3103'
$env:WORKER_PORT = '3104'
$env:WEB_PORT = '5183'
$env:DATABASE_URL = 'postgresql://sprout@127.0.0.1:55439/sprout'
$env:AUTH_ORIGIN = 'http://127.0.0.1:5183'
$env:API_PROXY_URL = 'http://127.0.0.1:3103'
docker compose -p sprout-issue3-private up -d --pull never postgres
corepack pnpm migrate
# Supply the signing secret, then run API with PORT=3103 and worker with PORT=3104
# in separate terminals. Vite reads WEB_PORT; API_PROXY_URL points at the local API.
$env:WEB_URL = 'http://127.0.0.1:5183'
$env:API_URL = 'http://127.0.0.1:3103'
$env:WORKER_URL = 'http://127.0.0.1:3104'
$env:SPROUT_TEST_DATABASE = '1'
corepack pnpm test:integration
corepack pnpm test:e2e
```

E2E requires an explicit `DATABASE_URL` and `SPROUT_TEST_DATABASE=1`; use only a
dedicated disposable test database. Setup refuses non-fixture users, provisions
two synthetic users, and generates each run's passwords in memory. It does not
delete/reset existing data. Traces are disabled to avoid persisting passwords or
cookies. Session-expiry tests control only persisted expiry time before observing
the real application's rejection. Desktop keyboard and Galaxy S9+ Chromium touch
emulation cover the shell; physical Galaxy and owner visual review remain manual.

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
worker's live/ready endpoints. E2E exercises private login, reload, logout,
expiry, signup rejection, cross-user isolation and the empty navigation shell on
desktop and Galaxy touch emulation. CI has separate
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

Better Auth **1.6.23** is pinned. Its optional test-utils Vitest peer range predates
the repository's **5.0.3**; a narrowly scoped pnpm peer exception preserves the
existing runner without relaxing other dependency checks. Production auth does
not import Vitest. Prepare the updated pnpm store/images before going offline;
`corepack pnpm install --offline --frozen-lockfile` remains supported once prepared.
