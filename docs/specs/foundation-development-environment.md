# Foundation development environment

Scope decisions for [issue #2](https://github.com/Finz24/Sprout/issues/2), recorded October 8 and finalized with the owner's Option C selection on October 10, 2026. This defines acceptance; it is not an implementation-complete claim.

## Confirmed scope

Issue #2 delivers a working development foundation for subsequent issues. Completion demonstrates a simple web UI page, successful migrations, available pgvector, a running Docker Compose environment, a server health check, and CI with distinct stages.

Support both local GUI/API/worker development with containerized dependencies and a full Compose environment built from this repository's code. Use Compose Watch so source edits update the running development environment. Pin a compatible Compose version and document the watch startup command.

The environment is development-only. Deployment can proceed separately and is not a completion prerequisite. Live model-provider credentials, paid calls, a deployed hostname, and Cloudflare Tunnel setup are not required for this issue.

The accepted stack is React/Vite/TanStack Router, shared shadcn-style UI/Tailwind/Motion, a separate Effect HTTP API and Effect worker, and PostgreSQL/Drizzle/pgvector in a strict TypeScript pnpm/Nx workspace. Actual login, durable capture, AI processing, and Galaxy/tunnel validation remain assigned to their existing feature issues. [ADR 0004](../adr/0004-effect-api-and-worker.md) replaces the previous Next.js composition.

Do not install Better Auth or AI SDK packages in issue #2. Their initialization belongs to their dedicated issues.

The worker must report readiness only. Processing jobs, real data, or diagnostic work is not required. API and worker readiness declare and check PostgreSQL connectivity, the committed migration state and pgvector availability, with bounded checks and safe failure reasons. Liveness remains available when dependencies fail. Pg-boss initialization belongs to the processing issue; do not report queue readiness before it exists. File/provider checks are added when implemented features require those dependencies.

Use a one-shot migration service before API/worker startup in Compose. Failed migrations block dependent startup. Local development has an explicit migration command. Apply committed migrations only; do not automatically generate migrations or reset data.

Create packages only for current responsibilities: web, API and worker applications, shared UI, database infrastructure, health transport contracts and backend runtime composition. Add domain modules as feature issues introduce behavior. Browser code uses public browser-safe contracts; Effect owns the backend service graph rather than a second dependency-injection system.

CI has distinct quality, build, test, integration-test, and end-to-end stages. Integration tests currently cover health checks only; end-to-end tests cover screen sanity only. Do not expand these stages into job execution or product journeys. Keep meaningful tests appropriate to the foundation and avoid artificial tests merely to populate a stage.

## Reproducibility and evidence

Pin Node, Corepack, pnpm, framework dependencies and container images; commit the lockfile. Enforce public imports and an acyclic workspace graph. Nx caches finite build/check tasks, includes affected consumers and falls back safely when a base commit is missing. No Nx Cloud is required.

Document initial network preparation and offline package, browser and Docker image caches. Prepared startup uses local assets and never requires a CDN or package download. Preserve PostgreSQL state across restarts and keep private files in persistent storage. The development environment carries no production data or provider credentials.

Runtime verification must demonstrate UI navigation/reload, successful committed migrations and pgvector, healthy API/worker, dependency failure and recovery, restart persistence and source-edit propagation through Compose Watch. Static architecture failure modeling is useful design evidence, but does not substitute for these runtime checks or measured load testing.
