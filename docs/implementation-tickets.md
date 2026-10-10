# Sprout tickets — concise review draft

Published October 8, 2026. Draft IDs remain stable; each ticket links to its GitHub issue.

## Recommendation

- **Save first, understand second.** Originals enter the library immediately; AI failure or review cannot lose a save. Understanding is provisional until reviewed, but New items remain usable.
- **Human review is an interaction.** Pause, correct and approve through library/understanding operations; do not create a second knowledge store.
- **Keep the library focused.** It owns saved knowledge. Future Actions owns calendars, reminders and notifications; inferred execution requires approval. Those features remain deferred.
- **Avoid artificial gates.** Source adapters can be tested before Galaxy integration. Semantic search need not block the first grounded answer. Balance work by ownership, not equal ticket counts.

Categories organize tickets within the approved modular application; they are not separate services. BL stays with each feature. Shared public interfaces, write ownership and acyclic imports support parallel work; final completion requires real integration.

## Scope and decisions

Sources: [parent #1](https://github.com/Finz24/Sprout/issues/1), [product direction](product-direction.md), [specification](specs/sprout-personal-workspace.md), [architecture](architecture.md), [glossary](../CONTEXT.md), [testing boundary](specs/sprout-testing-boundary.md), and agent guides. The parent's undecided stack/capture/test statements are superseded by local approvals. Its stories remain unchanged; the parent stays untouched.

Approved, with the October 10 Option C replacement: pnpm/Nx/Corepack/strict TypeScript foundation; React/Vite/TanStack Router and shared shadcn-style UI/Tailwind/Motion; separate Effect HTTP API and Effect Node worker; PostgreSQL/Drizzle/pgvector; future pg-boss, Better Auth, private files and AI SDK; Docker Compose Watch and Playwright. Issue #2 has development-only [foundation acceptance](specs/foundation-development-environment.md); Windows hosting/named tunnel/Galaxy capture remains later work. Product acceptance requires displayed understanding. Research Off blocks extra lookup, not submitted-source acquisition or authorized analysis. Uploads use an explicit cap; chunking is deferred.

Still proposed: one initial provider, a small tested roster later, one validated initial publication, explicit repeat-save reuse/new choice. Exact models, spend/file/duration limits, language coverage beyond English and backup retention need implementation-time selection. No automatic reprocessing, preview adoption or action execution.

## Done standard — applies to every ticket

The ticket's checklist passes through real application behavior; persistence is checked after reload/retrieval. Applicable tests, typecheck, lint, format and build pass. Playwright uses real database/files/worker with controlled external failures; expectations come from requirements/known facts, never production algorithms or echoed mocks. Live-provider/device checks prove capabilities where claimed. Every new private surface rejects other-user access; originals/corrections stay protected. Credentials/private fixtures stay out of public issues.

When published, each issue includes this standard plus its checklist, story IDs and blocker reasons. No preparation step initializes Git, implements code, provisions services, commits/pushes or changes GitHub.

**First demo:** foundation 01 → access/layout 02 → text retention 03 → understanding 04 → correction 05; Spaces 07 proceeds alongside AI; search 06 and answer 09 finish corrected retrieval. Semantic discovery 08 is an independent expansion.

## Foundation

A reproducible, private application: tooling, access, shared GUI, recovery and release verification.

### 01. Initialize the monorepo

**GitHub:** https://github.com/Finz24/Sprout/issues/2

Create the Git/pnpm/Nx workspace and a reproducible build/run/check workflow.

**Definition of Done**

- [ ] Pinned Node via nvm-windows, Corepack, pnpm, Nx and strict TypeScript work from a fresh checkout; frozen lockfile resolves workspace dependencies.
- [ ] ESLint, Prettier, typecheck, meaningful tests and builds run locally and in pinned GitHub Actions. Forbidden imports, cycles and broken checks fail CI; affected tasks include consumers and handle a missing base commit.
- [ ] Docker/Compose runs web, worker and PostgreSQL readiness checks with persistent private volumes; restart preserves data. Local Nx cache excludes persistent tasks; no Nx Cloud requirement.
- [ ] Git setup preserves remote history and excludes secrets/build artifacts. Shared contract/UI conventions and applicable agent skills are documented without unsolicited global skill changes.
- [ ] Initial network steps and cached/offline setup are documented; prepared startup needs no downloads or CDN. Exact compatible versions are recorded.

**Stories:** No direct product story; enables all 80. Independently verified by the fresh-checkout/build/run/CI behavior above.

**Blocked by:** None. Can start immediately when implementation is authorized.

**Verification approach:** Verification rather than artificial unit tests: fresh-checkout install/build/check/run, intentional CI failures, private Compose readiness/restart and offline prepared startup.

### 02. Sign in and navigate the app

**GitHub:** https://github.com/Finz24/Sprout/issues/3

Provide private login and the responsive sidebar/library/search/inspector layout.

**Definition of Done**

- [ ] Owner bootstrap, login, logout and session expiry work after reload; public signup is disabled.
- [ ] Direct web/domain operations and transaction-scoped database ownership deny cross-user access, including pooled-connection reuse and worker identity spoofing.
- [ ] Sidebar, search, empty library and inspector navigation work with Galaxy touch, keyboard and reduced motion using shared shadcn tokens; no fabricated saved data.

**Stories:** 72.

**Blocked by:** 01 — verified workspace/runtime foundation.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Sign in as one synthetic user, reload, then attempt another user’s private operation and verify rejection.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 30. Prove backup restoration

**GitHub:** https://github.com/Finz24/Sprout/issues/31

Coordinate private records/files backups and restore a clean workspace.

**Definition of Done**

- [ ] Quiesce writes/publication for a consistent backup; resume safely, declare retention/location and keep the last valid copy through interruption.
- [ ] A clean restore verifies known hashes, ownership, originals, corrections, review, Space views and retrieval.
- [ ] Pending work reconciles without duplicate enrichment or commands; missing objects block completeness. Backup access and expiry are explicit.

**Stories:** 12, 31, 51, 67, 70, 72, 74, 76, 79.

**Blocked by:** 13, 25, 28 — restart recovery, persisted arrangement and Trash/file lifecycle.

**Verification approach:** Restore exercise rather than mocked success: restore a coordinated records/media backup into a clean isolated runtime; compare independently known files, corrections, ownership and retrieval through the application.

### 31. Accept the real-device pilot

**GitHub:** https://github.com/Finz24/Sprout/issues/32

Prove the integrated journey and record owner acceptance of AI and UX.

**Definition of Done**

- [ ] Galaxy/Windows complete save → real AI → original → correction → Space → corrected retrieval after reload and from the other device.
- [ ] All 16 corpus slots record supported/partial/failed/blocked outcomes, retained/analyzed evidence, source limits and measured job cost/time/storage.
- [ ] Control/failure/privacy/retry/Trash/export/restore trials and owner UX review pass for the claimed subset; unresolved required sources remain gaps, not fabricated full support.

**Stories:** 80 directly; 1–79 additionally exercised as integrated validation of the deliveries above, not a substitute for their acceptance checks.

**Blocked by:** 11, 15, 18, 20, 21, 22, 23, 24, 26, 27, 29, 30 — remaining feature deliveries and real-device integration.

**Verification approach:** Integration/owner evaluation rather than a new test boundary: run the complete real-device/provider corpus and approved failure variants; record observed evidence and accepted gaps.

## Source acquisition

Obtain available linked content. Return evidence and limitations; never pretend a URL is retained media.

### 16. Acquire generic links

**GitHub:** https://github.com/Finz24/Sprout/issues/17

Retain the submitted URL and collect bounded available page evidence.

**Definition of Done**

- [ ] Inspector distinguishes exact URL/intent, acquired page/metadata and inference; a live accessible page yields supported useful facts.
- [ ] Unavailable/partial sources name missing material and offer supplied-input recovery for unfinished work; a URL receipt never claims retained page/media bytes.
- [ ] Fetch limits reject unsafe/private-network destinations and redirects. Research Off permits submitted-source acquisition, not additional lookups.

**Stories:** 2, 12, 13, 17, 20, 33, 34, 35, 36, 67, 70, 79.

**Blocked by:** 14 — safe supplied-file intake and understanding prerequisites.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Save a controlled accessible URL, then an inaccessible/private-network URL; verify distinct receipt/evidence and honest refusal or missing context.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 21. Acquire YouTube context

**GitHub:** https://github.com/Finz24/Sprout/issues/22

Understand available transcript/media/context without overstating coverage.

**Definition of Done**

- [ ] A live source URL exposes a known beyond-title fact with supporting evidence and useful retrieval.
- [ ] Title/transcript/footage, comments and retained media are distinguished; blocked/private/deleted sources expose gaps and a supplied-file workaround.
- [ ] Correction and Space retrieval survive reload; owner evaluates supported/partial/unavailable outcomes. Galaxy share integration is checked in 20/31.

**Stories:** 2, 6, 13, 17, 33, 35, 58, 59, 79.

**Blocked by:** 16, 17 — bounded linked-source acquisition and supplied-video recovery.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Submit a controlled YouTube URL with known transcript evidence and an unavailable variant; verify useful supported facts without claimed footage.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 22. Acquire Instagram context

**GitHub:** https://github.com/Finz24/Sprout/issues/23

Understand available captions/images/reels and disclose missing context.

**Definition of Done**

- [ ] A live restaurant example retrieves only evidenced identity/location; captions never masquerade as footage analysis.
- [ ] Unavailable/private/deleted context remains an honest URL/intent save; supplied-file recovery is evaluated separately.
- [ ] Original downloads and corrections remain usable without Instagram; owner accepts or rejects observed source compromises. Galaxy sharing is checked in 20/31.

**Stories:** 2, 6, 13, 17, 33, 35, 58, 59, 67, 79.

**Blocked by:** 16, 17 — bounded linked-source acquisition and supplied-video recovery.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Submit a controlled Instagram caption-only source and unavailable variant; verify caption evidence never becomes claimed reel analysis.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 23. Acquire X context

**GitHub:** https://github.com/Finz24/Sprout/issues/24

Understand available posts, threads and media with explicit gaps.

**Definition of Done**

- [ ] Live post/media/thread examples distinguish submitted, acquired, retained and analyzed material; useful known details have correct evidence.
- [ ] Missing/private/deleted replies or media stay unknown; supplied-text/file recovery works without account scraping or login bypass.
- [ ] Corrected retrieval survives reload/Space organization; owner evaluates actual limitations. Galaxy sharing is checked in 20/31.

**Stories:** 2, 6, 13, 17, 33, 35, 58, 59, 79.

**Blocked by:** 16, 17 — bounded linked-source acquisition and supplied-video recovery.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Submit a controlled X thread with a missing reply; verify supported facts retain attribution and missing context remains unknown.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

## Capture

Receive owner submissions, intent and attachments. Return honest durable receipts.

### 14. Capture and understand images

**GitHub:** https://github.com/Finz24/Sprout/issues/15

Upload/paste/drop images with retained originals and actual visual analysis.

**Definition of Done**

- [ ] Known image text and visual facts are understood from retained bytes; uncertain/missing analysis is explicit. Downloaded bytes match and open offline, including while New or AI-failed.
- [ ] Type/payload limits apply in client and server. Interrupted multi-file intake reports retained/missing parts accurately and retries without duplicate attachments; staging is reconciled after crashes.
- [ ] Private previews/downloads require ownership; a live vision example proves image usefulness independently of controlled failure tests.

**Stories:** 3, 9, 12, 13, 14, 15, 17, 33, 35, 40, 64, 68, 70, 72, 79.

**Blocked by:** 04 — working understanding and durable intake prerequisites.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Upload an image with known text and a visual fact; reload/download matching bytes, then interrupt a second attachment and inspect an honest partial receipt.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 15. Capture tickets and documents

**GitHub:** https://github.com/Finz24/Sprout/issues/16

Retain PDFs/text documents and extract supported page evidence.

**Definition of Done**

- [ ] A synthetic ticket yields known details and identical downloadable bytes after reload; Research Off sends no private details to extra lookups.
- [ ] Scans, encrypted/corrupt/unsupported files expose analyzed pages and limitations without invented extraction; safely retained originals remain accessible.
- [ ] Bounded local extraction/vision uses pinned prerequisites; downloads and corrected retrieval work independently of the source app.

**Stories:** 5, 12, 13, 14, 15, 17, 33, 35, 38, 40, 70, 72, 79.

**Blocked by:** 14 — verified file manifest, private downloads and vision evidence.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Upload a synthetic PDF ticket with known event details; download it after reload and verify private details never enter prohibited research.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 19. Capture through Sprout chat

**GitHub:** https://github.com/Finz24/Sprout/issues/20

Explicitly save text, links or files with optional intent and Space.

**Definition of Done**

- [ ] A save returns a durable item receipt; asking a question alone creates no save. An inferred save needs approval.
- [ ] Optional clarification replies update owner context without replacing originals/corrections; unanswered questions do not block capture.
- [ ] Interrupted streaming/retries preserve receipt identity and report missing attachments; reload shows saved content. No messaging bot or advanced item-comments workflow.

**Stories:** 8, 10, 11, 12, 20, 66, 68, 71.

**Blocked by:** 12, 16 — optional clarification/Space UX and acquired-link/attachment handling.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Ask a question in chat, then explicitly save a note with intent; verify only the explicit save creates a durable item after reload.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 20. Share from Galaxy

**GitHub:** https://github.com/Finz24/Sprout/issues/21

Use installed PWA capture through authenticated named-tunnel HTTPS.

**Definition of Done**

- [ ] Actual Galaxy text/link/file shares produce honest receipts inspectable on Windows; record received payloads, including selected WhatsApp-origin material without chat-history access.
- [ ] Session expiry offers login/retry; offline Windows, interruption and oversized shares never show false success. Missing source-app attachments have explicit alternatives.
- [ ] Through the real stable hostname, touch navigation, streamed answers, private downloads/cache behavior and cap enforcement work; only web traffic is exposed.

**Stories:** 6, 7, 8, 9, 12, 13, 51, 52, 68, 71, 72, 79.

**Blocked by:** 19 — complete first-party capture routes to expose on Galaxy.

**Verification approach:** Real Galaxy/Windows verification with owner-provided hostname/tunnel prerequisites: actual source shares, expired sessions, interrupted uploads and unavailable Windows. Controlled browser tests alone cannot prove device compatibility.

### 27. Capture batches and repeat saves

**GitHub:** https://github.com/Finz24/Sprout/issues/28

Save bounded backlogs and preserve new context on intentional repeats.

**Definition of Done**

- [ ] Each batch entry reports its own receipt/failure; retries preserve successful entries and failed-entry intent/files/Space.
- [ ] Explicit reuse appends separate capture context/originals to a known item; choosing a new item creates a distinct receipt. URL similarity never silently merges.
- [ ] Retry the intentional submission: no extra capture context, lost attachment or overwritten correction. Batch/payload/processing limits hold after reload.

**Stories:** 10, 11, 12, 13, 16, 20, 48, 68, 69, 73.

**Blocked by:** 13, 14 — demonstrated retry/recovery semantics and multi-attachment intake.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Submit a small mixed batch, interrupt/retry, then deliberately reuse an item with new intent/file/Space; verify surviving contexts without duplicate receipts.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

## Understanding

Turn available evidence into useful summaries and facts under owner instructions and limits.

### 04. Understand a text save

**GitHub:** https://github.com/Finz24/Sprout/issues/5

Run real AI processing and display grounded summary, category and flexible facts.

**Definition of Done**

- [ ] A known recipe produces supported quantities/steps, English output and distinct intent; originals remain unchanged. Evidence, analyzed material and model/instruction snapshot are inspectable.
- [ ] Receipt/job handoff is transactional; restart resumes unfinished processing. Validated output publishes once under revision/lifecycle guards; failed or malformed output preserves originals and exposes repair.
- [ ] Application-enforced token/time/retry/concurrency/spend limits bound calls; source instructions cannot change rules or authorize writes. One authorized live-provider journey proves useful understanding.

**Stories:** 17, 18, 19, 20, 26, 33, 34, 35, 54, 61, 67, 70, 73, 78.

**Blocked by:** 03 — durable submitted originals and receipt identity.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Save a recipe stating 200 g flour; verify grounded facts, preserved original and a usable failed-processing state.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 10. Configure AI understanding

**GitHub:** https://github.com/Finz24/Sprout/issues/11

Persist instructions, examples, emphasis/detail and supported model selection.

**Definition of Done**

- [ ] Reload preserves owner settings; new processing records the settings/model snapshot used at attempt start.
- [ ] Changes launch no bulk reprocessing and leave existing understanding/corrections unchanged; AI cannot modify approved instructions.
- [ ] At least two tested generation choices expose capability limits without silent fallback; credentials stay server-side and other-user access fails.

**Stories:** 22, 23, 24, 25, 26, 28, 29, 72, 73.

**Blocked by:** 04 — provider execution and processing provenance.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Change instructions/model, save a new note and reload: the new snapshot changes while prior understanding/corrections do not.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 17. Understand supplied video

**GitHub:** https://github.com/Finz24/Sprout/issues/18

Retain bounded video files and analyze supported audio and visual evidence.

**Definition of Done**

- [ ] A known spoken fact and footage-only step use their actual analyzed modalities; coverage/timestamps and sampling limits are visible. Original download survives reload.
- [ ] Byte/duration/time/concurrency limits reject oversized or unsupported jobs honestly, without hidden truncation; bounded FFmpeg/transcription/vision remain restartable.
- [ ] A live short-video case proves usefulness. Failed analysis preserves originals; retries do not repeat completed stages or claim exactly-once billing.

**Stories:** 4, 12, 13, 15, 17, 33, 35, 40, 67, 70, 73, 79.

**Blocked by:** 14 — retained file, preview and multimodal evidence contracts.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Upload a short video with a known spoken fact and footage-only step; verify modality-backed results and an honest unsupported/oversized outcome.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 24. Research permitted gaps

**GitHub:** https://github.com/Finz24/Sprout/issues/25

Apply Off, Fill missing information and Deep research with attributed findings.

**Definition of Done**

- [ ] Persistent global/item policy is enforced before outbound lookup; mixed questions leak no Off content. Submitted acquisition and authorized cloud analysis remain separate.
- [ ] Saved evidence is consulted first; findings show source/date, inference and contradictions. Owner corrections always outrank findings.
- [ ] Application-enforced call/time/spend limits and concurrent reservations bound research, answers and previews. Usage/estimates are visible; failures preserve current data and source injection cannot loosen policy.

**Stories:** 31, 34, 35, 36, 37, 38, 73.

**Blocked by:** 09, 10, 16 — saved-data answers, owner policy settings and bounded fetch/evidence.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Ask using mixed Off/Fill items; inspect external lookup requests and verify no Off content leaks while permitted findings retain attribution.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

## Human review

Pause, correct, dispute, preview and approve. A review interaction, not another authoritative data store.

### 05. Correct understood information

**GitHub:** https://github.com/Finz24/Sprout/issues/6

Edit titles, tags, categories, intent, summaries and individual facts.

**Definition of Done**

- [ ] Correct a known recipe quantity; reload and retrieve the chosen value while Original input keeps its old value.
- [ ] Concurrent/late AI work cannot overwrite corrections; stale editors expose conflicts. Replaced facts never appear as current evidence.
- [ ] Corrections persist across organization changes and do not demand acceptance again; unauthorized edits fail.

**Stories:** 30, 31, 49, 55, 59, 62, 72.

**Blocked by:** 04 — generated understanding and guarded publication.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Correct 200 g flour to 250 g, reload and retrieve 250 g while Original input still contains 200 g.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 11. Preview instruction changes

**GitHub:** https://github.com/Finz24/Sprout/issues/12

Compare an isolated candidate with current output on selected samples.

**Definition of Done**

- [ ] An explicit preview changes requested emphasis/detail while known facts remain grounded; model/instructions and usage are visible.
- [ ] Current understanding, originals, corrections and review state remain unchanged after reload; candidates never enter search.
- [ ] Failure/cancellation respects policy/budget and leaves saved data usable. Candidate adoption, versions and rollback remain deferred.

**Stories:** 23, 24, 26, 27, 28, 29, 31, 73.

**Blocked by:** 05, 10 — correction protection and configurable instructions/model roster.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Preview changed recipe instructions; verify the candidate changes emphasis but the saved correction/search result remains unchanged.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 12. Review, pause and dispute

**GitHub:** https://github.com/Finz24/Sprout/issues/13

Inspect understanding and help processing through Needs your input.

**Definition of Done**

- [ ] New items remain usable; Accepted requires a previewed understanding revision. Stale previews cannot accept replacements; acceptance certifies no truth or action authority.
- [ ] Pause or cancel unfinished processing; late work cannot publish an obsolete attempt. Originals survive; cancellation does not promise refunded provider charges.
- [ ] Disputed claims stop being trusted evidence. Repairs and optional questions remain distinct; optional answers never block retention. Resolving one issue leaves unrelated issues/review state intact.

**Stories:** 32, 35, 39, 63, 64, 65, 66, 67, 77.

**Blocked by:** 05 — current understanding, corrections and revision-safe review.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Pause unfinished understanding and deliver its late result; verify it cannot publish, originals remain usable and stale review cannot accept it.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 13. Repair failed processing

**GitHub:** https://github.com/Finz24/Sprout/issues/14

Recover interrupted delivery, understanding or indexing without repeating completed work.

**Definition of Done**

- [ ] Interrupt/restart/retry a submission: one durable receipt survives or an honest unsaved outcome appears.
- [ ] Retry only unfinished stages; completed understanding is not regenerated, and index repair makes no enrichment call.
- [ ] Corrections survive late work; intervention appears once in Needs your input. Repair leaves unrelated issues and review state unchanged.

**Stories:** 31, 61, 66, 67, 68, 70, 71, 73.

**Blocked by:** 08, 12 — observable indexing failures and review/repair issues.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Interrupt a save and retry, then fail indexing separately: verify one receipt and stage-specific recovery without regenerated understanding.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 26. Approve suggested organization

**GitHub:** https://github.com/Finz24/Sprout/issues/27

Present AI Space-placement proposals for an explicit owner choice.

**Definition of Done**

- [ ] Generating a suggestion changes no membership/order; approve a specific proposal and reload to see the chosen result.
- [ ] Decline/dismiss preserves arrangement; stale approval cannot overwrite newer manual choices or loop endlessly.
- [ ] Proposals obey ownership/budget, differ from repair questions and schedule no deferred actions.

**Stories:** 43, 49, 53, 65, 66, 73.

**Blocked by:** 07, 12 — membership writes and explicit review/approval.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Generate a Space-placement suggestion, decline it and reload; membership stays unchanged. Approving a fresh proposal changes only the selected membership.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

## Library

Own durable originals, current understanding, corrections, tags, review state and lifecycle.

### 03. Retain a text save

**GitHub:** https://github.com/Finz24/Sprout/issues/4

Save original text and optional intent before any AI processing.

**Definition of Done**

- [ ] Exact Unicode original and separate intent survive reload/runtime restart; a New card opens Original input without AI or Space selection.
- [ ] Receipt follows durable commit; retrying its submission identity returns one item. Offline/unavailable hosting never reports Saved.
- [ ] Basic original-text search works without AI; requested future actions remain visibly Not scheduled and quoted commands execute nothing.

**Stories:** 1, 9, 11, 12, 14, 20, 39, 40, 54, 55, 62, 64, 68, 71, 72, 77, 78.

**Blocked by:** 02 — authenticated user context and private entry-point authorization.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Save Unicode text, reload, retry the same submission and inspect one unchanged original; an unavailable host must not show Saved.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 06. Search and filter the library

**GitHub:** https://github.com/Finz24/Sprout/issues/7

Find current information by text, names, tags, categories and status.

**Definition of Done**

- [ ] Combined filters find independently known items after edits/reload; replaced values are not presented as current facts.
- [ ] Empty library, no matches, processing and index delay are distinguishable; matches open their original.
- [ ] Exact retrieval survives AI outage and excludes other users and Trash; Space scoping consumes membership once available.

**Stories:** 39, 55, 59, 60, 61, 62, 64, 72.

**Blocked by:** 05 — authoritative current fields and correction semantics.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Correct an item’s tag/category, apply combined filters and verify current matching items after reload.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 28. Trash and restore items

**GitHub:** https://github.com/Finz24/Sprout/issues/29

Hide deleted information immediately and allow 30-day recovery.

**Definition of Done**

- [ ] Deletion during processing/answer generation excludes the item; stale work cannot resurrect it. Removing Space membership alone does not delete it.
- [ ] Restore within 30 days preserves originals, corrections, review and organization after reload without AI or command replay.
- [ ] Restartable expiry purge removes projections/unreferenced live files while preserving shared live bytes; ownership and backup-retention differences remain explicit.

**Stories:** 31, 49, 50, 67, 72, 75, 76.

**Blocked by:** 09, 14 — retrieval/lifecycle guards and shared-file retention.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Delete during delayed processing, restore within 30 days and reload; verify exclusion, preserved correction and no AI/action replay.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 29. Export the library

**GitHub:** https://github.com/Finz24/Sprout/issues/30

Download readable originals, current knowledge and owner organization.

**Definition of Done**

- [ ] Inspect the export outside Sprout: known file bytes, corrections, intent, evidence, subjects, settings and memberships/view preferences are present and distinguishable.
- [ ] Missing files, partial failures, omissions and Trash inclusion are explicit; credentials and other-user data never appear.
- [ ] Bounded export changes no library data or AI state; readable export is not reported as disaster-recovery proof.

**Stories:** 14, 15, 26, 31, 51, 72, 74, 79.

**Blocked by:** 05, 07, 14 — authoritative corrections, Space context and private originals.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Export a synthetic corrected library, open the package outside Sprout and verify known bytes, intent, facts and memberships.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

## Spaces

Organize references to library items; persist membership and presentation without copying content.

### 07. Create and manage Spaces

**GitHub:** https://github.com/Finz24/Sprout/issues/8

Create, rename and organize shared item memberships.

**Definition of Done**

- [ ] One item belongs to two Spaces; both show its same original and current correction after reload.
- [ ] Choose a Space during capture or leave it unset; add/move/remove membership with explicit touch/keyboard controls.
- [ ] Membership and Space removal leave library items intact; ownership and changes persist across sessions. Correction integration is checked when available.

**Stories:** 10, 11, 41, 42, 43, 47, 48, 49, 50, 51, 52, 55.

**Blocked by:** 03 — durable shared item identity.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Place one item in two Spaces, remove one membership, reload and verify the other membership and original remain.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 25. Arrange Space views

**GitHub:** https://github.com/Finz24/Sprout/issues/26

Persist manual order, grouping, filters and card/list presentation.

**Definition of Done**

- [ ] Arrange mixed items, change grouping/sort/filter/view and reload: preferences persist, with clear behavior when sorting overrides manual order.
- [ ] Touch/keyboard alternatives complement dragging; reduced motion, recognizable previews, inspector and search remain usable on both devices.
- [ ] Membership/filter/correction changes update the view without mutating originals, understanding or corrections.

**Stories:** 39, 40, 43, 44, 45, 46, 47, 49, 51, 52, 54, 55.

**Blocked by:** 07, 14 — persistent Space membership and mixed-media preview contract.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Arrange/group/filter representative cards, reload and verify order/preferences and unchanged original/correction.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

## Find assistant

Discover relevant items and answer from current, inspectable evidence.

### 08. Find by remembered meaning

**GitHub:** https://github.com/Finz24/Sprout/issues/9

Return relevant saved items from natural descriptions using semantic projections.

**Definition of Done**

- [ ] A paraphrase finds the independently known item and opens current evidence after reload; uncertain matches are labeled.
- [ ] Delayed embeddings cannot return replaced facts as current knowledge; exact retrieval remains available during embedding failure.
- [ ] Index repair uses stored current data without enrichment. Model identity/dimensions, ownership, lifecycle and usage bounds are enforced; a live example verifies usefulness.

**Stories:** 31, 55, 56, 59, 60, 61, 62, 72, 73.

**Blocked by:** 06 — working current-field retrieval and explicit index state.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Find a known note using a paraphrase, then delay embedding repair after correction and verify old facts are not current evidence.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 09. Answer with saved evidence

**GitHub:** https://github.com/Finz24/Sprout/issues/10

Ask across the library or one Space using current facts and linked evidence.

**Definition of Done**

- [ ] A recipe question returns the owner-corrected quantity and opens the right evidence/original after reload; Space scope excludes unrelated items.
- [ ] No matches, missing answer, pending indexing and AI failure are distinct; ordinary matches remain usable.
- [ ] Untrusted sources cannot authorize actions; answers obey ownership/usage limits. Exact retrieval supports the first answers; semantic matches participate when available.

**Stories:** 31, 35, 55, 56, 57, 58, 59, 60, 61, 62, 72, 73.

**Blocked by:** 06, 07 — current-field retrieval and Space scope; semantic discovery integrates when available.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Ask a Space-scoped recipe question after correcting 200 g to 250 g; verify 250 g and the right inspectable evidence.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

### 18. Find each subject in one item

**GitHub:** https://github.com/Finz24/Sprout/issues/19

Keep independently discoverable subjects and their own facts/evidence.

**Definition of Done**

- [ ] Three known restaurants are found separately without swapping their addresses; one item retains the shared original.
- [ ] Correct one subject: exact/descriptive questions use its correction without changing the others.
- [ ] Subject evidence, unknowns and conflicts survive reload and Space scoping; the same contract serves text and richer sources.

**Stories:** 18, 19, 21, 30, 31, 35, 55, 56, 58, 59.

**Blocked by:** 08, 09 — descriptive discovery and evidence-linked answers.

**TDD**

**Seam:** the already-approved application save-to-use journey.

**Red:** Save three synthetic restaurants with distinct known addresses; correct one and retrieve each without exchanging addresses.

**Green:** implement only enough behavior to pass; add the next DoD failure variant one cycle at a time. Mock external providers/sources, not internal modules or persistence. Additional test seams require agreement.

## Story coverage

Compact traceability: `story: ticket IDs`. Foundation 01 enables the scope; 31 additionally verifies the integrated release.

1: 03; 2: 16,21,22,23; 3: 14; 4: 17; 5: 15; 6: 20,21,22,23; 7: 20; 8: 19,20; 9: 03,14,20; 10: 07,19,27; 11: 03,07,19,27; 12: 03,14,15,16,17,19,20,27,30; 13: 14,15,16,17,20,21,22,23,27; 14: 03,14,15,29; 15: 14,15,17,29; 16: 27.

17: 04,14,15,16,17,21,22,23; 18: 04,18; 19: 04,18; 20: 03,04,16,19,27; 21: 18; 22: 10; 23: 10,11; 24: 10,11; 25: 10; 26: 04,10,11,29; 27: 11; 28: 10,11; 29: 10,11; 30: 05,18; 31: 05,08,09,11,13,18,24,28,29,30; 32: 12; 33: 04,14,15,16,17,21,22,23; 34: 04,16,24; 35: 04,09,12,14,15,16,17,18,21,22,23,24; 36: 16,24; 37: 24; 38: 15,24.

39: 03,06,12,25; 40: 03,14,15,17,25; 41: 07; 42: 07; 43: 07,25,26; 44: 25; 45: 25; 46: 25; 47: 07,25; 48: 07,27; 49: 05,07,25,26,28; 50: 07,28; 51: 07,20,25,29,30; 52: 07,20,25; 53: 26; 54: 03,04,25.

55: 03,05,06,07,08,09,18,25; 56: 08,09,18; 57: 09; 58: 09,18,21,22,23; 59: 05,06,08,09,18,21,22,23; 60: 06,08,09; 61: 04,06,08,09,13; 62: 03,05,06,08,09; 63: 12; 64: 03,06,12,14; 65: 12,26; 66: 12,13,19,26.

67: 04,12,13,16,17,22,28,30; 68: 03,13,14,19,20,27; 69: 27; 70: 04,13,14,15,16,17,30; 71: 03,13,19,20; 72: 02,03,05,06,08,09,10,14,15,20,28,29,30; 73: 04,08,09,10,11,13,17,24,26,27; 74: 29,30; 75: 28; 76: 28,30; 77: 03,12; 78: 03,04; 79: 14,15,16,17,20,21,22,23,29,30; 80: 31.

## Publication

All 31 tickets have enhancement/ready-for-agent labels, agent briefs and verified native blockers. Parent #1 is unchanged. Start with ticket 01; advance only when blockers are complete.
