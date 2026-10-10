# Sprout architecture comparison

Research and design review, October 9, 2026. **The owner selected Option C on October 10; [ADR 0004](../adr/0004-effect-api-and-worker.md) records acceptance.** The alternatives and static failure review below remain the comparison evidence. Foundation scope stays development-only; selection does not turn the design model into runtime or performance validation.

## What was checked

First-party repository manifests, runtime composition, queue paths and Compose files were inspected at pinned commits. Three research agents covered alternatives, then cross-reviewed the findings. The reports are [Next/RabbitMQ](next-and-rabbitmq-options.md), [Nest/PostgreSQL and Nest/Redis](nest-architecture-options.md), and [Effect](effect-architecture-option.md).

All alternatives were challenged against receipt/job crash consistency, duplicate delivery, worker outage, provider uncertainty, owner correction/Trash races, two-user authorization, partial files, database/broker outage, resource pressure and shutdown. These are static failure reviews, not passing implementation tests or measured throughput results.

An executable [abstract handoff model](architecture-handoff-model.py) explored crash prefixes in two proposed write-order protocols, reused across the five alternatives. It found no acknowledged handoff gap under the declared atomic/durable-write assumptions for the proposed protocols, and demonstrated a counterexample when acknowledgment precedes external-broker publication. It does not prove restart recovery, eventual processing, authorization, file safety, broker restore safety, or performance. Its duplicate-delivery trace is illustrative rather than executed.

## Shared requirements and technologies

- Strict TypeScript, pnpm/Nx workspace, shared shadcn/ui/Tailwind tokens and Motion, Compose Watch, pinned compatible tools and dependencies.
- PostgreSQL for authoritative private records; Drizzle for reviewed migrations and queries; pgvector for future semantic projections. No separate vector service is required by current scope.
- Node filesystem storage behind a private storage contract; a persistent originals volume shared only by authorized backend/worker processes. Files and database writes require staged manifests and reconciliation because they cannot share one transaction.
- Better Auth and AI SDK remain selected future integration candidates, but their packages and initialization are deferred to their dedicated issues. Provider/model choice and extraction tools remain future evaluation, not foundation prerequisites.
- The browser performs immediate HTTP operations; long-running processing runs separately and durably. Every backend/worker operation enforces ownership. Queued payloads and TypeScript types are not authorization.
- Liveness means the process is alive. Readiness declares initialized required dependencies and checks them with bounded timeouts. Optional providers do not make original access unavailable. A worker's health is reported by the actual running process, not an unrelated database probe.
- Single Windows-host Compose does not provide host-failure availability, regardless of framework or broker. Prepared offline startup requires cached dependencies/images/assets; the first preparation needs network access or a transferred cache/image bundle.

## A — Next.js modular application with PostgreSQL jobs

**Technology map:** GUI and HTTP server: Next.js/React on Node. UI: shadcn/ui, Tailwind, Motion. Domain modules: strict TypeScript with runtime schemas. Data: PostgreSQL/Drizzle/pgvector. Durable queue: pg-boss in PostgreSQL. Worker: separate Node process running pg-boss handlers. Files: private filesystem volume. Eventual identity/AI: Better Auth/AI SDK.

**Plain words:** one application serves screens and handles immediate requests; a separate process does slow work. The saved receipt and requested work share a database transaction.

**Advantages:** few runtime boundaries; durable handoff without a separate broker; frontend and server types can share contracts; relevant saved-information precedent.

**Costs/anomalies:** backend conventions must be enforced beyond the web framework; Next-specific request composition can spread into domain code; API and queue contend for PostgreSQL capacity; careless use of request lifetimes or in-memory post-response tasks loses durable work. Heavy extraction still needs bounded subprocesses. Shared packages, separate pool budgets and explicit durable enqueue address those risks.

**Reference:** Karakeep really uses Next.js with independent Node worker runners and has similar crawling/inference/indexing workloads. It uses SQLite/Drizzle plus Liteque/optional Restate, Chrome and Meilisearch, not Sprout's proposed PostgreSQL/pg-boss. Its separation is precedent; its consistency guarantees are not imported. [Web manifest](https://github.com/karakeep-app/karakeep/blob/75aeaaa4eb71b1d3143d7bdc6b88c66fbcfb5fea/apps/web/package.json), [workers](https://github.com/karakeep-app/karakeep/blob/75aeaaa4eb71b1d3143d7bdc6b88c66fbcfb5fea/apps/workers/index.ts).

