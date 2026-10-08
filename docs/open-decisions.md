# Open decisions and validation

Updated October 3, 2026. The [architecture](architecture.md) and authentication-first direction are approved. This list describes the remaining details; it does not reopen the selected stack.

## Before core implementation depends on them

| Detail | Current boundary / next decision |
|---|---|
| Initial publication | Define exactly when an interim result becomes committed. Recommendation: stage progress followed by one validated publication; retries repair unfinished work and cannot silently regenerate completed understanding. |
| Original-only review | Originals remain usable without AI. Decide whether an original-only item can be Accepted; recommendation: reserve acceptance for reviewed understanding. |
| Research Off | Additional external research is forbidden and Off content cannot leak through mixed queries. Specify direct-source acquisition and cloud-analysis permissions separately; recommendation: Off does not itself disable separately authorized source acquisition or cloud analysis. |
| Common item properties | Define the minimal identity/status envelope and flexible fact/evidence representation; preserve the independent dimensions in the workflow. |
| Source languages | English interface and generated output are settled. Select and test other source-language understanding and cross-language retrieval. Preserve original Unicode regardless. |
| Models and extraction | Evaluate generation, embedding, transcription, document extraction and source-acquisition capabilities using the [source corpus](source-validation-corpus.md). No exact winning model or complete platform support is claimed. |
| Operating limits | Choose byte/duration/storage/time/concurrency/research/spend bounds based on measured complete jobs. The accepted eventual-hosting planning target is $25–40/month with a $50 pre-tax ceiling; these are budget goals, not current provider quotes or spend authorization. |
| Local access and uploads | Configure the stable hostname and named tunnel. Verify Galaxy installation/share POST, streaming, session expiry, Windows downtime and large/interrupted upload handling. |
| Backup and export | Define backup retention and prove a clean records-plus-files restore. A readable export and live volumes do not prove disaster recovery. |
| Detailed UI behavior | Evaluate inspector navigation, persisted Space arrangement/grouping, touch alternatives to drag and chosen community components against the approved visual-library direction. |

## Before later features ship

- **Actions/reminders/tasks:** authorization parameters, outcome reconciliation, host-downtime catch-up, timezone/all-day/DST rules, past-due movement, snooze, task completion/reopening and actual delivery evidence.
- **Calendar:** unlink/delete disposition on each side and conflict resolution. Reconnection never replays old creation requests or revives cancelled commitments.
- **Rediscovery:** New-item eligibility, cooldowns, suppression scope and reversal. An empty eligible pool is valid.
- **Advanced comments/history:** comment editing/deletion and retention, conflicting current versus historical search, candidate adoption and version-review behavior. Restore never replays actions.
- **Hosted users:** public signup policy, verification/recovery, account deletion/export, credentials, quotas and abuse controls. Private ownership and isolation are built now; public onboarding is later work.

Later and advanced capabilities remain planned scope, with detailed workflow contracts in [action flows](action-flows.md). No application, device, provider or restoration test has run in this planning directory.
