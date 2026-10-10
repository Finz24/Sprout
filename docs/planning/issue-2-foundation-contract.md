<!-- sprout-ticket-v1:01 -->

**Module:** Foundation · **Draft ticket:** 01 · **Category:** enhancement
**Parent:** https://github.com/Finz24/Sprout/issues/1
**Stories:** No direct product story; enables subsequent implementation issues.

Owner-selected development contract, October 10, 2026. This replaces the earlier generated stack and whole-product verification wording, including the historical Agent Brief. The accepted architecture is Option C, recorded in `docs/adr/0004-effect-api-and-worker.md`.

## What to build

Initialize a reproducible strict TypeScript pnpm/Nx workspace with a React/Vite/TanStack Router GUI, shared shadcn-style UI/Tailwind/Motion, separate Effect HTTP API and idle Effect worker, and PostgreSQL/Drizzle/pgvector. Deliver a complete development environment for subsequent issues.

## Definition of Done

- [ ] Pin Node via nvm-windows, Corepack, pnpm, Nx and compatible dependencies; commit a frozen lockfile and verify install/build/check from the repository.
- [ ] Render a simple navigable UI, including reload and mobile/desktop screen sanity.
- [ ] Apply committed Drizzle migrations through a one-shot Compose prerequisite and an explicit local command; failed migrations block API/worker startup. Prove pgvector is installed. Never automatically generate migrations or reset data.
- [ ] API and the actual idle worker expose liveness and bounded readiness checks for PostgreSQL connectivity, committed migration state and pgvector. Dependency failure produces unready responses and recovery restores readiness, without leaking credentials.
- [ ] Full Compose builds from repository code, with persistent private volumes. Support local GUI/API/worker plus containerized PostgreSQL. Compose Watch propagates source edits and rebuilds dependency changes. Restart preserves migration/data state.
- [ ] Separate CI stages run quality, build, meaningful tests, integration health checks and e2e screen sanity. Format, lint, typecheck, forbidden public imports, cycles and broken checks fail appropriately. Affected tasks include consumers and safely handle a missing base commit. Cache finite Nx tasks locally; no Nx Cloud requirement.
- [ ] Preserve Git history and exclude secrets, generated output and local state. Document public package contracts and shared UI conventions without global skill/configuration changes.
- [ ] Document initial network preparation and cached/offline packages, browser assets and Docker images. Prepared startup requires no downloads or CDN assets. Record exact compatible tools and versions.

## Blocked by

None. Start here.

## Verification

Run formatting, lint, typecheck, meaningful unit tests, build, integration health checks and Playwright screen sanity. Demonstrate committed migrations, pgvector, dependency failure/recovery, restart persistence and Watch edit propagation. Expectations come from requirements and independent invariants. Static failure models are design evidence, not runtime stress or throughput results.

## Deferred scope

Development only: deployment, Cloudflare Tunnel, Galaxy/device validation and backups are not mandatory in this issue. Do not install Better Auth or AI SDK yet. Pg-boss/job initialization belongs to the processing issue; the worker performs no real jobs, diagnostic processing or provider calls. Login, durable capture, owner isolation and complete save-to-use tests remain mandatory in their respective product slices, rather than foundation acceptance. No live credentials, paid providers or production data are required.
