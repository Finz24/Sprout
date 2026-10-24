# Issue #4 design evidence

These captures show the static [red-pen sheet](../../design/issue-4-review.html),
not a running save flow. All content and receipt times are synthetic. No product
code changed, app services started, Docker stacks started, or runtime persistence,
RLS, action execution or real-device behavior tested for this docs task.

## Review artifacts

- `desktop.png` and `mobile.png`: complete sheet, including all three directions,
  both themes, receipt/recovery states and review notes.
- `desktop-a.png` through `desktop-c.png`, and `mobile-a.png` through `mobile-c.png`:
  each complete direction, including its desktop and phone specimens.
- `desktop-a-light.png` / `desktop-a-dark.png`: recommended desktop composition.
- `mobile-a-light.png` / `mobile-a-dark.png`: recommended Galaxy phone composition.
- `render-evidence.json`: viewport, overflow, loaded Inter, Unicode preservation,
  unique IDs, reduced motion, script errors and external-request observations.

The sheet includes 290 numbered content/control groups; direction and state IDs
are additional document anchors. Light/dark examples are shown simultaneously,
so screenshots contain both themes regardless of the browser theme. Disabled
controls illustrate states and do not submit data. The document is responsive at
1440 CSS px and the installed Playwright `Galaxy S9+` profile's 320 CSS px.
The named profile is viewport emulation, not a physical Galaxy test.

Inter is embedded from `apps/web/src/assets/inter-variable.woff2` so the HTML
opens offline without adjacent assets. Its existing license is
[OFL-Inter.txt](../../../apps/web/src/assets/OFL-Inter.txt). Hebrew and emoji use
the platform's glyph fallback where Inter lacks coverage; no font was added.

## Reproduce

Use the already pinned/prepared repository dependencies and Playwright browser.
No network download or app service is needed for capture.

```powershell
node docs/proof/issue-4-design/build-sheet.mjs
corepack pnpm exec prettier --write docs/design/issue-4-review.html
node docs/proof/issue-4-design/capture.mjs
corepack pnpm exec prettier --check docs/design/issue-4-* docs/proof/issue-4-design/*.mjs docs/proof/issue-4-design/*.json docs/proof/issue-4-design/README.md docs/LESSONS.md
corepack pnpm check
```

The builder writes only the review HTML; capture writes only PNGs and the JSON
record in this directory. This is artifact verification tooling, not a new
application test boundary.

## Executed checks

`corepack pnpm install --offline --frozen-lockfile` passed with pnpm 10.34.6,
570 packages and zero downloads. Environment preflight passed all seven checks.
`corepack pnpm check` exited 0: repository format, lint, React Doctor, typecheck,
180 unit tests, seven build tasks and workflow documentation validation passed.
The PR body includes actual output. `git diff --check` passed.

The repository's format script does not include this design folder, so the
explicit targeted Prettier command above was run as well. Lint checks the existing
product/tooling surface; static HTML is checked by formatting and browser capture.
No integration or product E2E suite was run: this changes neither services nor
browser product code. Playwright was used directly for the requested sheet proof.

Independent source/design review of the Markdown found no actionable findings
(MUST KILL: 0); it excluded the separately built sheet and did not establish
runtime guarantees. The visual draft was rebuilt after the first inspection.
A detector flagged small numbering text and a low-contrast writing line; both
were corrected. Its generic Inter warning conflicts with the explicit approved
font and was not followed. Final captures were inspected for readable layout,
exact Unicode and coverage; visual approval remains Ohad's decision.

The T3 HTML preview also rendered the standalone page with no console messages.
All these results concern the design artifact, not implementation acceptance.