## B — React/Vite with a NestJS backend and PostgreSQL jobs

**Technology map:** GUI: React/Vite with TanStack Router, shadcn/ui/Tailwind/Motion. HTTP backend: NestJS on Node, one HTTP adapter (Express is the proposed default), REST and streaming where needed. Domain modules/lifecycle: Nest providers plus shared strict-TypeScript operations. Data: PostgreSQL/Drizzle/pgvector. Durable queue: pg-boss. Worker: separate Nest application context on Node; a health-only listener or equivalent process-owned probe supplies readiness without exposing a business API. Files: private filesystem volume. No Effect dependency graph in this candidate.

**Plain words:** the browser, backend and worker have distinct roles. Nest gives both backend processes consistent module and lifecycle conventions; PostgreSQL holds records and processing requests.

**Advantages:** explicit backend ownership independent of the GUI; conventional backend composition; a stable API for future capture clients; retains atomic receipt/job handoff and avoids a second broker.

**Costs/anomalies:** another development application and explicit API schemas/client errors; session/proxy configuration needs care; Nest HTTP guards do not protect standalone worker calls. Domain operations still enforce ownership, revisions and transaction boundaries. A private workspace does not currently require public-page SEO or server rendering, so Vite is viable; Next remains possible if SSR becomes a concrete need.

**Reference:** TREK's React/Vite + Nest/Express split and shared contracts support this application shape. Its database is SQLite and inspected booking-import jobs use a process-local Map/Promise chain, not a durable independent worker. Sprout would deliberately change those parts. [Client](https://github.com/liketrek/TREK/blob/1c05ee4b3ac9523c41ccdd3baad989ba48a7409a/client/package.json), [server](https://github.com/liketrek/TREK/blob/1c05ee4b3ac9523c41ccdd3baad989ba48a7409a/server/package.json), [import jobs](https://github.com/liketrek/TREK/blob/1c05ee4b3ac9523c41ccdd3baad989ba48a7409a/server/src/nest/booking-import/import-jobs.service.ts).

## C — React/Vite with an Effect backend and worker

**Technology map:** GUI: React/Vite/TanStack Router, shadcn/ui/Tailwind/Motion. HTTP backend: Effect HTTP API on Node. Domain contracts and lifecycle: Effect Schema, typed errors/dependencies, Layers and scopes. Worker: separate Node/Effect runtime. Data: PostgreSQL/Drizzle/pgvector. Queue: pg-boss through a narrow adapter. Files: scoped filesystem adapter backed by private persistent volume. No Nest dependency-injection container in this candidate.

**Plain words:** the same typed dependency and failure model governs the backend and worker. PostgreSQL supplies durable work; Effect manages how each running process executes and releases its resources.

**Advantages:** explicit expected errors and required services; one lifecycle owner; strong tools for bounded concurrency, cancellation and cleanup; typed transport schemas.

**Costs/anomalies:** substantial programming-model commitment; third-party Promise/stream adapters still need correct error/cancellation mapping; Effect finalizers do not run after a hard kill and cancellation cannot undo a paid provider call. Effect does not add durable storage or replace ownership checks. Current v4 is stable by release classification but newly released; package-family and adapter compatibility need verification before pinning.

