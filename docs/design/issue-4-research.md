# Text-save visual research

October 24, 2026. Revision after Ohad rejected the first #4 sheet as too minimal
and flat. This note informs the [review sheet](issue-4-review.html), not the
schema/RLS design or an approved product implementation.

## Repository guidance

Searched `README.md` and `docs/` for shadcn, registries and UI discovery sources.
[Architecture, UI composition](../architecture.md#ui-composition) selects shared
shadcn components/tokens first and names great-ui.com, useLayouts.com,
opensourceui.in, libraries.dev, transitions.dev and beautifului.dev as discovery
sources, explicitly not verified installed registries. Product direction also
selects compatible community components and Motion. The current #37 login's
`access-layout.tsx`/`styles.css` supplies the visual authority: forest green, sage,
a layered mosaic and local Inter. Keep Inter; no new fonts or dependencies.

## Ten checked references

These are design judgments drawn from the accessible public pages. No screenshot,
illustration or third-party component code is redistributed in the sheet.

| Reference                                                                                    | What to use in this slice                                                                                                                                   | Limit or rejection                                                                                                                                                  |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [shadcn Card](https://ui.shadcn.com/docs/components/card)                                    | Header/content/footer structure; semantic Button, Field, Textarea and Badge vocabulary, mapped to existing Sprout tokens.                                   | The current documentation redirects to its Base UI variant. This docs artifact uses HTML equivalents; do not silently switch the product's primitive library.       |
| [Magic UI Bento Grid](https://magicui.design/docs/components/bento-grid)                     | C uses varied card proportions and an original-text preview region; A separates writing and collected content.                                              | Adapt the composition, not a marketing feature grid. No marquees, animated borders or fake AI content.                                                              |
| [Aceternity 3D Card](https://ui.aceternity.com/components/3d-card-effect)                    | Distinct content planes, soft offset shadows, slight pointer-hover lift on the collection cards.                                                            | No cursor-tracking tilt on text entry; no constant animation or touch-only dependency.                                                                              |
| [Origin UI, now coss UI](https://originui.com/textarea)                                      | Wrapped intent textarea, explicit labels, quiet help text and clear focus treatment.                                                                        | Origin's URL currently redirects to coss.com/ui, built on Base UI. Treat this as form inspiration, not an installed Origin package or verified drop-in replacement. |
| [useLayouts](https://uselayouts.com/)                                                        | A repository-suggested source: Polaroid Stack, Status Button and editable card patterns inform C's physical card treatment and the bounded motion specimen. | Adapt with authored CSS in the standalone sheet. No new runtime library or downloaded assets.                                                                       |
| [Opensource UI](https://opensourceui.in/)                                                    | A repository-suggested source: deliberate phone frames, material finishes and annotations inform readable device specimens and numbered review controls.    | The phone is an emulated layout, not proof on physical Galaxy hardware.                                                                                             |
| [transitions.dev](https://transitions.dev/)                                                  | A repository-suggested source: panel reveal, card resize and status-swap examples inform a short composer reveal and separate receipt reveal.               | Show motion only as a replayable illustration. It cannot simulate a successful save or turn Saving into Saved on a timer.                                           |
| [Dribbble knowledge-management collection](https://dribbble.com/search/knowledge-management) | Explore stronger workspace hierarchy, richer original-preview cards and the contrast between collection and writing space.                                  | The public collection is a visual discovery source, not usability evidence or a source of licensed product assets.                                                  |
| [Mobbin app discovery](https://mobbin.com/discover/apps/ios)                                 | A reference destination for later save/edit/confirmation flow comparison.                                                                                   | The accessible page exposes login/join links, not detailed app flows. No claimed inspection of gated screens; no design decision depends on them.                   |
| [Godly](https://godly.website/)                                                              | Requested expressive-layout discovery source; retain as a follow-up reference.                                                                              | The web tool returned a 500 after redirecting to recent.design. No claimed visual inspection or borrowed design from this inaccessible page.                        |

## Three competing directions

**A / Conservatory:** a deep green canopy and an elevated writing panel keep
capture in the same visual world as the collected originals. Recommended for
everyday use: the strongest connection to #37, clear depth, and a visible home
for the new item.

**B / Writing desk:** an arched green guide and a large paper editor give an
original room to breathe. More deliberate capture with a return step; a long
synthetic original demonstrates the scrolling and reading space.

**C / Collection board:** a warm draft card sits among varied sage originals,
giving capture a physical place in the collection. The most expressive browsing
option, with more competing content during editing and recovery.

The sheet compares actual rendered prototypes at the same viewport/state, then
provides full numbered desktop/Galaxy, light/dark specimens and library states.
Material texture uses subtle authored CSS patterns on paper/card surfaces;
shadows separate planes rather than outlining every box. Motion is short,
replayable and removed by reduced-motion preferences. No loop, delayed status or
automatic success claim is permitted.

## Adoption boundary

Used as adapted visual patterns: shadcn structure and tokens; Magic UI grid
composition; Aceternity card depth; useLayouts physical cards/status treatment;
Opensource UI device presentation; transitions.dev reveal vocabulary; coss/Origin
form treatment. The self-contained sheet is authored HTML/CSS with embedded
existing Inter. It cannot import React components without breaking the static,
offline brief. No package install, registry CLI, product-component replacement,
license claim or new font is implied. Any future source adoption requires its
own exact-version, license and accessibility check during implementation.

Schema, RLS, receipt semantics, retry identity and no-action-execution rules are
unchanged. Visual selection remains Ohad's decision.
