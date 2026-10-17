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

GitHub reported no rulesets and an unprotected `main` branch during final
verification. Repository checks cannot prevent a failing merge until required
checks are configured.

These checks cover engineering policy and the current foundation. Future issues
still need tests for their required behavior, persistence and authorization.

## Run evidence

- [Full repository check](agent-hardening-check.txt).
- [Runtime and desktop/mobile browser checks](agent-hardening-runtime.txt).
- [Decision trail](../agent-hardening-decisions.tsv).
