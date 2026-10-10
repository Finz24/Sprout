# NestJS architecture alternatives for Sprout

Research snapshot: October 9, 2026. These are candidates for discussion, not accepted architecture changes or permission to initialize packages. The baseline is [architecture.md](../architecture.md), [ADR 0001](../adr/0001-modular-application-two-processes.md), [ADR 0002](../adr/0002-postgresql-and-durable-jobs.md), and the development-only [foundation scope](../specs/foundation-development-environment.md).

This report combines official documentation with read-only GitHub API inspection of first-party source at recorded commits. It is static architecture and failure analysis. No candidate was built, benchmarked, load-tested, or demonstrated against injected failures. Project examples establish implementation precedents, not proof of Sprout's correctness or performance.

The accompanying [abstract handoff model](architecture-handoff-model.py) explores declared crash points for same-transaction queues, unsafe database/broker double writes, and broker outboxes. Its assumptions include atomic/durable database commits and durable confirmed broker messages; it excludes files, provider effects and actual queue delivery. Zero violations in this model is conditional reasoning, not a passed implementation test. No framework guarantees consumer idempotency.

## Option B: React/Vite, NestJS API, Nest worker, PostgreSQL queue

Concrete map:

- React/Vite client, shadcn/ui, Tailwind and Motion; browser talks to a versioned HTTP API. A same-origin development proxy can avoid adding cross-origin cookie complexity, but the origin/session contract still needs an explicit decision.
- NestJS API using one chosen HTTP adapter, not both. Controllers validate incoming transport values and resolve authenticated user context; shared application operations enforce ownership and writes.
- Independently runnable Nest standalone worker: its application context composes processing modules without starting the API server. Feature issues later register handlers; foundation readiness does not process jobs.
- PostgreSQL with Drizzle migrations, pgvector, and pg-boss. API, worker and migration commands share schema and narrow module contracts, with independently bounded database pools.
- Private original-file storage is accessible to both API and worker through a storage adapter. Files are not public static assets.
- Compose development services: client, API, worker, PostgreSQL, and a one-shot migration service. Source watch restarts or reloads the appropriate process; dependency changes rebuild images.

Nest's module exports define its dependency-injection interface. Nest standalone contexts provide composition and lifecycle without HTTP listeners, but HTTP guards, middleware, interceptors and pipes are not automatically applied to direct provider invocations. Therefore, worker calls must not depend on controller guards for ownership checks. [Nest modules](https://github.com/nestjs/docs.nestjs.com/blob/master/content/modules.md), [standalone applications](https://docs.nestjs.com/standalone-applications)

Nest does not require BullMQ. pg-boss can be a provider behind Sprout's queue adapter. Current first-party pg-boss source documents transaction adapters, including Drizzle: enqueue using the exact transaction that writes the receipt, not merely another connection to the same database. Rollback removes both writes. Final version compatibility remains an implementation check. [pg-boss adapter documentation at 9bdce7c360d33bd43ec927671851c8f9136fcec6](https://github.com/timgit/pg-boss/blob/9bdce7c360d33bd43ec927671851c8f9136fcec6/docs/api/adapters.md)

### Why consider B?

The API owns a stable transport surface independent of React and Next.js, and API and worker share backend conventions for composition, configuration and shutdown. This is useful if future native clients, browser capture integrations or externally callable tools are concrete goals. For Sprout's authenticated workspace, SSR and public-page SEO are not currently central requirements; a client-rendered application is a viable candidate, not a measured performance conclusion.

Costs include more initialization and API-contract work, a separate development process, explicit client fetching/error/loading behavior, and cookie/session integration across the browser/API boundary. Nest module metadata is not an import-boundary linter, tenant-security proof, transaction manager, or guarantee against circular architecture. Keep CI boundary checks and application invariants.

