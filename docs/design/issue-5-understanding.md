# Understand a text save

Proposed for [issue #5](https://github.com/Finz24/Sprout/issues/5), October 25, 2026.
**Design review only. Implementation waits for Ohad's markup and the two
questions at the end.** This PR does not close #5. The
[red-pen sheet](issue-5-review.html) extends Conservatory from
[PR #42](https://github.com/Finz24/Sprout/pull/42) and the shipped
[PR #43](https://github.com/Finz24/Sprout/pull/43) library. All screen content is
synthetic.

## Problem

A retained text save still shows Understanding as Not started. The owner needs a
grounded summary, category, and flexible facts, with inspectable evidence and
the model or instruction snapshot. Originals stay unchanged. A failed call
preserves the save and names a repair. Restart resumes the unfinished attempt.

The first-release journey is [issue #1](https://github.com/Finz24/Sprout/issues/1)
and the [personal-workspace specification](../specs/sprout-personal-workspace.md).
[ADR 0002](../adr/0002-postgresql-and-durable-jobs.md) requires the receipt and
the durable job to share one transaction connection.
[ADR 0004](../adr/0004-effect-api-and-worker.md) keeps the Effect API and a
separate worker. Follow that stack, not the issue's historical Next.js wording.

This slice is text-only first understanding. Media, research lookups, Spaces,
corrections, acceptance as review, Trash, semantic index, and action execution
stay with their owning issues.

## Grounding

Inspected at `bef2e57` after the #43 merge.

| Boundary  | Current fact and design consequence                                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Originals | `private.saved_item` is insert-only under forced RLS. No UPDATE or DELETE grants. Never write original or intent columns.                                   |
| DTO state | `library-storage.ts` sets `understanding: 'Not started'` in memory. Same for New, live, and Not scheduled.                                                  |
| Save      | `Library.saveText` runs inside `privateOperation` and does not enqueue a job.                                                                               |
| Worker    | Health only. No pg-boss. No AI SDK. `sprout_worker` has no product-table grants. `privateOperation` needs a browser session, so the worker cannot reuse it. |
| Inspector | `TextInspector` leads with Original input. Story 54 wants useful understanding first.                                                                       |
| Shared UI | `@sprout/ui` exports `Button` and `Textarea` only. Named later components stay in Shared UI.                                                                |
| Settings  | `owner_settings` stores grid or list. No enrichment revision yet. Snapshot built-in defaults until [issue #11](https://github.com/Finz24/Sprout/issues/11). |
| Audit     | `validateRole` asserts the six-column saved-item shape and current grants. Child tables and worker writes must extend that audit.                           |

Open decision on initial publication: stage progress, then one validated
publish. Retries repair unfinished work. They must not silently regenerate a
completed understanding.

## Usage

These are proposed contracts, not executable additions. Parse unknown data once
at the HTTP or job boundary. Do not export rows, pool clients, or credentials.

```ts
// Save already exists. The same private transaction also inserts the job.
Identity.withRequest(request, Library.saveText(parsedInput));
// After #5, get returns derived understanding plus optional current draft.
Identity.withRequest(request, Library.get(parsedItemId));
// Worker, never the browser session:
Understanding.process(claim); // snapshot, call provider, validate, publish or fail
Library.publishUnderstanding(guard); // short worker transaction, once
Library.markAttemptFailed(attemptId, stage); // originals stay
Library.retryUnderstanding(itemId); // the only repair entry
```

```ts
interface Understanding {
  readonly process: (
    claim: JobClaim,
  ) => Effect.Effect<AttemptOutcome, ProcessFailure, WorkerAccess>;
}

type UnderstandingState = 'Not started' | 'Pending' | 'Ready' | 'Failed';
type UnderstandingView =
  | { readonly state: 'Not started' }
  | { readonly state: 'Pending'; readonly attemptId: AttemptId }
  | { readonly state: 'Ready'; readonly draft: PublishedUnderstanding }
  | { readonly state: 'Failed'; readonly issue: ItemIssue };
// Ready means one published row exists. Pending means an unfinished attempt.
// Failed means the latest attempt failed and no published row exists.
// AttemptOutcome = Published | Failed | RejectedStale | AlreadyComplete
```

One library publish hides revision, lifecycle, and "already published". The
worker owns provider calls and validation. The browser reads DTOs. Worker
access is a separate grant path. It does not borrow a session credential.

## Shape

Keep `saved_item` insert-only. Add owner-scoped child tables with composite
foreign keys `(owner_user_id, item_id)`.

- `processing_attempt`. Identity, item, settings snapshot (instructions
  revision, provider, model, research policy), analyzed material (`text`),
  timestamps, outcome (`queued`, `running`, `published`, `failed`,
  `rejected`), usage (tokens, ms, spend), and job id.
- `item_understanding`. At most one current row per item. Summary, category,
  English flag, distinct submitted-versus-inferred intent, fact list, evidence
  list, the attempt that produced it, and a revision token for later
  corrections on this same publish path.
- `item_issue`. Failed stage and repair operation for this slice. Independent
  of New or Accepted.

**Attempt, snapshot, validate, publish.**

1. Authorize the save as today. Inside the existing `privateOperation` client,
   insert the item, insert a `queued` attempt with the settings snapshot, and
   send the pg-boss job with that client's `db` adapter
   ([pg-boss per-operation `db`](https://github.com/timgit/pg-boss)).
2. The worker claims the job and marks the attempt `running`. Provider work
   stays outside the database transaction.
3. The adapter calls AI SDK `generateText` with `Output.object`,
   `abortSignal`, `maxOutputTokens`, `timeout`, and `maxRetries: 0` at the SDK
   layer. Application code owns the one stage retry. Schema validity is not
   factual correctness. `NoObjectGeneratedError` is a failed attempt, not a
   publish. No silent model fallback.
4. Validate in application code. Every fact cites original text, submitted
   intent, or unknown. Category is a string, not a rigid schema. English
   output. Submitted intent stays distinct from inferred intent. Quoted
   commands authorize nothing.
5. `Library.publishUnderstanding` runs a short worker transaction. It inserts
   the understanding row only when the item exists, lifecycle is live, and no
   current understanding exists. Success marks the attempt `published`. A
   second publish is rejected. Trash and corrections later add checks to this
   same guard. They do not get a second write path.
6. Malformed or provider failure marks the attempt `failed`, writes
   `item_issue`, and leaves originals readable. Needs your input is that
   issue. It is not a change to New.

**Restart.** An unfinished attempt plus its job is the resume unit. A worker
restart claims created or active jobs. One unique active attempt per item
blocks a second paid call. If the attempt stored a provider result, resume
validation. Do not call the provider again. If the attempt is `queued` or
`running` without a recorded finish, resume that attempt. A crash during a
live provider call may have spent money. After a two-minute lease with no
finish, mark the attempt failed and expose repair. Do not auto-spend a new
call. A published row is never regenerated. `process` returns already
complete when that row exists.

**Limits, pending measurement, not spend authority.** 4096 output tokens. 45 s
wall clock. One application retry of the failed stage. One concurrent
understanding job per owner. Byte limits stay the #4 text caps. Source text
cannot change these rules or authorize writes.

## Slices

Each implementation PR stays under 300 lines.

1. Additive tables, RLS, grants, `validateRole` audit. Worker gets only the
   narrow attempt and issue writes plus the publish function. No product UI.
2. Contracts and derived `UnderstandingView` on `SavedTextItem`. Library
   `publishUnderstanding` and `markAttemptFailed`.
3. pg-boss init and enqueue on the existing save client. Save still succeeds
   only after that commit.
4. Worker claim, provider adapter, and the numeric limits above.
5. Validate, publish, fail, and issue. Red test: recipe stating 200 g flour.
6. Conservatory inspector. Understanding first. Original input one control
   away. Failed plus Repair.
7. One authorized live-provider journey after Ohad answers the questions
   below. Mock providers in every other test.

## Visual review

The sheet extends Conservatory A on the shipped #43 light sage shell. Deep
green canopy, raised paper, Inter only, few words. Named shadcn targets:
`Card`, `Badge`, `Accordion`, `Separator`, `Tabs`, `Button`, `Alert`. Facts are
uneven tiles, not nested cards. Motion is one 220 ms panel reveal after a
committed Ready state, plus a 180 ms alert shake on Failed. Reduced motion
removes both. Status never waits on motion.

Inspiration, adapted only: [shadcn Card, Badge, Accordion, Tabs, Separator,
Alert](https://ui.shadcn.com/docs/components),
[Magic UI Bento](https://magicui.design/docs/components/bento-grid) for uneven
fact tiles, [transitions.dev](https://transitions.dev/) panel reveal and error
shake. No new font, registry, or product dependency in this PR.

Layouts, copy, and motion are reversible. Schema, RLS, publish-once, and
insert-only originals are the one-way door.

## Synthesis

Two architect families ran in parallel after the how pass. A keeps
`saved_item` insert-only and publishes by inserting the first understanding
row. B adds revision and lifecycle columns plus the first UPDATE grants on
`saved_item`. This session's Sol and Luna both kept originals insert-only.
Sol added a mutable `item_head` plus budget tables and 26 slices. Luna added
a revision row, budget tables, and a provider request id. Parent pick is A.
It hides the guard behind one insert and leaves the #43 immutability door
closed. Graft from B: store a revision token on `item_understanding` now so
later corrections call the same `publishUnderstanding` with an expected
revision. Graft from Sol: expose `UnderstandingView` as a discriminated DTO,
and add `Library.retryUnderstanding` as the only repair entry. Graft from
both this session's runners: persist the provider result before validation so
restart can finish without a second paid call. Reject B's UPDATE on
originals. Reject Sol's head table, 26-slice plan, and extra budget tables.
Reject Luna's request-id table for this first slice. Worker publish uses its
own grants, not a borrowed session. Live provider, model, and spend cap stay
with Ohad.

## Proof

The issue red step stays a later implementation test. Save a recipe that
states 200 g flour. After reload and a worker restart, expect a Ready item
whose flour fact is 200 g, English summary, distinct intent, unchanged
original, and an inspectable snapshot. A forced provider failure keeps the
original and shows Repair. Do not derive the expected 200 g from production
code.

This docs PR proves artifact quality only. Pinned install, `check:environment`,
and `corepack pnpm check` land in `docs/proof/issue-5-design/`. Playwright
renders the sheet on 1440 px desktop and Galaxy S9+ 320 px, light and dark.

## Review

Ohad's markup must resolve only these before product implementation:

1. Which live provider and model may run the one authorized journey.
2. The spend cap for that journey and for later processing.

Markup on numbered sheet IDs can still change copy, layout, and motion.

## Merge danger

**Door: two-way documentation. Future schema, RLS, and first UPDATE-like
publication rules are one-way.** Opening or merging this docs PR does not
authorize implementation, migrations, deployment, provider spending, or
closing #5. No product code is in scope. No merge is requested here.
