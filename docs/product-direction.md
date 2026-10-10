# Sprout: current product direction

Approved product direction as of October 3, 2026. Development-foundation initialization began October 10 with the selected Effect architecture; product behavior and live source/model integration remain unimplemented and unvalidated.

## Purpose and core experience

Sprout combines Recall-inspired broad capture and useful summaries with Fabric-inspired visual organization, while preserving the owner's control over AI instructions, examples, models and research behavior. The owner's hands-on evaluation of alternatives established the need for this custom control; no further broad build-or-buy trial is a prerequisite.

The first release must demonstrate one complete journey: save material, receive an honest durable receipt, inspect Original input and AI understanding, correct it, organize it in a Space, and retrieve it again by name or question from Windows and Galaxy. A chat-only tool or an attractive library without controlled understanding does not satisfy this direction.

## Approved first-release boundaries

- Personal Windows self-hosting with Galaxy access through a named Cloudflare Tunnel; downtime when Windows is off is acceptable. Authentication and private user ownership are included from the first release, with public signup disabled. Preserve a path to future hosted private libraries for other users.
- Sprout's own web capture/chat and installed Galaxy sharing are the selected first route. Support Windows direct entry, paste/drop and file upload. WhatsApp-origin text/links/files use ordinary capture; no bot dependency is selected.
- Text, images, videos, documents, generic links, Instagram, X and YouTube remain target source/input categories. Receipt, retained bytes, acquired source context and actual analyzed modalities are separate evidence. Source-specific limitations and workarounds need observed tests and owner evaluation.
- A natural, minimal visual library with sidebar navigation, recognizable mixed-content cards, a compact list alternative, a focused item inspector and personal Spaces. Use shadcn/ui and compatible community components, shared tokens and Motion; minimize authored CSS and scattered inline styling. Detailed inspector and Space interactions still require evaluation.
- Build application code fresh from the product requirements. Required behavior and acceptance criteria are sufficient implementation inputs; no prototype is an application dependency.
- Preserve originals, saving intent, collected source material, generated understanding, owner corrections and attributed external findings distinctly. New items remain usable; acceptance acknowledges review of the displayed understanding and confers no action authority.
- Enforce research policy and usage bounds outside prompts. Changing instructions/models affects future work and isolated tuning previews, never automatic bulk reprocessing or correction replacement.
- Preserve deliberate repeat-save context while deduplicating transport retries. Recovery targets the failed stage; index repair never runs enrichment. Late work cannot overwrite corrections or revive Trash.
- English interface/generated output; preserve original names and Unicode. Explicit downloads may open offline; automatic offline availability and an offline submission queue are deferred.
- Keep 30-day recoverable Trash, exclude deleted material from ordinary browsing/answers, and verify records-plus-media backup restoration before relying on Sprout as the sole copy.

## Later scope

Tasks, reminders, Sprout/linked calendars and rediscovery follow the usable core. Comments, refinement, versions and rollback are advanced. Core retains future action requests as **Not scheduled**; acceptance, settings changes, restore, reconnect and feature launch never replay them.

Public signup, collaboration, billing and public sharing are not part of the personal release. Cloud AI is acceptable; the selected architecture does not authorize provider spending or infrastructure provisioning.

## Sources of truth

- [Specification](specs/sprout-personal-workspace.md): product requirements.
- [Architecture](architecture.md) and ADRs: approved technical foundation.
- [Open decisions](open-decisions.md): unresolved details and validation gates.
- [Action flows](action-flows.md): detailed core/later/advanced behavior generated from workflow-data.json.
- [Testing boundary](specs/sprout-testing-boundary.md) and [source corpus](source-validation-corpus.md): required evidence, not completed product tests.
