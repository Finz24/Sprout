# Sprout source validation corpus

Prepared September 25, 2026. **All cases are Not tested.** These are sample slots and expected checks, not evidence of platform support. Populate them with the owner's examples during the feasibility checkpoint; keep private payloads and credentials outside this public planning record.

| ID | Representative input | Useful result to check | Status |
|---|---|---|---|
| S01 | Instagram restaurant reel | Restaurant identity, relevant location and saving intent; find by name and description | Not tested |
| S02 | Cooking video with a step visible only in footage | Identify the visual step from actual analyzed footage, or explicitly report that it was not analyzed | Not tested |
| S03 | Saved activity for a bored afternoon | Find the activity by a practical descriptive question, without inventing current availability | Not tested |
| S04 | One source covering several restaurants | One item; independently retrieve each restaurant without exchanging their addresses | Not tested |
| S05 | Private ticket file with research Off | Retain and download file; inspect event details; no private data in external research requests | Not tested |
| S06 | Owner text requesting a task/reminder | Preserve exact instruction; core says Not scheduled; later separate it from quoted commands | Not tested |
| S07 | Raw written text | Faithful Original input; useful summary, correction and exact/descriptive retrieval | Not tested |
| S08 | Local image containing useful text and visual facts | Actual retained bytes and useful analyzed evidence; honest OCR/visual uncertainty | Not tested |
| S09 | Local video, including long/oversized example | Modalities analyzed, bounded job behavior, preserved file and useful retrieval | Not tested |
| S10 | Generic link with metadata and linked material | Distinguish original URL, captured page, attachments and external research | Not tested |
| S11 | X share with image/video/thread context | Actual shared payload, retained material, available context and absent context | Not tested |
| S12 | YouTube video with useful detail beyond the title | Actual accessible transcript/footage versus metadata; useful supported answer | Not tested |
| S13 | WhatsApp-origin text, link and attachment | Ordinary input works; record direct-share payload only if that route is actually tested | Not tested |
| S14 | Private/deleted/unavailable social source; inaccessible comments | Honest limitation; supplied-file recovery evaluated separately; no invented analysis | Not tested |
| S15 | Duplicate restaurant saved for a new reason and collection | One reused item with both intentional contexts; retry adds no third receipt; new file survives | Not tested |
| S16 | Source whose original names/text are not English | Original Unicode preserved; mark understanding/search unsupported until language scope is chosen and tested | Not tested |

For each slot, record an accessible sample and relevant unavailable/partial variant where applicable. A missing platform capability is a measured limitation, not an automatic pass via URL receipt.

## Per-sample evidence record

- Sample ID, private fixture reference, date; Galaxy/Windows OS, browser and source-app versions.
- Entry route and exact received material types (redacted description; avoid ticket codes or personal message bodies).
- Durable receipt result; retained text and file bytes; available page/media/metadata/comments; what remained unavailable.
- Modalities actually analyzed (text, image, audio, footage); required useful facts and their specific supporting evidence.
- Expected exact query and descriptive question; returned subjects, unknowns, conflicts and evidence.
- Open Original input; open retained files independently of source; download and open the device copy offline.
- Correction/dispute outcome and subsequent retrieval; New remains usable before acceptance.
- Injected failure, observed issue, exact recovery operation, retry identity and surviving owner context.
- Measured complete job time/cost/storage, including analysis, research and retries; no cost values assumed in advance.
- Observed source limit, proposed workaround, explicit owner acceptance/rejection, and remaining failed checks.

## Shared failure trials

Before calling the library durable, interrupt receipt before acknowledgement, after acknowledgement and between attachments; stop/restart the host; repeat the same submission; retry a deliberate duplicate save; delete during delayed processing; fail indexing after successful enrichment; correct a fact during delayed analysis; exhaust AI quota; restore a manual records-plus-media backup into a clean location. Report Pass/Fail/Blocked with evidence for each trial, never merely Job completed.

Before calling a source useful, show receipt, preservation, analysis and retrieval separately. The owner must evaluate any source-specific compromise. Before later reminders/calendar ship, run the corresponding [acceptance scenarios](acceptance-scenarios.md) on real delivery channels.
