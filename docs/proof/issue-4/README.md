# Text-save implementation evidence

All examples and screenshots in this directory use synthetic content.

The implementation follows `docs/design/issue-4-text-save.md` at approved base
`1078256`. Direction A, Conservatory, is the selected visual direction. The
schema, RLS, limits, retry identity, literal original-only search, separate items
for new submission IDs and memory-only drafts were explicitly approved in the
implementation request.

## Delivery gates

1. Prepare pinned dependencies, pass environment/runtime checks and record the
   missing text-save journey through the real authenticated browser.
2. Verify contracts, immutable storage, owner isolation and authenticated API.
   Commit and push each green unit to `feat/issue-4-text-save`.
3. Verify capture, retained originals, literal search and recovery through the
   browser. Inspect desktop/mobile in light/dark and reduced motion.
4. Run the full quality, unit, integration and browser suites. Publish a draft
   PR with actual output and screenshots, then stop the isolated services.

`decisions.tsv` records consequential implementation and verification choices.
Passing a static check does not establish persistence or authorization.

## Environment observations

- The initial worktree was clean at `99ca810`. It was fast-forwarded to
  `origin/main` at `1078256` before implementation so the approved design and
  `docs/LESSONS.md` were available.
- Node 24.21.0 and pnpm 10.34.6 were selected. Frozen installation completed
  from the package cache after updating the baseline.
- The environment check passed. A direct runtime check without private runtime
  variables failed with `Docker Compose is unavailable or rejects compose.yaml
  and its environment.` The synthetic runner subsequently supplied its private
  variables and passed every runtime check.
- Project `sprout-text-save-4` encountered PostgreSQL initialization with
  `FATAL: the database system is starting up`. Its runner removed the container
  and network and retained the volume.
- Project `sprout-text-save-4b` migrated and configured separate runtime logins,
  then failed its existing service-readiness deadline. Its runner removed its
  container and network and retained its volume. No timeout or security gate
  was changed. An isolated import of `@sprout/runtime` subsequently completed
  in 30349 ms. That observation alone does not identify the timeout's cause.
- Project `sprout-text-save-4c`, with DB port 55476, API 3144, worker 3145 and
  web 5194, passed runtime preflight, migrations, login configuration and all
  service readiness checks. The baseline browser run passed 17 existing desktop
  cases and failed the new journey on its missing New card action. See
  `red-e2e.txt`.

## First green checkpoint

Commit `4930988` defines the browser-safe submission, receipt, saved original and
pagination contracts. The focused contract suite passed 14 tests, contracts
typechecking passed, and scoped ESLint and Prettier passed. The initial NUL-regex
lint error was corrected before this commit. It was pushed to the requested
feature branch.

`baseline-check.txt` is a partial overlapping check, not a full green baseline.
Contract edits began while its lint process ran, and the coordinator stopped
that process to avoid competing with the focused contract check. Its recorded
NUL-regex finding was fixed in `4930988`. A complete final check is still required.

## Remaining product boundaries

This issue introduces no AI job, scheduling, content merging, persistent offline
draft, Spaces, review acceptance or deletion operation. Saved text remains New
and its requests remain Not scheduled.

The existing export writer consumes supplied snapshots. It has no database
acquisition path or application endpoint. A future export integration must
include the new immutable originals, separate intents and submission identities.

Physical Galaxy behavior and production ingress are separate from emulated
mobile browser evidence. No deployment or merge is requested by this work.
