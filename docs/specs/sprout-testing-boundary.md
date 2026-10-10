# Approved testing boundary for Sprout

September 27, 2026. Status: owner confirmed — "Yes—use this end-to-end boundary." The complete product journey has not been exercised. Approval of the testing boundary does not certify source support or approve every synthesis clarification in the parent spec.

For issue #2 only, the owner approved [development-foundation acceptance](foundation-development-environment.md): meaningful foundation unit checks, integration health checks and end-to-end screen sanity. These checks establish runtime wiring and development usability; authentication, saving, processing, isolation and the journey below are verified when their product slices exist.

## One primary boundary: the owner's complete save-to-use journey

Start through the real chosen capture surface and inspect the durable workspace and subsequent search/answer. Exercise processing, storage and retrieval together. Do not treat a successful model response, a storage write or an internal function return as proof that the journey worked.

**Representative journey:** send a recipe source with an instruction and a target Space; receive an honest receipt; inspect the Original input and AI understanding; find the recipe by a remembered detail; correct a quantity; move or regroup its card; retrieve the corrected fact again on the other device. Changing organization must preserve the original and correction.

Variants use the same boundary:

1. **Control:** change the owner's summary instructions; preview the resulting output for a selected sample; verify the requested change, source grounding and unchanged existing items/corrections.
2. **Capture honesty:** a supplied file works independently of its source; an inaccessible reel reports exactly what is missing; footage-only facts are not fabricated from a caption.
3. **Recovery:** interrupt a save, retry it and recover a processing failure; one logical submission survives, available originals remain usable and success is not falsely reported.
4. **Research and authority:** an Off private item never contributes private content to external research; quoted commands cannot schedule anything; the initial scope honestly marks preserved action requests Not scheduled.
5. **Workspace:** browse, group/filter, move and open mixed item types on Windows and Galaxy; organization persists, avoids duplicate content and has an alternative to precise dragging.
6. **Portability:** export representative originals, understanding and owner context, and inspect them outside the workspace. A valid file export is not reported as proof of complete records-and-media restoration.

Use controlled source/model/tool responses for repeatable failure and policy cases while observing the same external outcomes. Use a small real-device/live-provider set for source access, AI usefulness, self-hosted application behavior and cross-device operation. Real tests compare required facts and source evidence, not exact prose. Private fixtures stay out of public issues and repositories.

The owner added the no-tautological-tests rule on October 1. Apply the [testing rules](../../AGENTS.md#testing) to Cypress, other end-to-end tests and unit tests: independently grounded expectations, real behavior inside the test boundary and assertions that can catch a plausible regression. Playwright is selected for application journey verification by the approved architecture; no application test suite exists yet.

## Existing prior art and limits

The acceptance-scenario document and source-validation corpus supply examples, not executable passing tests. Existing diagram checks only validate the workflow artifact. There is no production module seam or application test framework to reuse, and the selected application test tooling has not been bootstrapped.

Avoid a new test boundary for each future module. Add a focused lower-level test only when an important behavior cannot be exercised reliably through the journey. A visual owner review of the workspace remains necessary: automation can establish that moving works, but cannot establish that the place feels like the one the owner wants.

The owner confirmed that this single external journey, with these variants and live-device checks, matches the expected way to prove Sprout works.
