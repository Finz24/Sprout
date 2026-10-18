# Independent review

Luna reviewed environment changes and the decision evidence. Grok reviewed the
full hardening diff. Sol reviewed the fixes to Grok's findings in two subsequent
rounds. The final targeted review reported no findings.

## Findings resolved

- Commented pin commands and later floating tool installs could pass preflight.
  The checker now validates the supported Dockerfile tool instructions and rejects
  additional unversioned or floating installs. Environment tests cover the
  commented, abbreviated, bare, and direct pnpm install cases.
- Node builtin loaders and CommonJS methods could bypass workspace imports.
  Source rules now reject builtin-loader access, CommonJS globals and module
  methods, including the tested destructured, computed and aliased forms.
- Typed probes originally wrote temporary source files. They now use in-memory
  text against existing project paths. The probes verify both rejected and
  permitted code without mutating the checkout.
- A stale comment describing the deleted fixture lifecycle was removed.
- Saved run outputs now support the decision trail. Later rows supersede the
  earlier pending results and cached checks.

Comment review retained the explanations for the Nx graph initialization and
sanitized diagnostic handling. No unresolved comment findings remain.

## Limits

The Dockerfile checker supports the current tool-command layout. Changes to
that layout or additional build stages require reviewing the checker too.
It does not parse arbitrary shell programs.

GitHub initially reported no rulesets and an unprotected `main` branch on
October 17. The October 18 follow-up below records the protection added later.

These checks cover engineering policy and the current foundation. Future issues
still need tests for their required behavior, persistence and authorization.

## Follow-up on October 18

The owner authorized required-check protection. `main` now requires the five
existing GitHub Actions jobs, an up-to-date branch, and enforcement for
administrators. Force pushes and branch deletion are blocked. The settings were
read back from GitHub and saved in [the protection snapshot](main-branch-protection.json).

The first hosted run failed the typed-lint probes even though the local run
passed. CI mode caused typescript-eslint to infer immutable single-run programs,
which did not represent the changing in-memory probe text correctly. The test's
ESLint instance now disables that inference. Production lint configuration and
the expected diagnostics remain unchanged. CI-enabled and ordinary focused runs
both pass. The complete local check also passes with `CI=true`, `NX_DAEMON=false`
and `NX_SKIP_NX_CACHE=true`. It includes 129 unit tests, lint, typecheck, seven
builds, formatting, environment checks and documentation checks. This is local
evidence. The hosted rerun must establish its own result.

The gpt-6-luna audit confirmed the protection settings against live GitHub.
Its two wording findings were addressed by updating the explanation and appending
the exact parser option to the decision trail. No local transcript directory was
available to that reviewer, so its audit used the artifacts, scoped task facts and
live GitHub state.

See [the interactive explanation](hardening-explained.html) for each safeguard's
before and after behavior and examples.

## React Doctor and standard tools

React Doctor 0.9.18 now runs inside the local `check` command and the required
CI `quality` job. The full workspace scan fails on warnings and errors.
Telemetry and the network-backed supply-chain scan are disabled. The first
scan rejected a non-component export in `button.tsx`. Moving that styling
function to `button-variants.ts` preserves the package exports and removes the
warning without suppressing a rule. The subsequent scan reports no issues.
The independent review caught an overstatement about serial execution.
`--no-parallel` limits lint workers within each project, while projects can
still run concurrently. The development guide now states that distinction.

The source policies already use standard ESLint, typescript-eslint and Nx rules.
Prettier handles formatting. The regression tests exercise these installed rules
with permitted code and forbidden code. They do not implement another linter.
The compiler uses the standard `noEmitOnError` option.

At commit `a9bc6ce`, the PR added 1,826 lines. Of those, 162 were in the one new
environment script, 168 in configuration and workflows, 704 in regression tests,
and 792 in documentation and evidence. The environment script checks agreement
between repository pins, exported Compose settings and optional machine
prerequisites. Formatting rules cannot establish those facts. The independent
gpt-6-luna audit found no justified replacement or deletion using existing rules.

The earlier hosted rerun completed successfully for all five job types at
`a9bc6ce`. The React Doctor follow-up requires its own hosted verification.

## Run evidence

- [Full repository check](agent-hardening-check.txt).
- [Runtime and desktop/mobile browser checks](agent-hardening-runtime.txt).
- [Local check with CI mode enabled](agent-hardening-ci-check.txt).
- [Decision trail](../agent-hardening-decisions.tsv).