Compared with the approved Next.js plus Node worker baseline, this changes the request/backend composition framework. It need not change the domain model, authoritative store or durable-job consistency design. Next.js already supports HTTP endpoints; adopting Nest is a choice about backend ownership and conventions, not whether Next.js is a real server. [Next.js backend-for-frontend guidance](https://nextjs.org/docs/app/guides/backend-for-frontend)

## Option D: same client/API/worker, BullMQ on Redis and PostgreSQL outbox

Keep B's client, Nest API, standalone worker, Drizzle/PostgreSQL/pgvector and private files. Replace the pg-boss job store with a specifically Redis-backed BullMQ deployment. Add persistent Redis and an outbox dispatcher, which can initially live in the worker process. This is a separate queue decision; Nest does not force it. Nest's documented BullMQ integration uses Redis. Newer BullMQ documentation also exposes a PostgreSQL backend, so claims about every possible BullMQ configuration requiring Redis would be too broad. This candidate deliberately evaluates the Redis-backed design. [Nest queues](https://docs.nestjs.com/techniques/queues), [BullMQ guide](https://docs.bullmq.io/guide/going-to-production)

Proposed handoff protocol, not inspected Sprout implementation:

1. Commit receipt and a processing-request outbox row together in PostgreSQL.
2. Dispatcher reads eligible rows and adds a BullMQ job using a stable operation identifier.
3. Only after Redis acknowledges the add does the dispatcher record publication. A crash between steps 2 and 3 causes another publish attempt.
4. Worker verifies tenant, lifecycle and revision against PostgreSQL before processing and publication. Record terminal operation state durably in PostgreSQL.
5. Reconcile requests against durable operation state if Redis is restored without recent queue data. Merely marking an outbox row published is insufficient to guarantee recovery from broker data loss.

The outbox closes the PostgreSQL-commit/Redis-publish gap. It does not make provider requests exactly once, make Redis durable beyond its persistence configuration, or eliminate duplicate deliveries. BullMQ recommends idempotent jobs; queue-level job IDs cannot be the sole operation-deduplication record when completed jobs are removed. [BullMQ idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs)

BullMQ has a first-party Nest integration and queue-specific controls. It can isolate queue resource pressure from PostgreSQL, but all domain reads/publications still need PostgreSQL. The additional operational burden is Redis persistence, memory policy, connectivity, dispatcher lag, reconciliation and coordinated recovery. Redis-backed operation is not inherently faster or more reliable for Sprout: no comparative load results exist. Official guidance distinguishes fail-fast producers from reconnecting workers and recommends persistence/no-eviction configuration. [BullMQ production guidance](https://docs.bullmq.io/guide/going-to-production)

## Failure and anomaly review

The following are required design responses, not passed tests. Product-level checks belong to later feature issues; issue #2 keeps readiness and screen sanity.

| Scenario | Option B: PostgreSQL queue | Option D: Redis queue plus outbox | Shared unresolved implementation obligation |
|---|---|---|---|
| Crash between receipt and enqueue | Receipt and pg-boss enqueue must share one transaction; either both commit or neither does. | Receipt and outbox must share one transaction; dispatcher publishes later. | Verify actual transaction adapter and rollback, not just matching database URLs. |
| Crash after work writes but before queue acknowledgment | Retry can revisit work; durable operation identity and guarded writes prevent repeated publication. | Stalled/retried jobs and dispatcher duplicates must converge on the same durable operation. | External provider effects may repeat; never promise exactly-once cost or external action. |
| Worker offline / restart | Durable requests remain in PostgreSQL; web capture need not require worker availability. | Outbox and broker backlog remain; dispatcher may also be offline. | Show Processing truthfully, version payloads, reconcile interrupted attempts. |
| Owner corrects item or moves it to Trash during processing | Short publication transaction checks current revision/lifecycle. | Same check in authoritative PostgreSQL; Redis payload is not authority. | Reject obsolete results; cancellation is an optimization, not the correctness boundary. |
| Two users share infrastructure | Tenant identity and operation authorization are checked in each application operation and SQL boundary. | Same, including outbox rows and job payload lookup. | A job's claimed user ID is not authority. Worker must re-read authorized ownership. |
| Attachment upload only partly saved | Files and PostgreSQL are separate resources; staged manifest plus verification and reconciliation are required. | Same; outbox must not claim missing bytes were retained. | Define partial receipt versus full success; reject unsafe paths and unauthorized downloads. |
| PostgreSQL outage | Domain operations and queue unavailable; readiness fails. | Domain reads/writes, publication and dispatcher fail even if Redis remains healthy. | No successful save acknowledgment; bounded retry and recovery without duplicate receipts. |
| Redis outage or broker restore loses jobs | Not applicable: no Redis service. | Capture can remain available through outbox if DB/files work; worker/dispatcher not ready. Reconciliation restores lost requests from DB state. | Define capability-specific degradation; broker ping alone cannot detect missing durable work. |
| Provider throttling or unavailable credentials | Provider failure does not make core capture unavailable. | Same; queue-specific rate limits do not replace per-user budgets. | Bounded backoff, retry classification, research policy, honest failed-stage state. |
| Shutdown / Compose Watch restart | Stop acquiring jobs, mark not ready, close pools and wait within a bounded grace period. | Close BullMQ workers, dispatcher and pools; interrupted work may be retried. | Provider/extraction operations need time limits and cancellation; do not wait indefinitely. |

BullMQ documents `worker.close()` as stopping acquisition and waiting for active jobs, without its own timeout. Application/job time limits and a container grace period must be chosen explicitly. Nest's standalone context can trigger lifecycle cleanup, but it does not invent correct cleanup behavior. [BullMQ graceful shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown), [Nest standalone lifecycle](https://docs.nestjs.com/standalone-applications)

## Readiness dependencies

Separate liveness from readiness: process alive is liveness; initialization and required dependencies available is readiness. Return capability information without exposing credentials or private user material. These are proposed contracts to discuss, not initialized code.

| Component | B dependencies | Additional D dependencies | Dependencies that should not gate core readiness |
|---|---|---|---|
| API | Valid configuration, expected DB schema/migrations and pgvector extension; private-file adapter available if initialized for capture | Redis need not gate capture if capture relies on durable outbox; queue controls expose degraded availability | Worker availability, optional model providers, tunnel and deployment services |
| Worker foundation | Valid configuration and PostgreSQL access; expected schema. pg-boss connectivity/schema only if initialized in this issue | Redis connectivity only if BullMQ initialized; dispatcher readiness separately when introduced | Model credentials, real job execution, external sources not introduced yet |
| Worker processing later | Queue access, authorized DB operations and required original-file adapter | Redis plus PostgreSQL and dispatcher capability | An optional provider's temporary outage should be a processing capability failure, not an unconditional process failure |

Migration recommendation from the discussion: a one-shot Compose service applies committed migrations before dependent processes start; failed migrations block startup. Local development exposes an explicit migration command. Never auto-generate migrations or reset data. Concurrent migration locking and pg-boss schema initialization ordering still require a tested implementation choice.

## First-party project precedents

### TREK: travel-planner reference, not an exact stack match

Inspected `liketrek/TREK` at `1c05ee4b3ac9523c41ccdd3baad989ba48a7409a`, interpreting the owner's clarification as the TREK trip manager. Root npm workspaces separate client/server/shared. Client uses React/Vite; server includes NestJS with Express, Zod contracts, better-sqlite3 and custom authentication. It is not a PostgreSQL/Drizzle/pg-boss example and no Effect dependency appears in those manifests. [Root manifest](https://github.com/liketrek/TREK/blob/1c05ee4b3ac9523c41ccdd3baad989ba48a7409a/package.json), [client manifest](https://github.com/liketrek/TREK/blob/1c05ee4b3ac9523c41ccdd3baad989ba48a7409a/client/package.json), [server manifest](https://github.com/liketrek/TREK/blob/1c05ee4b3ac9523c41ccdd3baad989ba48a7409a/server/package.json)

Its Nest root wires domain modules, global auth/MFA guards, idempotency and Zod validation; its database module injects an existing SQLite singleton. Useful precedent: explicit backend modules and shared runtime contracts. Mismatch: SQLite/single-writer design and TREK's travel domain do not establish Sprout's multi-process durability or ownership behavior. [Nest application module](https://github.com/liketrek/TREK/blob/1c05ee4b3ac9523c41ccdd3baad989ba48a7409a/server/src/nest/app.module.ts), [database module](https://github.com/liketrek/TREK/blob/1c05ee4b3ac9523c41ccdd3baad989ba48a7409a/server/src/nest/database/database.module.ts)

The inspected booking-import background path stores jobs in a process-local Map, chains Promises per user and retains completed results briefly. It frees the HTTP request but is not a durable broker or independent worker; process restart loses that state. Scheduling also runs through the server's Nest scheduling module. This is an example of why “background” and “durable” must be evaluated separately. [ImportJobsService](https://github.com/liketrek/TREK/blob/1c05ee4b3ac9523c41ccdd3baad989ba48a7409a/server/src/nest/booking-import/import-jobs.service.ts), [scheduling module](https://github.com/liketrek/TREK/blob/1c05ee4b3ac9523c41ccdd3baad989ba48a7409a/server/src/nest/scheduling/scheduling.module.ts)

Supplied Compose runs one application image with local data/uploads, and a health endpoint that returns status rather than checking DB readiness. It also documents default outbound place-search service access and configurable OIDC/maps integrations. Its inspected LLM client supports cloud or local OpenAI-compatible endpoints through guarded fetch. Therefore, self-hosted here does not mean no outbound services. [Compose](https://github.com/liketrek/TREK/blob/1c05ee4b3ac9523c41ccdd3baad989ba48a7409a/docker-compose.yml), [health controller](https://github.com/liketrek/TREK/blob/1c05ee4b3ac9523c41ccdd3baad989ba48a7409a/server/src/nest/health/features.controller.ts), [LLM client](https://github.com/liketrek/TREK/blob/1c05ee4b3ac9523c41ccdd3baad989ba48a7409a/server/src/nest/llm-parse/clients/openai-compatible.client.ts)

### Docmost: useful Redis-backed Nest precedent, not a small equivalent

Inspected `docmost/docmost` at `42e07d8019fdb6a1aadf6e96d131ad60d497073f`. Its client uses React/Vite, Mantine and React Query; its server uses Nest/Fastify, Kysely/PostgreSQL, BullMQ/Redis and AI SDK dependencies. No Effect dependency appears in those manifests. This is a collaborative knowledge application, with substantially broader collaboration/integration machinery than Sprout's first personal release. It is not a shadcn/Drizzle/pg-boss example. [Client manifest](https://github.com/docmost/docmost/blob/42e07d8019fdb6a1aadf6e96d131ad60d497073f/apps/client/package.json), [server manifest](https://github.com/docmost/docmost/blob/42e07d8019fdb6a1aadf6e96d131ad60d497073f/apps/server/package.json), [server bootstrap](https://github.com/docmost/docmost/blob/42e07d8019fdb6a1aadf6e96d131ad60d497073f/apps/server/src/main.ts)

Its queue module registers mail, attachments, general, search, AI and other queues with differing retries/retention. An actual general processor handles watcher/backlink work and closes its worker on module destruction. QueueModule is imported by the main API AppModule, so this processor is present in the API process. Supplied Compose has one app container, PostgreSQL and persistent Redis with append-only storage/no-eviction; it does not independently deploy the proposed Sprout worker. No transactional outbox was established by the inspected paths. [Queue module](https://github.com/docmost/docmost/blob/42e07d8019fdb6a1aadf6e96d131ad60d497073f/apps/server/src/integrations/queue/queue.module.ts), [general processor](https://github.com/docmost/docmost/blob/42e07d8019fdb6a1aadf6e96d131ad60d497073f/apps/server/src/integrations/queue/processors/general-queue.processor.ts), [AppModule](https://github.com/docmost/docmost/blob/42e07d8019fdb6a1aadf6e96d131ad60d497073f/apps/server/src/app.module.ts), [Compose](https://github.com/docmost/docmost/blob/42e07d8019fdb6a1aadf6e96d131ad60d497073f/docker-compose.yml)

The server manifest contains adapters for model providers, object stores, search services, email and billing. Dependency presence establishes integration capability, not mandatory credentials, active use or a required hosted-service deployment. The inspected Compose itself supplies local DB/Redis/storage. Avoid importing Docmost's entire dependency list as Sprout's foundation checklist.

## Decisions this research leaves open

1. Whether Sprout needs an independently stable API now, and whether its UI has a reason to retain Next.js instead of Vite.
2. Whether Nest conventions justify their initialization cost for both API and worker.
3. Whether a demonstrated queue requirement justifies Redis and outbox/reconciliation over PostgreSQL's atomic handoff.
4. Which dependencies each foundation readiness probe actually checks before feature initialization.
Neither inspected project is an exact architecture template, and neither is evidence for Effect adoption.
