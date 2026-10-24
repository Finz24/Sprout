---
name: react-doctor
description: Scan React changes before finishing a feature or committing, and handle requests to diagnose, triage, or configure React Doctor in Sprout.
---

# React Doctor for Sprout

Use the pinned repository executable and scripts in `package.json`. Read
`AGENTS.md` before applying fixes. The scripts scan all detected React projects
without network supply-chain checks or telemetry/score services; compare
diagnostics rather than a health score. Prepared dependencies support offline use.

## Verify React changes

Run the regression scan after changing React code:

```powershell
corepack pnpm run doctor:changed
```

Pass `--base <ref>` when a specific comparison point is required. Inspect every
new error and warning, fix regressions within the task's scope, and repeat the
scan until those findings are resolved. Report pre-existing findings separately.
Run the repository's required checks before reporting completion.

## Scan or triage

For a full diagnostic scan:

```powershell
corepack pnpm run doctor
```

For `/doctor`, an explicit triage request, or a cleanup pass, fetch the canonical
playbook and follow its scan, filter, triage, fix and validation workflow:

```powershell
curl.exe --fail --silent --show-error --header 'Cache-Control: no-cache' https://www.react.doctor/prompts/react-doctor-agent.md
```

This playbook lookup needs network access. Offline, use a previously prepared
copy if available; otherwise run local diagnostics and disclose that the full
playbook was unavailable. Keep commands on the pinned local executable and
preserve the task's agreed testing seams. Fetch the matching per-rule guidance
only when needed. Triage itself creates no commits or PRs.

## Rules and other modes

When explaining or configuring a rule, read
[references/explain.md](references/explain.md). Apply the narrowest requested
control and verify it with the local regression scan.

For a design audit or runtime profiling request, inspect the installed CLI's
`design --help` or `scan --help` and use its supported options. Runtime profiling
requires the user to reproduce an interaction. Treat traces as sensitive and
keep them local; obtain explicit authorization before uploading one. Use an
explicit CDP connection when the user requests their authenticated browser state.
