# Retain a text save

Proposed for [issue #4](https://github.com/Finz24/Sprout/issues/4), October 24, 2026. **Design review only. Implementation waits for Ohad's markup and explicit
approval of the schema/RLS and capture experience.** This PR does not complete or
close #4. The [numbered red-pen sheet](issue-4-review.html) presents three visual
directions; A is recommended. All screen content is synthetic.

## Problem

The owner needs to keep text and a separate reason for saving it, see an honest
receipt, and find the original later. Saving must work without AI or choosing a
Space. A lost response must not create a second item or turn an uncertain write
into a false success.

The north star is [issue #1](https://github.com/Finz24/Sprout/issues/1) and the
[current personal-workspace specification](../specs/sprout-personal-workspace.md).
The latter incorporates later decisions that #1 does not contain. In particular,
#4's historical Next.js implementation wording is superseded by accepted
[ADR 0004](../adr/0004-effect-api-and-worker.md): React/Vite/TanStack Router, an
Effect API and separate worker. Follow that accepted stack, not the old wording.

This is a useful text-only checkpoint in the full save-to-use journey. Media,
source acquisition, AI understanding, Spaces, corrections, semantic answers,
acceptance, Trash and action execution remain with their owning slices.

## Grounding: what exists

The [approved #3 design](issue-3-auth.md) supplies the Problem / Shape / Proof /
Review / Merge danger pattern. The current implementation, inspected at this
branch's base, supplies these constraints:

| Boundary           | Current source and design consequence                                                                                                                                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request access     | `packages/database/src/identity.ts` keeps `Identity.withRequest` local to its adapter. It validates a live session and supplies server-only `RequestAccess`. Extend a narrow authenticated dispatcher rather than exporting credentials or pretending this is already a public service.                  |
| Private SQL        | `packages/database/src/private-storage.ts` owns `privateOperation` and `transaction`. One checked-out client runs READ COMMITTED, `SET LOCAL ROLE sprout_web`, the transaction-local session credential and `private.current_owner_id()`. Its result is exposed only after COMMIT.                       |
| Database authority | The resolver validates the live database session; a request owner field or arbitrary owner GUC cannot grant access. Existing auth/private role separation and forced RLS remain constraints.                                                                                                             |
| API composition    | `apps/api/src/main.ts` starts the runtime; `packages/runtime/src/index.ts` dispatches `/api/*` through `AccessHttp`. The identity adapter has a strict method/path allowlist. Both need deliberate integration for new private routes.                                                                   |
| Browser            | `apps/web/src/main.tsx`, `shell.tsx` and `session.ts` provide guarded routes, view preference, an empty Library, unavailable search and inspector placeholders, cancellation and auth-generation checks. Add real cards and original access at those routes; placeholders are not implemented retrieval. |
| Visual language    | `apps/web/src/styles.css` and `access-layout.tsx` contain the #37 greenhouse sign-in: deep green, sage, pale background, local Inter. The general shell still uses system-ui; proposed capture surfaces extend the approved Inter language without changing code in this PR.                             |
| Storage            | `packages/database/src/schema.ts` currently has auth and owner settings, no saved-item table. `validateRole` checks a fixed protected-table set; extend its audit with the future migration rather than weakening it.                                                                                    |

Also read: [architecture](../architecture.md), [ADRs 0001–0004](../adr/),
[product direction](../product-direction.md), [acceptance scenarios](../acceptance-scenarios.md),
[action flows](../action-flows.md), [domain glossary](../../CONTEXT.md) and
[approved testing boundary](../specs/sprout-testing-boundary.md). The testing
boundary's historical “no suite” wording is stale: `tests/e2e` now exercises auth
and the shell, but no text-save journey exists yet.

## Usage: the caller's view

These are proposed contracts, not executable additions. Browser-safe Effect
schemas define requests and DTOs in `@sprout/contracts`; inferred, branded types
distinguish submission IDs from item IDs. Parse unknown data once at the HTTP
boundary. Do not export database rows, pool clients or session credentials.

```ts
// Browser: freeze this payload once when Save is chosen.
const input = { submissionId: crypto.randomUUID(), originalText, savingIntent };
// POST /api/library/text; retries send this same identity AND exact payload.
// Only a validated committed receipt permits the UI to display Saved.

// Server composition, inside the existing private adapter:
Identity.withRequest(request, Library.saveText(parsedInput));
Identity.withRequest(request, Library.get(parsedItemId));
Identity.withRequest(request, Library.searchOriginal(parsedQuery));
```

```ts
// Signature sketch: identifiers and request/result types derive from schemas.
interface Library {
  readonly saveText: (
    input: TextSubmission,
  ) => Effect.Effect<SaveReceipt, SaveFailure, RequestAccess>;
  readonly get: (
    id: SavedItemId,
  ) => Effect.Effect<SavedTextItem, AccessFailure | NotFound, RequestAccess>;
  readonly list: (
    page: LibraryPage,
  ) => Effect.Effect<SavedTextPage, AccessFailure, RequestAccess>;
  readonly searchOriginal: (
    query: LiteralQuery,
  ) => Effect.Effect<SavedTextPage, AccessFailure, RequestAccess>;
}

type SaveFailure = AccessFailure | InvalidSubmission | SubmissionConflict;
// TextSubmission = submissionId + originalText + savingIntent: string | null.
// SaveReceipt = submissionId + itemId + retainedAt + retained: 'text'.
// SavedTextItem = receipt identity + originalText + submittedIntent + New state.
// All result types exclude credentials and authoritative browser owner IDs.
```

One operation hides transaction ownership, exact payload comparison, races and
receipt construction. The caller controls the text and logical submission, not
the database stages. Keep the implementation in one library-owned storage
operation adjacent to private storage; runtime owns composition, contracts own
wire validation, web owns presentation. Do not create generic CRUD or one wrapper
per table. Extending the identity dispatcher's authenticated composition is a
necessary future integration change, not an existing exported API.

## Shape: original, identity and receipt

Choose one immutable `private.saved_item` row for this slice. It contains an item
identity, owner, logical submission identity, exact original, submitted saving
intent and server retention time. The receipt is a projection of that committed
row, not another success flag or editable copy. Later understanding/current facts
must live separately and cannot overwrite original fields.

- Preserve valid Unicode scalar values exactly, including Hebrew, emoji,
  combining marks, whitespace and CR/LF. Do not trim, normalize, lowercase,
  summarize or concatenate intent into the original. Render with `dir="auto"`
  and whitespace preservation; render submitted markup as text.
- Reject NUL and unpaired UTF-16 surrogates explicitly before PostgreSQL/JSON
  conversion can alter them. Explain unsupported input without changing it.
- Proposed limits for approval: original up to 64 KiB UTF-8, optional intent up
  to 4 KiB, bounded total JSON body 512 KiB (including JSON escapes). Reject
  whitespace-only originals, using a validation view without mutating stored text.
  Empty intent maps to null at the UI boundary before payload freeze; nonempty
  intent keeps its exact characters. Direct API clients must send string or null.
- The browser chooses a UUID once per deliberate Save. Double-click and Retry
  reuse it. A deliberate subsequent Save creates a fresh identity, even for the
  same text. A retry with a changed original or intent is a conflict, never an
  update. Compare complete values deterministically, not hashes alone.
- Distinct deliberate exact-content reuse, preserving multiple contexts on one
  item, belongs to the broader capture flow. #4 proposes separate items for fresh
  IDs and exposes no duplicate-merging control. This bounded deviation needs
  approval; it must not be described as completion of the full capture contract.

### Drizzle and RLS sketch: the one-way door

Conceptual additive migration, **not a migration to apply from this PR**. Follow
the installed Drizzle version and existing `privateData`/`user` declarations.
SQL below owns policy/grant details, avoiding dependence on newer RLS DSL syntax.

```ts
const savedItem = privateData.table(
  'saved_item',
  {
    id: uuid('id').primaryKey(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    submissionId: uuid('submission_id').notNull(),
    originalText: text('original_text').notNull(),
    submittedIntent: text('submitted_intent'),
    retainedAt: timestamp('retained_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('saved_item_owner_submission').on(t.ownerUserId, t.submissionId),
    unique('saved_item_owner_identity').on(t.ownerUserId, t.id),
    index('saved_item_owner_recent').on(t.ownerUserId, t.retainedAt, t.id),
    check(
      'saved_item_original_size',
      sql`octet_length(${t.originalText}) between 1 and 65536`,
    ),
    check(
      'saved_item_intent_size',
      sql`${t.submittedIntent} is null or octet_length(${t.submittedIntent}) <= 4096`,
    ),
  ],
);
```

```sql
ALTER TABLE private.saved_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.saved_item FORCE ROW LEVEL SECURITY;
REVOKE ALL ON private.saved_item FROM PUBLIC, sprout_api, sprout_auth, sprout_worker;
GRANT SELECT ON private.saved_item TO sprout_web;
GRANT INSERT (id, owner_user_id, submission_id, original_text, submitted_intent)
  ON private.saved_item TO sprout_web;
CREATE POLICY saved_item_read ON private.saved_item FOR SELECT TO sprout_web
  USING (owner_user_id = private.current_owner_id());
CREATE POLICY saved_item_insert ON private.saved_item FOR INSERT TO sprout_web
  WITH CHECK (owner_user_id = private.current_owner_id());
```

Insert owner through `private.current_owner_id()`, never from HTTP. Generate item
ID on the server. The column grant prevents supplying a fake retention time;
there are no runtime UPDATE/DELETE grants or policies. Do not change default
privileges to grant future tables automatically. The migrator owns the table,
not a serving role. Audit memberships, role flags, grants and forced RLS in the
existing startup validation and real-login tests. Preserve worker/auth denial.
Any future child reference uses `(owner_user_id, item_id)` with a matching
composite FK so a valid foreign item cannot be attached to another owner.

Review is logically New and lifecycle live in #4; return these as fixed derived
states instead of persisting mutable enums with no operations. Later review,
Trash, versions and publication must add their independent state deliberately.
**Before introducing deletion/purge, reserve submission identities durably in a
tombstone or ledger. Never delete the only retry identity and let an old retry
recreate or restore an item.** This prerequisite applies to maintenance/restore
tools too. Future backup/export implementations must discover and include the new
table and exact original/intent; existing #30/#31 delivery is not proof that a
future table is included. Coordinate that integration in the implementation plan.

### Commit and retry sequence

1. Authorize each request and validate canonical origin, JSON content type and
   bounded body. Use the existing session/CSRF boundary; no anonymous write path.
2. Inside one `privateOperation`, INSERT with `ON CONFLICT
(owner_user_id, submission_id) DO NOTHING RETURNING ...`.
3. If a conflict occurred, run a separate SELECT on that same client. At READ
   COMMITTED its fresh statement snapshot sees a competing committed insert.
   Do not use a single insert-or-select CTE with an earlier snapshot.
4. Compare exact stored text and nullable intent. Return an internal decision:
   retained row or conflict. Never `DO UPDATE` the original to resolve a race.
5. Let the existing wrapper finish COMMIT before mapping the decision to a
   receipt or public `SubmissionConflict`. Its catch maps unknown thrown errors
   to Unavailable, so throwing a new conflict inside the callback would lose its
   meaning. A typed returned decision preserves the distinction.
6. If COMMIT/connection outcome is uncertain, destroy the connection per the
   existing transaction helper and return unavailable. No blind backend retry.
   The client retains the frozen submission and retries that identity: an
   existing row returns its original receipt; an absent row is inserted once.

The unique constraint serializes racing identical IDs without an application
lock. A same-ID/different-payload race has one winner and one conflict, with no
replacement. Timeout/cancellation must settle the active operation and destroy
an unsafe client; an Effect interruption alone does not prove SQL stopped. No
provider/network work occurs in this transaction.

ADR 0002 requires receipt and durable processing job to share a transaction when
processing is introduced. #4 initializes neither jobs nor AI; do not insert a
fake job or label the item Processing. Adding real processing later must extend
this same atomic boundary before displaying a queued state.

### HTTP and search contract

Proposed same-origin endpoints: `POST /api/library/text`, `GET /api/library/items`,
`GET /api/library/items/:itemId`, and `GET /api/library/search?q=...`.
Return 200 with the stable receipt for both first save and same-payload retry;
400 invalid input, 409 submission conflict, 401 unauthenticated, and 503 unavailable.
Missing and foreign item IDs both return the same 404. All private responses,
including errors, are `Cache-Control: no-store`; no raw SQL or text in logs.

The authenticated `/search?q=...` route becomes **Search original text**. Use
parameterized SQL `strpos(original_text COLLATE "C", $1 COLLATE "C") > 0`, under
the same RLS scope. Case-sensitive literal substring matching makes `%`, `_`,
backslash and quoted commands ordinary characters. No AI, stemming, accent
folding, intent search or cross-language promise. Explain the scope beside results.
An empty query asks for text instead of returning the whole library as a match.
Cap query length at the existing 500-character UI bound, reject longer API input,
and paginate results/recent items by stable `(retained_at, id)` with at most 50
rows. Validate cursors as data, never SQL. A first owner-scoped scan is acceptable;
measure before adding a disposable search projection. “No matches” requires a
successful query; failed queries display unavailable, not zero results.

## Independent states and honest availability

| Dimension     | #4 behavior                                                                              | Future seam                                                                       |
| ------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Submission    | Editing → Saving → confirmed receipt, validation error, conflict, or unconfirmed outcome | Transport state is not an item lifecycle enum.                                    |
| Preservation  | Exact text and separate intent retained at commit                                        | Media manifests/full-versus-partial preservation later.                           |
| Understanding | Not started; no AI or worker job                                                         | Pending/ready/failed when processing actually exists.                             |
| Review        | New; original access and search work immediately                                         | Accepted only after reviewing displayed understanding; opening is not acceptance. |
| Retrieval     | Literal original search available synchronously                                          | Semantic index pending/ready/failed remains independent.                          |
| Attention     | Specific save errors remain on the form                                                  | Needs your input issues belong to their future operations.                        |
| Lifecycle     | Live, no deletion operation in #4                                                        | Trash/purge requires identity retention and exclusion rules first.                |
| Actions       | Always Not scheduled; no executor or timer                                               | Fresh reviewed authorization required in a later slice; no replay.                |

Display **Not scheduled** beside optional intent and on the saved original view:
“Requests in this text are kept only. Nothing is scheduled.” This unconditional
notice avoids an unreliable command parser. Quoted source commands and owner
intent remain separate text; neither invokes tools, schedules work or changes
instructions. Opening, retry, reconnect, acceptance, restore and future feature
availability cannot replay them.

While Saving, keep fields readable and prevent duplicate submit. Before a
confirmed receipt, never show Saved or add a confirmed library card. A known
pre-send offline state says “Not sent. Check your connection.” A timeout, proxy
error or lost reply says **“Save not confirmed. Retry to check.”** Do not assert
that nothing reached storage. Retry resends the frozen identity and payload.
Show Copy text, and explain that the unsent draft exists only in this open tab.
No localStorage, IndexedDB, service-worker queue, background retry or reload
recovery is promised. Editing after an uncertain attempt must first resolve it
or explicitly start a new save with a possible-duplicate warning; never silently
reuse an ID with changed content.

On 401, hide private views and clear pending private data under the existing
logout/expiry policy; warn that the tab draft will be lost and offer copying
before a voluntary navigation where possible. Do not put the body in a return
URL. On 503 keep the submitting form in memory while the authenticated page
survives. Every request/response participates in `session.ts` cancellation and
auth-generation checks so a late receipt cannot repopulate a logged-out UI.

## Visual review and reversible choices

The sheet keeps the approved greenhouse palette and Inter. It embeds the
existing licensed Inter asset for a single offline file; no new font or remote
asset. It shows alternative compositions, not three separately authorized
implementations. Every meaningful group/control has a visible markup identifier.

- **A — Library-side composer (recommended):** browse context remains visible;
  the new card and receipt have an obvious place. On Galaxy it becomes a focused
  full-width form, keeping the receipt near the next step.
- **B — Focused workbench:** generous writing room and quieter attention; leaving
  the library increases navigation and makes repeat capture slower.
- **C — Inline new card:** the result resembles its eventual card from the start;
  long originals and errors compete with the surrounding grid.

Preserve grid/list preference and current navigation; use a text excerpt, not a
fabricated AI title or illustration, for the new card. Saved receipt identifies
text retention time and item, and links to Original input. Desktop inspector and
phone full-width detail use `/library/items/$itemId`. Keep the preceding
library/search route for Back; a direct item URL falls back to Library.

Implementation accessibility: explicit field labels, logical tab order, 44px
targets, visible focus, error association, polite Saving/Saved announcement,
alert for failed confirmation, `dir=auto` original, and focus moved to receipt
heading only after commit. Closing restores the New card trigger, with a draft
loss check when needed. Reduced motion removes spatial animation; status never
depends on motion or color. Static sheet controls are specimens, not working
saves. Responsive screenshots prove document rendering only; actual Galaxy
touch, keyboard, ingress and screen-reader behavior need implementation evidence.

Layouts, copy, spacing, radius, theme treatments, pagination and later search
optimization are reversible. **Schema/RLS, immutable-original semantics,
ownership and retry identity are the one-way door:** populated data and privacy
depend on them. Do not infer their approval from an attractive screen.

## Synthesis decision

Two read-only medium-effort candidates used the configured architect runners,
Sol and Luna. A stored submission identity on the immutable item; B separated
submission ledger, original and item. A separate Luna judge scored preservation,
database authority, retries, bounded scope and lifecycle safety: A 9/10, B 9/10.
It recommended A with a purge gate. Parent review agrees: one save operation and
one row hide more complexity behind less public surface. Adopt B's explicit
identity-lifetime requirement as the deletion prerequisite above. Reject B's
three-table machinery for this text-only slice; it adds cross-table ownership
and redundant receipt state before deletion/reuse needs it. No cross-family
architecture corroboration or runtime proof is claimed.

Both passed a design-red-flags review for one write owner, private internals and
caller simplicity. Reject content-hash-only deduplication, frontend-only owner
filters, one global status, “Saved” on send, and offline queues. They either erase
intent, weaken privacy or promise behavior outside #4. The visual Opus runner
failed with a usage limit before producing an artifact; the configured Luna
fallback produced an initial sheet under the same brief. Parent visual review found undersized text, missing element IDs and weak composition; the parent rebuilt the final sheet and checked the resulting captures.

## Proof: the implementation's TDD red step

Extend the existing application Playwright journey against real PostgreSQL and
the isolated worktree runtime. Do not mock internal persistence or substitute
sheet screenshots for running behavior. Add the issue's red test first: sign in,
Save independently specified Unicode text and separate intent, reload, retry
the same submission and inspect one unchanged original; an unavailable host
must never show Saved. The current shell should fail because capture is absent,
not because a test setup failed. Record that actual failure before implementation.

Use a synthetic constant containing `שלום`, `🍋`, both `é` and `e\u0301`, blank
lines, leading/trailing spaces and a quoted command. Expected text is that
constant, not production serialization or normalization logic. Inspect complete
textContent/value independently of a visual excerpt. Add one DoD failure variant
per green cycle, keeping the approved external boundary:

| Case                 | Observable evidence required                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Durability           | Save → receipt → open Original input → reload → restart API/worker → reopen/retrieve from retained database; exact original and separate intent unchanged.                                              |
| Lost acknowledgement | Cut response delivery after a real commit; UI remains unconfirmed. Retry same ID/body, get identical item/submission/time and one card. Verify via authenticated retrieval, not a toast alone.          |
| Race/conflict        | Concurrent same-ID equal payload gives one receipt/item; changed original or intent gives 409, winner unchanged. No duplicate or replacement after restart.                                             |
| Deliberate repeat    | New submission ID retains its new intent separately and does not alter the first original. Explicitly record deferred exact-content reuse.                                                              |
| Search               | Find known original substring without AI, open it; `%`, `_`, backslash and combining forms are literal. Wrong case/intent-only query follows the documented no-match rule; outage is not empty results. |
| Authority            | Second synthetic owner cannot list/search/get/retry another owner's item; anonymous, expired session, forged owner body/GUC fail. Actual runtime worker/auth logins cannot access the table.            |
| Unavailable          | Host/API/DB unavailable before and during save, rollback, uncertain commit, cancel and pool reuse: no false Saved, same identity retry after recovery. Do not stop another worktree's/shared API.       |
| Inert actions        | Owner intent and quoted reminder/calendar/tool instructions remain exact text, visibly Not scheduled, no side effects after retry/reconnect/restart.                                                    |
| Presentation         | Desktop and Galaxy viewport, light/dark, grid/list, long/RTL text, keyboard/focus, validation, unavailable/retry, receipt and Back; no overflow or private flash on logout.                             |

If deterministic commit/concurrency fault injection cannot be observed reliably
through this journey, propose the narrow real-PostgreSQL seam for agreement
before adding it; the issue explicitly requires agreement for new seams. No
tests are added or claimed red/green by this design PR. The complete mixed-media,
AI, correction, Space and real-device journey remains unproven.

For this docs PR, the PR body records actual pinned install, environment,
format/lint and full `corepack pnpm check` output, plus Playwright-rendered sheet
screenshots under `docs/proof/issue-4-design/`. These establish artifact quality,
not persistence or authorization. Context7 checked [Drizzle constraints](https://orm.drizzle.team/docs/indexes-constraints),
[RLS concepts](https://orm.drizzle.team/docs/rls) and [Effect 4 scoped resources](https://effect.website/docs/v4/resource-management/scope).
The local pinned source remains the authority for exact integration APIs; no
unverified newer RLS DSL or new dependency is required by this sketch.

## Review

Ohad's markup must resolve these before product implementation:

1. Approve A/B/C or mark specific numbered elements to combine; confirm greenhouse
   Inter extension into Library, mobile layout and light/dark treatment.
2. Approve immutable row + forced RLS, exact equality and commit-only receipt,
   with the durable identity prerequisite before any purge.
3. Approve the proposed numeric input limits, case-sensitive original-only search,
   fresh-ID separate-item checkpoint and no persisted offline draft. Deliberate
   content reuse and the complete capture flow remain deferred explicitly.
4. Confirm the unconditional Not scheduled notice and absence of processing or
   acceptance controls before those operations exist.

## Merge danger

**Door: two-way documentation change; future schema/RLS is one-way. Blast radius:
design guidance.** Opening or merging this docs PR does not authorize product
implementation, migrations, deployment, provider spending or closing #4. No
product, test, package, CI or shared-agent configuration changes are in scope.
No merge is requested here.

After approval, the next implementation step is the real failing save-to-use
journey above, then the additive schema and narrow authenticated library
operation. Before a populated migration, take and verify an isolated backup;
apply additive schema/grants/policies atomically, verify denial with real roles,
then enable routes. Migration failure blocks startup. Roll application routes
back or enter maintenance while retaining data/RLS; repair forward. Never
disable RLS or drop populated originals to recover service. Destructive restore
or deletion requires separate authorization and must not replay old actions.
