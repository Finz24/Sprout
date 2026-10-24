# Agent instructions

## Current documentation

Use Context7 for library, framework, SDK, API, CLI and cloud-service
documentation. Resolve the library ID first, then query each distinct
concept separately. Prefer relevant official sources and version-specific
documentation when a version is specified.

This is not required for general programming, business logic, code review,
or refactoring that does not depend on library-specific behavior.

## Testing

- No tautological tests. This applies to Cypress tests, all other end-to-end
  tests, and unit tests.
- Derive expected results from requirements, independently known examples,
  or meaningful invariants. Do not compute expectations using the production
  logic under test or duplicate its algorithm in the test.
- Exercise real application behavior within the test's boundary. Mocks may
  control dependencies, but assertions must verify the application's response,
  not merely echo configured mock values or confirm test-created state.
- For Cypress and other end-to-end tests, perform the relevant user action and
  verify its observable outcome. When persistence is the requirement, verify
  the saved result after reload or retrieval, not just a success message.
- For unit tests, verify the public behavioral contract, including relevant
  edge and failure cases. Each test must be capable of catching a plausible
  regression in the behavior it claims to cover.

## Agent skills

### React Doctor

Before finishing React changes or handling React Doctor diagnostics, triage or
rule configuration, read `.agents/skills/react-doctor/SKILL.md`.

### Issue tracker

Track specs and issues in GitHub: Finz24/Sprout.
Before tracker operations, read `docs/agents/issue-tracker.md`.

### Triage labels

Use the five canonical triage labels.
Before triaging or applying triage labels, read `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` and `docs/adr/`.
Before exploring or changing product behavior, read `docs/agents/domain.md`.
