# Sprout

Sprout brings personally saved information into one organized, searchable place so its owner can understand it and decide how to use it later.

## Language

**Saved item**:
A piece of information kept for later reference or use, such as a restaurant reel, recipe, message, show ticket, or task.
_Avoid_: Bookmark (when referring to all types of saved information)

**Source**:
The application or place a saved item came from, such as Instagram or WhatsApp.

**Original input**:
The text, links, and attachments the owner originally submitted to create a saved item, accessible separately from Sprout's interpretation.
_Avoid_: Prompt (when referring broadly to submitted material rather than only written instructions)

**Saving intent**:
The owner's reason for keeping a saved item, distinct from what the item is about.

**Reminder**:
A scheduled prompt to return to a saved item or something the owner intends to do.

**Enrichment**:
Information AI adds to help interpret, categorize, find, or use a saved item.

**AI understanding**:
Sprout's interpretation of the original input and collected source material, expressed through a combined summary and categorization, with related actions when available.

**Reprocessing**:
An owner-requested new analysis of a saved item that creates a new item version while preserving earlier versions for inspection and restoration.

**Item version**:
A recorded state of Sprout's understanding of a saved item. Initial enrichment creates the first understood version and each reprocessing creates another; the original input remains the starting record.

**New item**:
A saved item the owner has not yet previewed and accepted.

**Accepted item**:
A saved item whose displayed understanding the owner has explicitly acknowledged reviewing. Acceptance is distinct from factual certainty and permission to execute an action.

**Enriched field**:
A flexible, searchable fact attached to a saved item because it helps describe or retrieve that particular item; its name is not limited by the item's category.
_Avoid_: Optional schema field

**Source material**:
Content collected to understand a submission, such as linked page content, downloaded media, link metadata, and source comments.

**Source comment**:
A comment collected from the original platform as context for a saved item, distinct from a comment the owner writes inside Sprout.

**Subject**:
A distinct person, place, thing, idea, or activity described within a saved item and independently discoverable through search.

**Processing**:
The state in which Sprout has retained the original input but has not yet completed its AI understanding.

**Explicit action**:
An action the owner directly requests, such as scheduling a reminder or adding a calendar entry.

**Suggested action**:
An action Sprout proposes based on saved information and asks the owner to choose before carrying it out.

**Needs your input**:
The queue of distinct repair issues, optional questions and suggested actions awaiting the owner's attention, independent of an item's New or Accepted status.

**Snooze**:
Postponing an existing reminder to a later time.
_Avoid_: Snooze (for scheduling the first reminder)

**Collection**:
An optional owner-defined grouping of saved items, such as a trip or things to cook.

**Space**:
The owner's visual organization context for a collection of saved items, combining its contents with ways to browse and arrange them.
_Avoid_: Folder (when it implies that a saved item must have only one place or that moving it changes its content)

**Space view**:
A presentation of the saved items in a Space, including the owner's chosen arrangement, grouping or filters, without changing the underlying original input.

**Enrichment instructions**:
Owner-controlled guidance describing what AI understanding should contain, how it should be expressed, and how available evidence and missing information should be handled.

**Category**:
A classification of what a saved item contains, such as a restaurant or recipe, which AI can assign and the owner can correct.

**Task**:
Something the owner intends to do, with a completion state independent of whether its reminders have been dismissed or snoozed.

**Resurfacing**:
Proactively bringing previously saved material back to the owner's attention for rediscovery or possible use, without requiring a scheduled reminder.

**External research**:
Consulting information beyond the content deliberately supplied to Sprout, used to fill gaps after saved and directly collected material has been considered first.
_Avoid_: Capture (for looking up additional sources)

**Evidence hierarchy**:
The precedence used when information conflicts: owner statements and corrections, captured source material, then external findings, while preserving material contradictions.

**Linked event**:
A Sprout event connected to a corresponding Google Calendar event, with changes synchronized between them.

**Trash**:
The recoverable state of deleted saved material during the 30 days before permanent deletion.

**Comment**:
Information the owner adds to a saved item without manually editing the item itself.

**Refinement**:
An owner-requested, reviewed revision of Sprout's understanding of a saved item using comments and retained external findings.

**Activity timeline**:
An item's chronological record of owner comments, sourced findings, refinements, and action results, with each kind distinguished.
