# Issue #8 design evidence

Round 2 redo. These captures show the static [red-pen sheet](../../design/issue-8-review.html),
not a running Spaces flow. All names and originals are synthetic. No product
code changed. No app services or Docker stacks started. Full-page section
captures stay local and gitignored. Light and dark specimens for empty list,
populated list, view, capture, and delete are committed. Re-run `capture.mjs`
to regenerate every file.

## Review artifacts

- `desktop.png` and `mobile.png`: the first 10,000 pixels of the sheet.
- `desktop-spaces-list.png` through `mobile-empty-delete.png`: each numbered
  section on both device classes.
- `desktop-list-empty-light.png`, `desktop-list-light.png`, and the matching
  view, capture, and delete files: complete specimens for light and dark.
- `render-evidence.json`: viewport, overflow, loaded Inter, Unicode, unique IDs,
  reduced motion, script errors, and external requests.

The document is responsive at 1440 CSS px and the Playwright Galaxy S9+ profile.
That profile is viewport emulation, not a physical Galaxy test.

Inter is embedded from `apps/web/src/assets/inter-variable.woff2`. Hebrew and
emoji use the platform glyph fallback where Inter lacks coverage.

## Reproduce

```powershell
node docs/proof/issue-8-design/build-sheet.mjs
corepack pnpm exec prettier --write docs/design/issue-8-review.html docs/proof/issue-8-design/*.mjs docs/proof/issue-8-design/README.md
node docs/proof/issue-8-design/capture.mjs
corepack pnpm check
```

## Executed checks

Recorded in the PR body after a fresh `corepack pnpm check`. Sheet proof is
Playwright against the static HTML. It is not persistence, RLS, or device proof.
