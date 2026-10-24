# Issue #4 design evidence

These captures show the static [red-pen sheet](../../design/issue-4-review.html),
not a running save flow. All content and receipt times are synthetic. No product
code changed, app services started, Docker stacks started, or runtime persistence,
RLS, action execution or real-device behavior tested for this docs task.

## Review artifacts

- `desktop.png` and `mobile.png`: the first 10,000 pixels of the review sheet.
  Full direction and state captures below cover the rest without an unreadably
  tall single image.
- `desktop-a.png` through `desktop-c.png`, and `mobile-a.png` through `mobile-c.png`:
  each complete direction, including its desktop and phone specimens.
- `desktop-{a,b,c}-{light,dark}.png`: each desktop composition and theme.
- `mobile-{a,b,c}-{light,dark}.png`: each Galaxy composition and theme.
- `{desktop,mobile}-{a,b,c}-library-{light,dark}.png`: empty and populated
  Library alternatives for every direction, device class and theme.
- `desktop-motion.png` / `mobile-motion.png`: replayable receipt-panel specimen.
- `render-evidence.json`: viewport, overflow, loaded Inter, Unicode preservation,
  unique IDs, reduced motion, script errors and external-request observations.

The revised sheet includes 487 numbered content/control groups; direction and state IDs
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
node docs/proof/issue-4-design/build-sheet.mjs --previews
corepack pnpm exec prettier --write docs/design/issue-4-review.html
node docs/proof/issue-4-design/capture.mjs
corepack pnpm exec prettier --check docs/design/issue-4-* docs/proof/issue-4-design/*.mjs docs/proof/issue-4-design/*.json docs/proof/issue-4-design/README.md docs/LESSONS.md
corepack pnpm check
```

The first capture supplies the actual prototype images for `--previews`; the
second captures the finished self-contained sheet with those images embedded.
The builder writes only the review HTML; capture writes only PNGs and the JSON
record in this directory. This is artifact verification tooling, not a new
application test boundary. Opening the motion details replays an already-confirmed
receipt illustration and sends no request. Capture checks the normal animation
name and its removal under reduced motion.

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

Revision 2 retains the uncommitted work from the interrupted run and replaces
the rejected minimal/flat treatment with Conservatory, Writing desk and
Collection board prototypes. [Research](../../design/issue-4-research.md) records
ten linked references and exact adoption limits. No schema/RLS document changed.
Two resumed visual reviewers flagged clipped intent, abstract comparison previews,
uneven Library coverage and the lack of a long-note example. This revision uses a
wrapped intent field, embeds actual equal-viewport prototype images, adds explicit
Library specimens and demonstrates a long original in B. Both reported MUST KILL: 0. Their rankings differed: Luna preferred A/B/C, Sol preferred A/C/B; both favored
A. These reviews preceded the final corrections, which the parent checked in
the browser captures. They are not independent approval of the final revision.

The first single-image full-sheet capture failed with
`Page.captureScreenshot: Unable to capture screenshot` after the sheet grew.
The overview plus complete component/state captures avoid that browser limit.
All these results concern the design artifact, not implementation acceptance.
