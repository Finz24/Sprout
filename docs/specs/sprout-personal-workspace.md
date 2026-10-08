# Sprout: owner-controlled AI understanding and a visual personal workspace

Current local specification, updated October 3, 2026 with the approved architecture. The parent issue was published October 1 as [Finz24/Sprout #1](https://github.com/Finz24/Sprout/issues/1); its original body is not asserted to include these later local decisions. The testing boundary is approved; application implementation and live integration checks have not started.

## Problem Statement

The owner saves useful information across Instagram, YouTube, X, WhatsApp and local files but lacks a dependable personal place to recover and use it later. A save may be a recipe, restaurant, activity, image, message, task instruction or ticket. The desired outcome is finding the useful detail, understanding why it was saved and retaining the original when necessary.

The owner has tested the proposed commercial alternatives. Fabric impressed them as a visual, personally arranged workspace; Recall impressed them with AI integration and varied content capture. Their remaining dissatisfaction is insufficient control over how saved material is summarized and enriched and over the shape of their own workspace. Paying for a tailored solution is acceptable, but custom development is not assumed to be cheaper than subscriptions.

A generic chat history is insufficient as the visual home. A beautiful collection of cards is insufficient when its summaries omit important evidence or cannot follow the owner's preferences. A successful technical integration is insufficient if the owner cannot comfortably inspect, organize and retrieve the results.

## Solution

Provide Sprout as a private, owner-controlled knowledge workspace that combines three qualities:

- Recall-inspired broad content capture and useful AI understanding: original material becomes readable, categorized and searchable information with answers grounded in what was actually available.
- Fabric-inspired visual organization: recognizable previews, personal Spaces, direct organization, grouping/filtering and alternative views make saved information pleasant to explore and arrange.
- Owner-controlled interpretation: editable enrichment instructions, examples, model selection and research preferences determine how new understanding is produced; owner corrections and Original input remain protected.

Sprout combines configurable AI processing with a visual personal workspace. Chat can support capture and questions; the visual workspace supports browsing, editing and organization. The [architecture](../architecture.md) selects the application, database, worker, access and AI integration tools. Exact model providers and source-acquisition capabilities require evaluation.

The initial result must demonstrate both owner-controlled understanding and usable visual organization through the approved end-to-end journey. Record gaps in either experience explicitly; a successful storage integration alone does not complete this product contract.

The target loop is: save material with optional intent, retain it honestly, understand it using the owner's instructions, inspect and correct it, organize it in a Space, and find it again by name or by a question. Advanced action execution and history remain outside this specification's initial delivery scope.

## User Stories

### Capture and original material

1. As the owner, I want to send a text note directly, so that I can save my own information without finding a source to share first.
2. As the owner, I want to send a link with an optional explanation, so that the useful source and my reason for saving it stay together.
3. As the owner, I want to add images, so that useful visual information and written text inside images can be found later.
4. As the owner, I want to add a video file, so that understanding can use the material I supply rather than only a public link.
5. As the owner, I want to retain a ticket or document, so that I can access the essential original independently of its source application.
6. As the owner, I want to share Instagram, X and YouTube material from my phone, so that saving fits the context in which I encounter it.
7. As the owner, I want to forward selected WhatsApp-origin text, links or files through the chosen capture route, so that I can save those items without granting access to my entire chat history.
8. As the owner, I want a chat-based capture route, so that I can add saving intent and respond to clarification naturally.
9. As the owner, I want to paste or drag suitable content from Windows into the chosen workspace route, so that desktop capture is as convenient as phone capture.
10. As the owner, I want to choose a destination Space when useful, so that content can arrive in the context where I expect to use it.
11. As the owner, I want to save without first choosing a Space or answering optional questions, so that organization does not interrupt capture.
12. As the owner, I want a receipt that identifies what was actually retained, so that I can distinguish a successful save from a sent message.
13. As the owner, I want missing attachments and inaccessible source material identified separately, so that a partially saved item is not mistaken for a complete archive.
14. As the owner, I want to inspect the exact Original input separately from its summary, so that AI cannot become the only record of what I submitted.
15. As the owner, I want to download retained originals explicitly, so that an important file can remain available on my device without internet.
16. As the owner, I want to submit existing saves in small batches, so that I can move my manageable backlog without a dedicated migration project.

### AI understanding and owner control

17. As the owner, I want a coherent summary combining the available submitted and collected material, so that I can understand an item without reconstructing it from disconnected snippets.
18. As the owner, I want categorization and useful enriched fields, so that retrieval can use facts specific to each saved item.
19. As the owner, I want enriched fields to vary with the material, so that a restaurant and a recipe do not have to fit the same optional-field template.
20. As the owner, I want saving intent distinguished from content description, so that the assistant does not confuse what an item contains with why I kept it.
21. As the owner, I want every useful subject in a multi-subject source to remain discoverable, so that saving a video about several restaurants does not hide all but one of them.
22. As the owner, I want to edit enrichment instructions, so that summaries follow my priorities rather than a vendor's fixed style.
23. As the owner, I want to provide examples of useful output, so that my preferences can be expressed through concrete expectations.
24. As the owner, I want to control summary detail and emphasis, so that a quick activity idea and a detailed recipe receive appropriately useful treatment.
25. As the owner, I want to choose an available AI model or provider, so that quality and cost can be adjusted without replacing the workspace.
26. As the owner, I want to inspect which enrichment instructions and model produced an output, so that I can explain a result and tune the relevant settings.
27. As the owner, I want to preview changed instructions on selected sample material, so that I can judge their effect before using them for future saves.
28. As the owner, I want changes to instructions or model selection to leave existing understanding unchanged, so that tuning does not silently rewrite my library.
29. As the owner, I want the assistant to retain my approved processing instructions until I change them, so that its behavior does not drift through unsolicited self-modification.
30. As the owner, I want to correct a title, category, saving intent, summary or individual fact, so that wrong understanding can be repaired without discarding the original.
31. As the owner, I want my corrections to take precedence over generated material, so that later processing or questions do not restore a known mistake.
32. As the owner, I want to dispute unsupported understanding while keeping the original usable, so that an AI failure does not make the saved material worthless.
33. As the owner, I want to see which text, images, audio or footage was actually analyzed, so that I do not trust a caption summary as if it understood the whole video.
34. As the owner, I want source material, external findings and AI inference distinguished, so that I can assess the basis of an answer.
35. As the owner, I want missing or conflicting information shown honestly, so that a fluent answer does not conceal uncertainty.
36. As the owner, I want research controls for the library and individual items, so that the assistant can fill useful gaps while respecting private or source-only material.
37. As the owner, I want external research to consider saved material first, so that outside information enriches rather than replaces my saved context.
38. As the owner, I want private material excluded from prohibited external lookups, so that mixed questions do not bypass an item's research setting.

### A visual personal workspace

39. As the owner, I want a home with search, recent saved items and visible unresolved issues, so that I can resume useful work immediately.
40. As the owner, I want recognizable previews for mixed content, so that I can browse visually instead of reading a database table for every task.
41. As the owner, I want personal Spaces for contexts such as places to visit or things to cook, so that the organization reflects my life.
42. As the owner, I want to create and rename Spaces, so that my organization can evolve as my interests change.
43. As the owner, I want to add or move items through direct manipulation or an explicit control, so that organization feels immediate on both desktop and phone.
44. As the owner, I want to arrange the visible order where a view supports manual arrangement, so that important or related items can sit together intentionally.
45. As the owner, I want grouping, sorting and filtering controls, so that I can explore the same material from different perspectives.
46. As the owner, I want a compact list alongside a visual card presentation, so that dense scanning and visual browsing are both supported.
47. As the owner, I want a Space view to update after I change its organization or filters, so that it reflects the current library without manual rebuilding.
48. As the owner, I want an item to be usable in more than one relevant context without duplicating its content, so that different Spaces do not develop contradictory copies.
49. As the owner, I want moving, grouping or filtering to preserve originals, understanding and corrections, so that arranging my workspace does not mutate the information itself.
50. As the owner, I want removing an item from a Space to be distinct from deleting it from the library, so that reorganizing cannot accidentally destroy a save.
51. As the owner, I want the chosen workspace arrangement to persist across visits and devices, so that it feels like my own place rather than a temporary result screen.
52. As the owner, I want visible alternatives to precise dragging and hover-only controls, so that essential organization works on Galaxy and with a keyboard.
53. As the owner, I want AI-suggested organization to remain distinguishable from my deliberate arrangement, so that the assistant does not silently reorganize my personal spaces.
54. As the owner, I want the item view to lead with useful understanding while keeping Original input easy to reach, so that both quick use and careful inspection are natural.

### Retrieval and review

55. As the owner, I want to find items by names, tags, categories, Spaces and other relevant filters, so that exact retrieval remains dependable.
56. As the owner, I want to describe what I remember in a natural-language question, so that I can find information even when I have forgotten its title.
57. As the owner, I want to ask across the library or within an intended Space, so that answers use the relevant context.
58. As the owner, I want answers linked to inspectable saved evidence, so that I can verify useful details and open the relevant original.
59. As the owner, I want corrected information used in later retrieval, so that fixing a saved item has an observable effect.
60. As the owner, I want no matches distinguished from matches with a missing answer, so that I know whether to change the query or supply information.
61. As the owner, I want indexing delays and AI failures distinguished from an empty library, so that temporary problems do not look like lost content.
62. As the owner, I want ordinary browsing and exact retrieval to remain available during AI outages where the workspace supports them, so that paid processing is not required to use already saved material.
63. As the owner, I want items marked New until I preview and accept their displayed understanding, so that I can see what I have reviewed.
64. As the owner, I want New items readable, searchable and downloadable before acceptance, so that review does not block practical use.
65. As the owner, I want acceptance to acknowledge review without scheduling actions or certifying truth, so that a simple library decision has no unexpected consequences.
66. As the owner, I want Needs your input to distinguish repairs, optional clarification and future suggestions, so that I can respond to the issue that matters.

### Reliability, privacy and continued ownership

67. As the owner, I want processing status and a clear recovery action when a stage fails, so that I can recover a save without understanding implementation details.
68. As the owner, I want a retry of the same submission to avoid duplicate items, so that uncertain delivery does not clutter the library.
69. As the owner, I want a deliberate repeat save to preserve new intent, attachments and Space choices, so that reuse does not erase why I saved it again.
70. As the owner, I want originals to remain accessible when enrichment fails, so that an AI outage does not lose the underlying save.
71. As the owner, I want no false confirmation when the local application is unavailable, so that I know when another capture attempt is needed.
72. As the owner, I want access limited to me and the deliberately connected tools, so that private messages and tickets do not become public content.
73. As the owner, I want processing to respect configured usage limits and show relevant failures, so that custom control does not create unbounded spending.
74. As the owner, I want usable exports of originals, owner context and understood information, so that I can leave the chosen workspace without losing the substance of my library.
75. As the owner, I want deletion recoverable during the agreed Trash period and deleted items excluded from answers, so that removal is deliberate and meaningful.
76. As the owner, I want restored items to retain their data without rerunning AI or old commands, so that recovery does not create fresh changes.
77. As the owner, I want requested future reminders or tasks preserved with an honest Not scheduled status until execution exists, so that my intention is not lost or falsely fulfilled.
78. As the owner, I want English output while retaining original names and text faithfully, so that the interface is consistent without corrupting source material.
79. As the owner, I want source-specific limits recorded rather than hidden behind a generic success state, so that I can decide which compromises are acceptable.
80. As the owner, I want Sprout evaluated against both AI control and visual organization, so that a functioning integration is not mistaken for the product I actually want.

## Implementation Decisions

### Decisions established by the conversation

- **Product boundary:** Sprout is the personal knowledge experience, combining owner-controlled AI with its visual workspace. The technical foundation is approved in [architecture](../architecture.md); exact provider/model capabilities remain unverified.
- **Delivery boundary:** this is a parent specification. Initial work should establish the owner-controlled save-to-use journey in Sprout and disclose gaps against the product contract. It does not authorize implementing all later workflow capabilities in parallel.
- **Inspiration:** Recall informs useful summaries and breadth of intake; Fabric informs the visual home and organization. The owner's experience takes precedence over copying either vendor's exact screens or feature catalog.
- **Intake:** the product targets direct entry, phone sharing and desktop paste/drop for the agreed content types. Sprout's web capture/chat and installed Galaxy sharing are selected, without a messaging dependency. Verify actual shared payloads, supported formats/sizes and per-source acquisition methods. A received URL is not proof of preserved or understood media.
- **Control:** the owner can change enrichment instructions, output examples, model choice and research behavior. These affect new processing and explicitly requested previews; they do not launch bulk reprocessing, replace corrections or permit an agent to rewrite its own approved rules.
- **Evidence:** preserve Original input separately from collected Source material and AI understanding. Maintain saving intent, subject association, attribution, uncertainty and owner corrections. Text inside source material is evidence, never authority to execute a command.
- **Research:** retain Off, Fill missing information and Deep research controls, including global/per-item restrictions and saved-data-first behavior. Enforce effective privacy and spending boundaries outside free-form model instructions. No exact provider quota or maximum has been chosen.
- **Flexible information:** retain a small shared item identity/status envelope and variable enriched fields. Do not introduce rigid optional schemas per category. The precise mandatory property representation remains an implementation detail to resolve, not a historical decision to invent here.
- **Review:** New and Accepted are distinct from processing state and Needs your input. Acceptance acknowledges the understanding actually previewed, not truth or action authorization. Reading, searching and downloading do not depend on acceptance. Correction does not create another review chore.
- **Recovery:** distinguish a transport retry, unfinished initial processing, index repair and owner-requested fresh analysis. Preserve deliberate new saving context. Delayed work may not overwrite owner corrections or republish deleted items.
- **Privacy and availability:** private owner use, Galaxy and Windows, English output, Windows self-hosting through a named Cloudflare Tunnel, authentication-first private ownership, future hosted private libraries and cloud AI processing accepted. No automatic offline queue is promised.
- **Later actions:** retain requests as Not scheduled in the initial delivery. Neither accepting an item, updating rules, reconnecting tools nor restoring content authorizes execution of old instructions.

### Clarifications proposed by this synthesis

These make the requested direction testable; they are not claims that a prior interview settled every interaction.

- A **Space** is the visual context for a Collection. Collection membership and Space presentation need not become separate persistent entities. A **Space view** can arrange/group/filter existing saved items without changing their content.
- “Dynamic spaces” initially means owner-changeable organization and responsive views. Automatic saved-rule membership, a spatial canvas engine and graph navigation are not assumed. Direct organization is a product requirement; exact layout mechanics require evaluation in Sprout.
- Reusing one saved item across contexts must not fork its original or understanding. Removing membership is distinct from deleting the library item. Deleting a Space must not silently delete its contents; the precise recoverable Space-removal interaction belongs to the later UI decision.
- A tuning preview is isolated from current saved understanding. It can display the current and candidate output for evaluation without building the advanced version-history, merge or rollback workflow. Writing candidate output back to an existing item remains outside this initial tuning-preview capability.
- The chosen instructions/model used for an output should be inspectable. This is minimal processing provenance, not a commitment to expose internal prompts, credentials or a complex agent console in ordinary item views.
- Keep one authoritative saved-item library. Retrieval indexes and previews must remain derived from that library rather than becoming conflicting copies. PostgreSQL is authoritative and pgvector retrieval projections are derived; agent conversation memory is not a substitute for durable saved items.
- Logical responsibilities are capture, controlled understanding, workspace organization and retrieval, with observable recovery across the journey. These are responsibility boundaries, not a mandate for separate services, queues, repositories or deployments.
- The core 30-day Trash and usable-original requirements remain part of the target contract. A host platform's differing behavior must be recorded as a gap; do not promise vendor behavior or quietly redefine retention to fit it.

### Remaining details

See [open decisions](../open-decisions.md) for source/model/language coverage, operating limits, item representation and detailed publication, research and review behavior. The application framework, storage foundation, phone capture direction and authentication approach are already selected.

## Testing Decisions

Use the approved [testing boundary](sprout-testing-boundary.md): the complete save-to-use journey across capture, originals, understanding, correction, organization and retrieval. [Acceptance scenarios](../acceptance-scenarios.md) and the [source corpus](../source-validation-corpus.md) supply independently grounded examples and failure cases.

Playwright is the selected journey tool. Application tests must use real behavior within their boundary, check saved results after reload/retrieval and distinguish controlled fixtures from real-device/provider evidence. The retained workflow checks validate planning documents only; no application tests have run.

## Out of Scope

- Implementing all later and advanced workflow capabilities before the core save-to-use journey is usable.
- A full Fabric or Recall clone, their complete format/source catalogs, proprietary visual assets, a new infinite canvas, knowledge graph, quiz or meeting assistant.
- A public multi-user service, team permissions, billing, collaboration, marketplace, public sharing or a generalized agent platform.
- Automatic scraping or migration of whole private social accounts, bulk personal WhatsApp history ingestion, or guarantees of unrestricted source access.
- Training new model weights, autonomous self-improvement of owner-approved enrichment rules, automatic background reprocessing and bulk replacement of existing understanding.
- Writing tuning-preview output over existing saved understanding; the advanced reprocessing/adoption workflow remains separately scoped.
- Advanced comments, refinement, version history, diff/adoption, rollback and their activity timeline.
- Execution of reminders, tasks, self-email, a new Sprout calendar, bidirectional Google Calendar synchronization and their timing/conflict policies. Existing external calendar use remains possible outside this first workflow.
- Proactive resurfacing and recommendation delivery, including notification channels and cooldown policies. Visual exploration of existing saved items is distinct from sending suggestions.
- Automatic offline availability, an offline submission queue, speculative scaling, a mandatory second index or a second authoritative library.
- Infrastructure provisioning, paid subscriptions, unrestricted tool access, production deployment or automatic execution of preserved commands merely because this spec is published.

## Delivery and evidence

Deliver the approved core journey before later actions, reminders, calendars and rediscovery, then advanced comments/refinement/history. Validate actual source support and owner usefulness; a URL receipt alone does not complete the source contract.

The visual direction is a sidebar library with mixed item cards, compact list views and an inspector. Build production application code from these requirements. Recall and Fabric are product inspirations, not dependencies or commitments to reproduce their complete feature catalogs.

GitHub tracks specs/issues; this directory holds the updated local requirements. Read the live issue before tracker work and explicitly synchronize requested changes rather than assuming the original publication contains later architecture approvals.