**Reference:** original T3 Code uses React/TanStack/Vite tooling, a Node Effect HTTP/RPC server, SQLite, Electron, and durable outbox/worker machinery. Its EffectWorker is composed inside its server, not evidence of a separate worker OS process. Sprout would use PostgreSQL/pg-boss, conventional HTTP where practical, and separate processing. [Web manifest](https://github.com/pingdotgg/t3code/blob/43f8a8de17a7ac1baa7a3cf36d681856de2d8add/apps/web/package.json), [server composition](https://github.com/pingdotgg/t3code/blob/43f8a8de17a7ac1baa7a3cf36d681856de2d8add/apps/server/src/server.ts), [worker runtime wiring](https://github.com/pingdotgg/t3code/blob/43f8a8de17a7ac1baa7a3cf36d681856de2d8add/apps/server/src/orchestration-v2/runtimeLayer.ts).

## D — React/Vite + NestJS + Redis-backed BullMQ

**Technology map:** GUI/backend/domain/files: same as B. Data: PostgreSQL/Drizzle/pgvector plus an application outbox and durable operation identities. Queue: specifically BullMQ on persistent Redis. Worker: separate Nest/Node process with BullMQ consumers and an outbox-dispatch role. No pg-boss in this candidate.

**Plain words:** records stay in PostgreSQL and jobs live in Redis. A dispatcher reliably bridges the two stores; workers process the resulting jobs.

**Advantages:** documented Nest queue integration and queue-oriented controls; queue storage pressure can be separated from PostgreSQL; suitable if those controls become a concrete need.

**Costs/anomalies:** another stateful service; Redis persistence/memory policy; dispatcher lag and duplicate delivery; database-to-broker recovery bookkeeping. Queue IDs alone are insufficient if completed jobs disappear. If a broker restore loses already-dispatched jobs, PostgreSQL operation state must drive reconciliation. No comparative speed or reliability advantage is measured. Current BullMQ has other backend offerings; this option intentionally evaluates Redis, not every BullMQ configuration.

**Reference:** Docmost uses React/Vite + Nest/Fastify + PostgreSQL/Kysely + BullMQ/Redis. It differs in UI/query tooling and has processors loaded into the API application's supplied deployment. Sprout's separate worker and outbox are proposed improvements for its requirements, not claims about Docmost. Docmost is a broader collaborative product, not a tiny equivalent. [Manifests](https://github.com/docmost/docmost/blob/42e07d8019fdb6a1aadf6e96d131ad60d497073f/apps/server/package.json), [queue module](https://github.com/docmost/docmost/blob/42e07d8019fdb6a1aadf6e96d131ad60d497073f/apps/server/src/integrations/queue/queue.module.ts), [Compose](https://github.com/docmost/docmost/blob/42e07d8019fdb6a1aadf6e96d131ad60d497073f/docker-compose.yml).

## E — React/Vite + NestJS + RabbitMQ consumers

**Technology map:** GUI/backend/domain/files: same as B. Data: PostgreSQL/Drizzle/pgvector plus an outbox and durable operation identities. Broker: RabbitMQ with durable/persistent delivery, publisher confirms and deliberately configured manual consumer acknowledgments. Worker: separate Node/Nest consumers and an outbox dispatcher. Retry/dead-letter routing and bounded prefetch need explicit design. No pg-boss or BullMQ in this candidate.

**Plain words:** the backend records intent, a dispatcher publishes messages, and independent consumers perform the work. The broker can route messages to different consumers.

**Advantages:** explicit message routing and language-independent consumers; a good fit when multiple independent services genuinely consume events.

**Costs/anomalies:** greatest messaging/operational burden here; acknowledgments/confirms cover different hops; outbox duplicates and broker-restore loss still need reconciliation; retry routing must avoid loops. A single local broker is not host-failure high availability. Combining RabbitMQ and pg-boss for the same jobs creates competing retry/completion systems without a demonstrated benefit.

**Reference:** Plane verifies a separate API/RabbitMQ/worker topology, but uses Python Django/Celery and additional services. It is a larger application and an analogy for the messaging shape, not an exact small TypeScript implementation. No close small exact-stack application was verified. [First-party architecture](https://developers.plane.so/self-hosting/plane-architecture), [pinned Compose](https://github.com/makeplane/plane/blob/bab49bb978ccb56af1d78dec6c6d54dfe8d03c1c/docker-compose.yml).

## Stress-review findings across all five

| Scenario                                        | A/B/C: same-database queue                               | D/E: external broker                                         | Obligation in every candidate                                               |
| ----------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Crash after acknowledging save                  | Receipt and job share the exact transaction connection   | Receipt and outbox share the transaction; dispatcher follows | Test actual commit/rollback and retry identities later                      |
| Duplicate delivery or crash after result commit | At-least-once retries remain                             | Dispatch ambiguity and consumer redelivery add duplicates    | Durable operation idempotency; provider cost can still repeat               |
| Worker unavailable                              | Durable work waits in PostgreSQL                         | Work waits in outbox/broker                                  | Capture does not require a live worker; report honest state                 |
| Owner edits or Trashes during processing        | Short guarded PostgreSQL publication                     | Same authoritative check, irrespective of message payload    | Recheck owner, revision and lifecycle; never rely on cancellation alone     |
| Partial upload or kill during cleanup           | SQL cannot atomically commit file bytes                  | Same                                                         | Verified manifest, staged bytes, restart reconciliation                     |
| DB/broker overload or outage                    | DB affects records and queue                             | Broker separation does not remove DB dependency              | Bounded pools/concurrency/backlogs, capability-specific readiness           |
| Provider outage or uncertain success            | Queue/framework cannot undo paid work                    | Same                                                         | Persist attempts, classify retries, enforce budgets outside prompts         |
| Watch restart or hard kill                      | Stop intake, bounded drain, recover durable claims later | Stop dispatcher/consumers, bounded drain/reconcile later     | Real resource cleanup; hard kills skip cooperative finalizers               |
| Heavy extraction blocks event loop              | Worker process separates HTTP but needs limits           | Broker does not execute or isolate computation               | Bounded subprocesses/threads, memory/time/concurrency limits                |
| Private operations and streamed answers         | Web/worker authorization remains explicit                | API/consumer authorization remains explicit                  | Cross-user checks, current evidence, research policy, safe session handling |

Primary mechanism sources: [pg-boss transaction adapters](https://github.com/timgit/pg-boss/blob/9bdce7c360d33bd43ec927671851c8f9136fcec6/docs/api/adapters.md), [pg-boss at-least-once introduction](https://github.com/timgit/pg-boss/blob/9bdce7c360d33bd43ec927671851c8f9136fcec6/docs/introduction.md), [BullMQ production guidance](https://docs.bullmq.io/guide/going-to-production), [RabbitMQ reliability](https://www.rabbitmq.com/docs/reliability), [Effect resource scopes](https://github.com/effect-ts/website/blob/main/apps/web/src/content/docs/v4/resource-management/scope.mdx).

## Recommendation and selection

**Default recommendation: B.** It gives Sprout an explicit backend and conventional module/lifecycle structure, keeps one authoritative durable store, and avoids an external-broker handoff for a workload that currently does not require one. This is a requirements-based judgment, not a measured superiority claim.

**C is the strong alternative** when typed errors/dependencies and execution-resource composition are the desired common backend language. Choose it deliberately as the backend model rather than layering it casually on top of Nest DI. **A remains coherent** when fewer applications matter most. **D/E need a specific queue-control or message-routing requirement** to justify their additional stores/recovery machinery.

The same private SPA can be built with Next.js instead of Vite in B/C/D/E. It is omitted here because no current public-rendering requirement justifies a second server composition layer; choosing a separate backend does not technically forbid Next.js.

## What selection changes in issue #2

A creates web and worker apps; B/C/D/E add an API app. Create only packages with actual foundation responsibilities: shared UI, database/config infrastructure and any necessary health contracts. Do not create empty future domain modules.

Compose Watch builds from repository source and synchronizes code/restarts services appropriately. A one-shot migration service applies committed migrations before dependents start. Foundation checks demonstrate a simple UI, migrations, pgvector, server/worker declared dependency readiness and persisted development storage. Queue library initialization, if included, checks connection/schema only; no handlers or diagnostic jobs are required. Better Auth/AI SDK installation stays deferred. No tunnel/provider/deployment prerequisite is introduced.

CI remains quality, build, test, integration health checks and E2E screen sanity. The failure-review matrix defines future acceptance work; it does not expand foundation integration/E2E into product journeys. Prepared startup is offline after dependencies/images/assets are cached or transferred.

After the owner selects an option, record the tradeoff in an ADR, reconcile architecture/foundation docs and issue #2, select exact compatible versions, preserve remote Git history, and initialize the development repository. This report does not execute those pending implementation steps.
