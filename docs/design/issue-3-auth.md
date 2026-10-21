# Issue #3: private sign-in and app navigation

## Problem

[Issue #3](https://github.com/Finz24/Sprout/issues/3) needs private login and a responsive library shell. Auth storage and ownership rules affect every later feature. This note proposes the shape for Ohad's approval before feature code or migrations land. Approval of this document does not authorize deployment or merge of an implementation.

The baseline is `main` at `4b097fe8fdcc791b388e948f2b7f138ce8471c03`, fetched October 22, 2026. The worktree was fast-forwarded to that baseline before design. Closed PR #34 and `feat/issue-3-private-access` are excluded as design inputs.

[ADR 0004](../adr/0004-effect-api-and-worker.md) supersedes the issue's Next.js wording. [ADR 0003](../adr/0003-authentication-and-private-ownership.md) requires Better Auth, provisioned private access, PostgreSQL RLS, and two-user isolation. The [personal workspace specification](../specs/sprout-personal-workspace.md), [architecture](../architecture.md), [product direction](../product-direction.md), and [glossary](../../CONTEXT.md) govern behavior. A Space organizes one owner's saved items and grants no access to another user.

The current scaffold has public Home/Foundation pages, React/Vite/TanStack Router, and separate Effect API and idle-worker health servers. `packages/database/src/schema.ts` is empty. Its service exposes a readiness probe, not a feature query API. The only migration enables pgvector. Vite strips `/api` when proxying. Compose currently shares a development database login with `trust` authentication. None of these conveniences proves authentication or isolation.

## Change

### Decision and boundaries

Propose email/password login for one locally provisioned owner. Better Auth owns credentials, cookie signing, and sessions in the API process. An application sign-out wrapper confirms durable revocation. Effect owns composition, request failure mapping, and resource lifetime. The browser receives a sanitized session summary. PostgreSQL derives the private-data owner from a live session credential, never an authoritative user ID supplied by a route, client, or job.

Access has distinct anonymous, authenticated, and unavailable states. HTTP/cookie parsing, database credentials, and Better Auth types stay inside adapters. This slice excludes tenant membership, a global owner constant, public registration, OAuth, admin plugins, job execution, and saved-item schema. No application dependencies change in this PR.

These signatures are design pseudocode, not an implementation or a promise of exact library syntax.

```text
HTTP GET /api/shell:
  Identity.withRequest(request, Shell.read())
  map Unauthenticated to 401, Unavailable to 503

Private route beforeLoad:
  Session.read()
  Authenticated -> enter shell
  Anonymous -> replace with /login and validated local return path
  Unavailable -> retry screen without private content

Local bootstrap command:
  Bootstrap.createOwner(privateInput)
  -> Created | AlreadyProvisioned | InconsistentInstallation

Access = Anonymous | Authenticated(OwnerSummary, expiresAt) | Unavailable
OwnerId = opaque identity derived from auth storage
SessionCredential = opaque, request-bound secret, identity-module private
Identity.withRequest(request, operation) -> Effect<Result, AccessFailure>
Shell.read() -> Effect<ShellSummary, AccessFailure, RequestAccess>
OwnerSettings.setLibraryView(view) -> Effect<void, AccessFailure, RequestAccess>
AccessFailure = Unauthenticated | Unavailable
```

The shell call returns identity-safe display fields and persisted view preference, with no session token. An item operation later returns indistinguishable not-found responses for missing and foreign IDs. A domain caller cannot construct an owner context from an ID. Only the identity adapter supplies `RequestAccess`; private repositories independently establish the database credential before querying.

Proposed implementation ownership is small. A server-only identity module owns Better Auth and bootstrap. The database package owns migrations, pools, the session resolver, and transaction cleanup. A shell module owns shell reads and owner preferences. API runtime mounts transport adapters; browser-safe contracts expose DTOs only. Web owns routes and rendering. Shared UI owns tokens and reusable components. Public exports must keep raw pools, Drizzle tables, cookies, and auth SDK objects inaccessible to web/domain callers. These are future boundaries, not files added here.

### Session flow and Effect integration

1. Serve web and API through one origin. The browser posts credentials to `/api/auth/sign-in/email`. Preserve the `/api` prefix in the future auth proxy/API composition, so Better Auth's configured canonical base URL and `/api/auth` base path match the actual Request URL. Adjust health proxy routing explicitly rather than mounting the auth handler under today's stripping rewrite. Verify both development modes. Production ingress must preserve the same contract.
2. Mount Better Auth's Web Request/Response handler through one Effect HTTP adapter. Forward the body once, preserve status and every `Set-Cookie` header, and propagate disconnects. Do not run a second HTTP server or let Better Auth own the Effect runtime. Exact adapter calls must be checked against pinned Effect `4.0.2` during implementation.
3. Allow only `POST /api/auth/sign-in/email`, `POST /api/auth/sign-out`, and the application's sanitized `GET /api/session`. Deny all other auth paths/methods before dispatch, including encoded or alternate registration paths. The session wrapper calls Better Auth internally. Project auth responses through an explicit safe DTO allowlist, including sign-in responses that otherwise contain a token. Preserve cookie headers separately.
4. Use a host-only HttpOnly cookie, SameSite=Lax and Secure on HTTPS, with explicit canonical origin and trusted origins. Keep Better Auth's CSRF/origin checks enabled; domain mutations also validate origin and content type. Trust forwarded headers only from the configured ingress. Insecure cookies are allowed only in explicit loopback development. Rate-limit sign-in and return a generic invalid-credentials error without account enumeration.
5. Propose a seven-day absolute session lifetime, no sliding refresh, and cookie caching disabled. Each protected request verifies the signed cookie and resolves the database session. The identity adapter privately retains the matching raw session credential for RLS. Never serialize it to web state, URLs, logs, traces, errors, browser storage, or jobs. All private/auth responses use `Cache-Control: no-store`.
6. A private operation opens a short database transaction as described below. Session absence/expiry returns 401. Auth/database failure returns 503, never an anonymous success. The sign-out wrapper deletes the session durably through the auth pool and confirms absence before reporting success and expiring the cookie. An already-missing session is an idempotent success. On database or uncertain-commit failure, return 503 without clearing the signed cookie, so the owner can retry revocation while private content stays hidden. Browser reload and a new tab resolve the session again.

Better Auth `1.6.23` is the proposed pinned integration target, not installed by this note. Its [stock sign-out handler](https://github.com/better-auth/better-auth/blob/v1.6.23/packages/better-auth/src/api/routes/sign-out.ts) catches deletion errors and still reports success. The application wrapper therefore intercepts sign-out instead of trusting that response. Its private adapter verifies the signed cookie, deletes only the matching session, and clears cookies using the pinned auth facilities after confirmed revocation. Context7 supplied its versioned [session controls](https://github.com/better-auth/better-auth/blob/v1.6.23/docs/content/docs/concepts/session-management.mdx), [signup control](https://github.com/better-auth/better-auth/blob/v1.6.23/docs/content/docs/reference/errors/signup_disabled.mdx), and [core database contract](https://github.com/better-auth/better-auth/blob/v1.6.23/docs/content/docs/concepts/database.mdx). Review the adapter schema and supported password hasher from that exact version before generating a migration. Runtime downloads are unnecessary; stage reviewed package tarballs and the lockfile in the pnpm cache for air-gapped use.

### Tables and ownership

Use two schemas. `auth` is a credential store accessed only by the auth adapter and provisioning path. `private` contains owner-scoped product records. Auth tables cannot use a browser-owner RLS policy because sign-in starts without a session. Restrictive role grants isolate those tables instead. Private tables always enable and force RLS.

The proposed five tables are below. Auth IDs use Better Auth's text representation. All timestamps are timezone-aware. Auth tables have `id` primary keys and `created_at`/`updated_at`; nullability and adapter mappings must match the pinned generated schema.

| Table                    | Required shape and constraints                                                                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.user`              | `id`, `name`, normalized unique `email`, `email_verified`, nullable `image`, timestamps. Normalize email consistently at sign-in and provisioning.                                                                         |
| `auth.account`           | `id`, `user_id` FK, `account_id`, `provider_id`, nullable password hash and standard token/expiry/scope fields, timestamps. Unique `(provider_id, account_id)`; index `user_id`. Only a credential account is provisioned. |
| `auth.session`           | `id`, `user_id` FK, unique secret `token`, `expires_at`, nullable IP/user-agent, timestamps. Index `user_id`. Keep the adapter token format; do not invent incompatible token hashing.                                     |
| `auth.verification`      | `id`, `identifier`, secret `value`, `expires_at`, timestamps; index `identifier`. Retain core adapter compatibility, expose no verification/reset flow and grant runtime no access.                                        |
| `private.owner_settings` | `owner_user_id` text PK/FK to `auth.user.id`, `library_view` constrained to `grid` or `list`, timestamps. Bootstrap creates the default `grid` row. No credentials or arbitrary settings JSON.                             |

Auth child FKs cascade on user deletion per the adapter contract. `owner_settings` restricts user deletion to prevent accidental product-data loss. Account deletion is not exposed. There is no global owner ID embedded in tables or policies. Two synthetic provisioned users can have distinct private rows in tests. A future hosted onboarding policy can provision more users without changing row ownership.

Saved items, Spaces, memberships, search projections, originals, and jobs remain absent from this slice. Their later migrations must carry non-null `owner_user_id`. Child references must bind `(owner_user_id, parent_id)` to a matching unique parent key to reject cross-owner links, with indexes beginning with the owner key. Files are served only after an authorized parent lookup, never as public static storage. Storage and job schemas need their own approved designs.

### Database roles and per-request identity

Replace shared `trust` authentication with separately authenticated roles before claiming isolation. Merely assigning different usernames under `trust` lets a worker reconnect as another role. Runtime config must reject a superuser, BYPASSRLS role, table owner, or privileged membership. Migration/bootstrap credentials never enter API or worker environments. This required implementation work is documented here; Compose is untouched.

| Role                              | Permitted access                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema owner, `NOLOGIN`           | Owns tables/policies. Only the offline migration identity may assume it.                                                                                                                          |
| Migration/bootstrap login         | Reviewed DDL under the schema-owner role. Bootstrap uses the named maintenance login and explicit grants below, without switching to schema owner. Neither credential enters serving processes.   |
| Auth runtime login                | Schema usage; user/account SELECT; session SELECT/INSERT/UPDATE/DELETE for Better Auth lifecycle. No user/account INSERT, UPDATE, DELETE; no private tables; no privileged role membership.       |
| API private-data login            | May `SET LOCAL ROLE sprout_web`, with `INHERIT FALSE`. No direct table grants or auth membership. Only narrow health probe access outside that role.                                              |
| `sprout_web`, `NOLOGIN`           | Private schema usage; owner-settings SELECT and column UPDATE on `library_view`/`updated_at`; resolver EXECUTE. No auth-table access or runtime INSERT/DELETE.                                    |
| Session resolver owner, `NOLOGIN` | Auth schema usage, SELECT only the session token/user/expiry columns, and ownership of the resolver function. No private DML, role administration, or credentials available to serving processes. |
| Worker login                      | Foundation readiness only. No private/auth schema access, resolver EXECUTE, web/auth role membership, or serving credentials.                                                                     |

All runtime roles are NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE. Revoke public schema creation, table rights, and default function EXECUTE. Set explicit schema/table/function grants in the same migration transaction as creation. Do not grant TRUNCATE, REFERENCES, or ownership to runtime roles. Foundation readiness still needs narrowly scoped migration-history/vector checks.

The API transaction sequence is fixed, with identifiers chosen by code and values bound as parameters.

```text
checkout one API private-data connection
BEGIN at READ COMMITTED
SET LOCAL ROLE sprout_web
set_config('sprout.session_token', sessionCredential, true)
resolve private.current_owner_id(); reject null as Unauthenticated
execute the domain operation on this same connection
COMMIT on success; ROLLBACK on failure
release only after confirmed completion
```

`private.current_owner_id()` is a narrow SECURITY DEFINER resolver. It reads the credential setting and returns `auth.session.user_id` only for a matching token with `expires_at > statement_timestamp()`. Missing, malformed, unknown, revoked, or expired credentials yield null. It returns no token or session row. Its owner has only the lookup grants above. Use fully qualified objects, a fixed `search_path` of `pg_catalog, pg_temp`, no dynamic SQL, and grant EXECUTE only to `sprout_web`. Review [PostgreSQL's security-definer precautions](https://www.postgresql.org/docs/17/sql-createfunction.html).

A custom setting is writable by callers. Its value here is an unverified bearer credential, never an accepted owner ID. Setting `sprout.owner_id` has no effect. A guessed token grants nothing; a stolen valid token grants its owner's access. This design protects against foreign IDs, omitted predicates, and forged owner settings. It cannot protect against full API-process compromise: the auth pool can read or mint sessions. Database backups, auth tables, and bind parameters are credential-sensitive. Disable sensitive parameter logging and redact diagnostics before using this design.

For `owner_settings`, the SELECT policy is `owner_user_id = private.current_owner_id()`. The UPDATE policy uses that same predicate in both USING and WITH CHECK. Column grants prevent owner reassignment. No runtime INSERT/DELETE policy exists. Bootstrap executes as the named offline maintenance role, with schema USAGE, SELECT on all five tables, and INSERT on user/account/settings. Maintenance-only settings policies allow SELECT with USING (true) and INSERT with WITH CHECK (true); FORCE RLS remains on. Serving roles cannot assume maintenance. Recovery separately grants credential replacement and session deletion; bootstrap does not need those rights. Switching to schema owner does not bypass FORCE RLS. Future product writes require both command grants and owner policies with USING/WITH CHECK as appropriate. No policy is granted to PUBLIC. [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html) documents bypass and policy composition; [SET ROLE](https://www.postgresql.org/docs/17/sql-set-role.html) documents membership and role switching.

Effect scopes own checkout through cleanup. Transaction-local role and credential settings end on commit/rollback. Never run feature queries through `pool.query`, use session-level identity settings, or release a client while a query is still running. A Promise interrupted by Effect does not prove PostgreSQL stopped. Stop new statements, cancel or destroy the active connection, await settlement, and roll back before reuse. Destroy the connection on uncertain cancellation, failed rollback, or uncertain commit; report unavailable without a blind write retry. Bound statement and cleanup timeouts. No network/provider work runs inside this transaction. See [Effect scoped finalizers](https://effect.website/docs/v4/resource-management/scope).

At READ COMMITTED, revocation is observed by subsequent statement snapshots; an already-running statement can finish with its earlier snapshot. Expiry uses statement time rather than transaction-start time. Keep operations short. Do not claim logout retroactively cancels committed work or instantly retracts bytes already sent.

The worker remains idle in issue #3. Its login cannot reach product tables even if it sets owner/token GUCs or receives a forged `payload.ownerId`. Future processing must derive ownership from a trusted durable job claim, bind resources and publication revision to that claim, and expose narrow operations rather than a worker-callable `setOwner(id)`. Do not pass browser sessions into jobs. Granting worker data access is a separate approval gate.

### Owner bootstrap and public signup denial

Provide an explicit local maintenance command after the migration, never an HTTP setup route or automatic startup bootstrap. Read the password through private interactive input or an inherited secret environment variable, never CLI arguments, files, or logs. The command uses the pinned Better Auth password hasher. It creates no browser session.

Hash before opening the transaction. Acquire a transaction-scoped advisory lock shared by every provisioning invocation, then inspect all five tables. An empty installation receives one user, one credential account, and one owner-settings row atomically. A complete existing installation returns AlreadyProvisioned without changing credentials or adding a user. Partial or unexpected rows return InconsistentInstallation and require operator investigation. A crash rolls back the entire write. Concurrent calls cannot create two initial owners. Synthetic test fixtures may provision a second owner only through a test-only maintenance path unavailable to serving processes.

Signup denial is enforced at every relevant layer. The UI contains no registration link. The canonical API route allowlist denies signup. Better Auth sets `emailAndPassword.disableSignUp = true` and a user-create hook rejects creation in the serving configuration. Registration-capable providers/plugins and recovery endpoints remain disabled. Runtime SQL grants deny user/account creation even if a handler is accidentally exposed. Bootstrap uses its separate offline configuration and privileges. No web request can toggle provisioning mode. Password recovery is operator-run local maintenance that revokes sessions, pending a separately reviewed recovery flow.

### App-shell routes and auth guard

Keep the URL as the navigation source of truth. A pathless authenticated parent guards every shell route before loaders or prefetches run. Fetch `/api/session` on entry/reload and revalidate on focus. Guarding web routes is a UX boundary; every API/domain operation still establishes request access and RLS independently. [TanStack's authenticated routes](https://github.com/TanStack/router/blob/main/docs/router/guide/authenticated-routes.md) describe this layout pattern.

| Route                         | Shell behavior                                                                                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`                      | Email/password form, generic failure, pending/retry states, no signup. Authenticated entry replaces navigation with validated return route or `/library`.                                                                                                           |
| `/`                           | Replace with `/library` after access resolution.                                                                                                                                                                                                                    |
| `/library`                    | Selected Library nav; real empty state when empty. Grid/list preference persists in owner settings. No fabricated cards, counts, or successful saves.                                                                                                               |
| `/search?q=...`               | Find and ask navigation target. Query remains in URL for reload/back. Until retrieval exists, say search is not available; do not present an empty result as completed search.                                                                                      |
| `/library/items/$itemId`      | Inspector route within the library. Desktop side panel and phone full-width detail share one URL. Missing/foreign IDs use the same not-found state. Opening from a list preserves its route/query; close returns there, with `/library` fallback for a direct link. |
| `/spaces`, `/spaces/$spaceId` | Spaces navigation and future collection context. Honest unavailable state until that feature lands. No create or drag controls with fake success.                                                                                                                   |
| `/settings`                   | Account display, sign out, and the implemented library-view preference only. No pretend provider configuration.                                                                                                                                                     |

The inspector route defines future integration behavior; #3's empty library cannot demonstrate a real saved-item inspector. Use synthetic fixtures when a real item operation exists. Search and Spaces placeholders reserve navigation, not their feature implementations. Remove the public foundation demo from product navigation in the future implementation; health endpoints expose only sanitized diagnostics. Needs your input, Trash, capture, and later actions get no new route contract here.

Desktop uses a persistent sidebar, header search, content region, and inspector. Galaxy uses a menu drawer and a focused full-width inspector. Use shared shadcn semantic tokens, selected-state `aria-current`, visible focus, labelled controls, keyboard-submit forms, and touch targets of at least 44 CSS pixels. Drawer focus is trapped, Escape closes it, and focus returns to its trigger. Inspector entry moves focus to its heading; close restores the originating item when present. Reduced motion removes spatial transitions without delaying navigation. The empty state explains the next available action without advertising an unimplemented save control.

On logout, expiry, or protected 401, hide private content, cancel private requests, clear router/data caches, invalidate auth context, and replace navigation with login. Associate responses with an auth generation so a late request cannot repopulate cleared state. Broadcast logout to other tabs; refocus also revalidates. A failed logout request shows a retry state and hides local private content but does not claim server revocation. A 503 retains the unavailable state, distinct from expired login. Validate return paths against known same-origin shell routes; reject absolute/protocol-relative URLs and login loops. Never store passwords or unsent private submission bodies in return URLs.

## Proof

This PR proves only that a reviewable design exists and its diff is confined to `docs/design/`. No auth, RLS, bootstrap, device, or navigation behavior has been implemented or tested. Source inspection establishes the scaffold baseline. Context7 and official sources establish library concepts, not compatibility of a built adapter. Exact API signatures and generated schema still need pinned-version validation.

The implementation must add these cases to the approved [application journey boundary](../specs/sprout-testing-boundary.md), using real PostgreSQL and synthetic users. Expected results come from the requirements below, not copies of the production algorithm.

| Case               | Required observable proof before implementation acceptance                                                                                                                                                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login lifecycle    | Provision owner, sign in through same-origin proxy, reload and open a new tab; identity persists. Advance controlled time past expiry; private operation returns 401. Sign out; replay old cookie and reload cannot restore access. Force deletion failure; logout returns 503, retains a retry credential, and a subsequent retry revokes it.               |
| Signup closure     | Direct/encoded signup and alternate-method requests fail; internal auth create hook rejects; runtime SQL cannot insert user/account; table counts remain unchanged. No UI registration path exists.                                                                                                                                                          |
| Bootstrap          | Race two commands, interrupt one, rerun; exactly one complete initial owner exists, no partial records or credentials in output. Populated/inconsistent installs cannot add an owner.                                                                                                                                                                        |
| Two-user RLS       | Provision synthetic A/B through maintenance fixtures. Read/update A's preference as A, reload/retrieve it; B's row is unchanged. B and anonymous access cannot read/change A. Foreign IDs, owner reassignment, missing/forged credentials, and custom owner-ID GUCs fail.                                                                                    |
| Pool lifetime      | Pool size one; A, rollback, B, anonymous, expiry, disconnect, and cancelled-query sequences show no identity carryover. Failed cleanup destroys the client. A late response cannot refill private UI after logout.                                                                                                                                           |
| Privilege boundary | Connect using actual runtime logins; verify owners/flags/memberships and failed identity creation/escalation. Worker cannot connect as API/auth under DB authentication or read private tables after setting fabricated GUCs/job owner.                                                                                                                      |
| Shell navigation   | Keyboard and Galaxy viewport exercise menu, search destination, empty library, grid/list reload persistence, unavailable deep links, browser back, return-path rejection, drawer focus restoration, and reduced motion. Real item-inspector restoration remains future proof once item operations exist. Verify no private-content flash or fabricated item. |
| Availability       | API/DB unavailable produces retry states and no false login/logout success. Windows shutdown, actual Galaxy touch, and future tunnel cookie behavior require separate real-device/ingress evidence.                                                                                                                                                          |

For this docs PR, verify `git diff --check` and the changed-path allowlist against `origin/main`. `corepack pnpm check:docs` passed the existing workflow checks. Lint, typecheck, and unit tests were attempted but could not start because this checkout has no `node_modules`. The targeted formatting check passed using cached Prettier `3.9.10`, matching this repository's pin. These checks cannot prove the proposed auth design. Future implementation must run the repository quality gates plus relevant integration/e2e tests before review.

## Review

Ohad must approve the credential-to-RLS boundary, role separation, local bootstrap/recovery, seven-day session policy, and route/empty-state shape before implementation. This document remains proposed until that review. No approval is inferred from opening or merging a docs PR. A changed assumption returns the design to review.

Two independent Sol high-reasoning candidates explored different shapes. The configured Opus candidate hit a concrete usage limit and was rerun with Sol. Candidate A used an application-validated owner GUC; candidate B resolved a live credential inside PostgreSQL. Choose B for database-enforced identity, retaining A's narrow caller API, signup grant denial, and explicit proxy contract. A is smaller but fails the forged-GUC criterion. B costs a tightly reviewed privileged function and careful bearer handling. It avoids per-user database roles, a capability table, and a new job schema. Independent same-family review preferred B against identity forgery, privilege escalation, lifecycle, scaffold fit, and rollback. It found the stock logout mismatch and incomplete maintenance-policy detail; this revision addresses both and clarifies deferred inspector proof. This is independent reasoning, not cross-family corroboration or executed auth evidence.

Rejected alternatives are explicit.

- A trusted `owner_id` GUC alone makes omitted filters safer but lets arbitrary SQL impersonate another owner. Opaque TypeScript types do not repair that database boundary.
- A SECURITY DEFINER setter that writes a validated owner GUC still leaves a forgeable setting unless identity is held in protected state. Resolve the credential in the policy instead.
- One shared superuser login or `trust` authentication defeats role separation and RLS. A network tunnel or UI guard cannot replace application ownership.
- A Next.js auth handler conflicts with ADR 0004. A separate auth microservice adds another lifecycle without a requirement.
- Public signup, even with an email allowlist, expands account-creation and recovery paths. Provision locally instead. OAuth is not selected by the current requirements.
- Per-user PostgreSQL roles and general tenant/membership tables add provisioning and authorization machinery before collaboration is in scope. Owner columns retain the hosted-private-library path.
- Browser JWT/local-storage authority or cached session authorization makes revocation and secret handling harder. Use live database sessions and HttpOnly cookies.

## Merge danger

This PR is a reversible documentation change. Its direct blast radius is design guidance. The eventual auth schema, grants, password/session storage, and ownership policies are a one-way architectural commitment requiring Ohad's explicit approval and implementation evidence. This PR must not close issue #3 as implemented. No runtime, CI, protection, secrets, or deployment configuration changes are authorized here. Do not merge this PR as part of this task.

The future migration/rollback sequence must preserve that distinction.

1. After approval, take a verified backup before any populated database change. Provision isolated roles and apply additive auth/private tables, grants, policies, and resolver atomically where PostgreSQL permits. Role creation and credential distribution need a reviewed operator plan. Leave pgvector and existing migration history intact.
2. Verify deny-by-default behavior before starting serving processes with the new credentials. Bootstrap explicitly. Enable protected endpoints and shell only after the real-login, two-user, pool, and worker-denial proof passes. Migration failure blocks startup.
3. On application rollback, disable private endpoints or enter maintenance first. Retain tables, RLS, role separation, and credential-safe backups. The public foundation application must never receive private-data routes or privileged credentials. Revoke sessions if credential handling is suspect; require fresh login after recovery.
4. Prefer a forward repair of grants/policies/schema. Do not disable RLS to restore service. No automatic destructive down migration is proposed. Dropping populated auth/private tables or restoring a backup can lose identities, preferences, and later data; each needs explicit owner authorization, quiesced writes, and verified restore in an isolated location. No implementation may depend on reverting a migration to recover access.
