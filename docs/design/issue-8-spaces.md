# Create and manage Spaces

Proposed for [issue #8](https://github.com/Finz24/Sprout/issues/8), October 25, 2026.
**Design review only. Implementation waits for Ohad's markup.** This PR does not
close #8. Round 2 of the [numbered red-pen sheet](issue-8-review.html) keeps the
Conservatory greenhouse palette from [PR #42](https://github.com/Finz24/Sprout/pull/42)
and [PR #43](https://github.com/Finz24/Sprout/pull/43), and drops the childish
bed/leaf/canopy treatment Ohad rejected. All screen content is synthetic. Visual
research is in [issue-8-research.md](issue-8-research.md).

## Problem

The owner needs named contexts for saved items without copying them. One item
can live in two Spaces and still show one original. Capture may pick a Space or
skip it. Removing a membership or a Space must leave the library item intact.
Ownership stays private. Arrangement, grouping, and a spatial canvas stay with
[#26](https://github.com/Finz24/Sprout/issues/26).

The ticket's Next.js wording is stale. Follow [ADR 0004](../adr/0004-effect-api-and-worker.md).
[#4](https://github.com/Finz24/Sprout/issues/4) already ships an immutable
`private.saved_item` with forced RLS and no UPDATE or DELETE grants.

## Grounding

| Boundary      | Current source and design consequence                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Item identity | `saved_item_owner_identity` on `(owner_user_id, id)` is the child FK target. Membership must use that composite key.      |
| Writes        | `libraryOperations.saveText` inserts through `private.current_owner_id()`. A Space write must use the same owner source.  |
| Capture       | `TextSubmission` is `submissionId`, `originalText`, and `savingIntent`. Do not add a Space field to that contract.        |
| Routes        | `/spaces` and `/spaces/$spaceId` already exist as honest placeholders in `apps/web/src/main.tsx`.                         |
| UI kit        | `@sprout/ui` exports `Button` and `Textarea` only. Later slices add named shadcn pieces into that package.                |
| Cards         | `SavedCard` is module-private in `collection.tsx`. Export it for Space view. Do not fork a second card.                   |
| Visual        | Conservatory tokens and Inter live in `apps/web/src/styles.css` and `library.css`. Extend them. Do not start a new world. |

Also read [architecture](../architecture.md), [CONTEXT.md](../../CONTEXT.md),
[personal-workspace spec](../specs/sprout-personal-workspace.md) stories 10, 11,
41, 42, 48, and 50, and [acceptance scenarios](../acceptance-scenarios.md).

## Usage

Browser-safe contracts stay in `@sprout/contracts`. Parse unknown input at HTTP.
Callers never see a pool, a role, or an owner GUC.

```ts
const receipt = await Library.saveText(frozenSubmission);
if (chosenSpaceId !== null) {
  await Organization.add({ spaceId: chosenSpaceId, itemId: receipt.itemId });
}
await Organization.createSpace({
  spaceId: frozenSpaceId,
  name: 'Things to cook',
});
await Organization.move({
  itemId,
  fromSpaceId: tripId,
  toSpaceId: cookId,
});
await Organization.remove({ spaceId: tripId, itemId });
await Organization.deleteSpace(tripId);
const page = await Organization.listSpaceItems(cookId, {
  cursor: null,
  limit: 20,
});
```

`Library.saveText` stays the only content write. `Organization` owns Space rows
and memberships. `listSpaceItems` returns the same `SavedTextItem` projection
the library already shows. It does not fork originals. Create keeps a client
`spaceId` so a retry does not mint a second Space. A later rename is a different
call.

## Shape

Two private tables, co-located with library storage until a later split is
warranted. A Space is a named owner-scoped row. A membership is a reference to
one saved item. Collection and Space stay one persistent pair.

```ts
interface Organization {
  readonly createSpace: (input: {
    spaceId: SpaceId;
    name: SpaceName;
  }) => Effect<Space, SpaceFailure, RequestAccess>;
  readonly renameSpace: (input: {
    spaceId: SpaceId;
    name: SpaceName;
  }) => Effect<Space, SpaceFailure, RequestAccess>;
  readonly listSpaces: () => Effect<
    readonly SpaceSummary[],
    AccessFailure,
    RequestAccess
  >;
  readonly listSpaceItems: (
    spaceId: SpaceId,
    page: LibraryPage,
  ) => Effect<SavedTextPage, SpaceFailure, RequestAccess>;
  readonly add: (
    input: Membership,
  ) => Effect<void, SpaceFailure, RequestAccess>;
  readonly remove: (
    input: Membership,
  ) => Effect<void, SpaceFailure, RequestAccess>;
  readonly move: (
    input: MembershipMove,
  ) => Effect<void, SpaceFailure, RequestAccess>;
  readonly deleteSpace: (
    spaceId: SpaceId,
  ) => Effect<void, SpaceFailure, RequestAccess>;
}
// SpaceId branded UUID. SpaceName trimmed 1..80 Unicode scalars, no NUL.
// Membership = { spaceId, itemId }. Move = { itemId, fromSpaceId, toSpaceId }.
// SpaceFailure = AccessFailure | NotFound | InvalidName | NameConflict | SameSpaceMove.
// Create is create-if-absent on spaceId. It never renames. Add and remove are
// idempotent. Move is one transaction: dest present, source gone.
```

### Tables and RLS

Conceptual additive migration. Not applied by this PR.

```ts
const space = privateData.table(
  'space',
  {
    id: uuid('id').primaryKey(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('space_owner_identity').on(t.ownerUserId, t.id),
    unique('space_owner_name').on(t.ownerUserId, t.name),
    index('space_owner_recent').on(t.ownerUserId, t.createdAt, t.id),
    check('space_name_size', sql`octet_length(${t.name}) between 1 and 320`),
  ],
);
const spaceMembership = privateData.table(
  'space_membership',
  {
    ownerUserId: text('owner_user_id').notNull(),
    spaceId: uuid('space_id').notNull(),
    itemId: uuid('item_id').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('space_membership_identity').on(t.ownerUserId, t.spaceId, t.itemId),
    index('space_membership_space').on(
      t.ownerUserId,
      t.spaceId,
      t.addedAt,
      t.itemId,
    ),
    index('space_membership_item').on(t.ownerUserId, t.itemId),
  ],
);
```

Foreign keys use `(owner_user_id, space_id)` to `space_owner_identity` and
`(owner_user_id, item_id)` to `saved_item_owner_identity`, both `ON DELETE RESTRICT`
on the item. Space delete is an application transaction that removes memberships
first, then the Space row. It never touches `saved_item`. Insert owner through
`private.current_owner_id()`. Enable and force RLS. Grant `sprout_web` SELECT plus
narrow INSERT, UPDATE (Space name only), and DELETE on these two tables. No new
grants on `saved_item`. Worker and auth stay denied.

HTTP, same-origin, `Cache-Control: no-store`.

- `POST /api/spaces`, `PATCH /api/spaces/:spaceId`, `DELETE /api/spaces/:spaceId`
- `GET /api/spaces`
- `GET /api/spaces/:spaceId/items`
- `PUT /api/spaces/:spaceId/items/:itemId` (add)
- `DELETE /api/spaces/:spaceId/items/:itemId` (remove)
- `POST /api/spaces/memberships/move`

Missing and foreign IDs return the same 404. Add of an existing pair returns 200.
Move to the same Space returns 400. Name conflict returns 409.

## Defaults this design takes

Capture stays a text save. After a receipt the composer may call `add` once if
the owner chose a Space. Receipt status stays retained. Attach status is
attaching, attached, or unconfirmed. A failed add leaves the item saved and
offers **Retry adding to Space**. Retry add, not save. Reload keeps the item.
It does not persist unfinished attach intent.

Move is a transfer. To keep an item in both Spaces, use add.

There is no default Space. Name uniqueness is exact and owner-scoped after trim.

## Visual contract

One mature Conservatory extension: bright greenhouse color, few words, no toy
hero. Default face is Inter. An optional Iowan/Palatino display pairing is shown
on the sheet for Ohad to accept or reject; it is not a product font until he
picks it. Named later `@sprout/ui` pieces: Button, Textarea, Field, Input, Label,
Dialog, AlertDialog, Command, Combobox, Popover, DropdownMenu, Sheet, Empty,
Badge. Touch targets stay 44px. Keyboard reaches every membership action.
Hover-only remove is rejected.

Copy is plain: **Spaces**, **New space**, **12**. Never bed, canopy, seed, or
cartoon leaf. Search is **Ask**.

| Surface        | Composition                                                                                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome         | Slim ~64px glass header. Subtle animated gradient, light-tinted by the open Space. Sidebar lists live Spaces with accent dots and tabular counts. Cmd-K is Command.                                   |
| Spaces list    | Deliberate bento sized by count and recency. Each card is a mosaic of the latest 3–4 originals. One small count. No random tilt. Empty: three ghost cards that breathe, **New space**, starter chips. |
| Space view     | Reuses `SavedCard`. Colored Space chips on the card. Item actions live in one **…** DropdownMenu with shortcuts. Phone: one 44px icon opens Sheet.                                                    |
| Capture picker | Recent-Space chips plus a **+** Combobox. Composer edges tint to the chosen Space. Empty value is valid.                                                                                              |
| Delete Space   | Glass AlertDialog. Copy and tiles show the items staying in the library.                                                                                                                              |

Per-Space accent (bright greenhouse) tints the card glow, optional geometric
icon, sidebar dot, and header. Motion: card grows into the Space page
(`layoutId`), spring stagger on the bento, chip flies to the sidebar on move,
hover tilt on pointer. Reduced motion removes travel. Status never depends on
color or motion. Depth is light grain, glass dialogs, an inner highlight, and a
rich near-black-green dark mode.

Type: tight large headings, tabular counts, small meta labels. One heading and
one short line in the header. No kicker.

## Slice plan

Every later implementation slice stays under 300 changed lines, including tests.
Count the slice before delivery. Split it rather than exceed 299.

1. Additive migration, grants, forced RLS, and startup audit. Budget 240.
2. Contracts plus `organizationOperations` next to `libraryOperations`. Budget 260.
3. Identity allowlist and HTTP handlers for Space and membership. Budget 260.
4. Spaces list, create Dialog, rename Field, bento mosaics, empty ghosts, and
   unavailable states. Budget 280.
5. Export `SavedCard`, Space chips, and add, move, and remove from one
   DropdownMenu (Sheet on phone) with keyboard and 44px targets. Budget 280.
6. Capture recent-Space chips, **+** Combobox, composer edge tint, and
   post-receipt `add`, including retry of a failed attach. Budget 280.
7. Delete AlertDialog and the red Playwright journey: one item in two Spaces,
   remove one membership, reload, the other membership and original remain.
   Budget 280.

Do not add tests or product code in this PR. The red journey belongs to the
first implementation slice after approval.

## Synthesis

Architect runners were Sol and Luna. Cross-judge picked Luna. Parent agrees.
Base is a co-located Organization module, not `Library.spaces`. Graft Sol's
client `spaceId` on create, attaching or unconfirmed receipt states, and
per-slice line budgets. Keep Move as one transaction. The ticket names add,
move, and remove. Two `setMembership` calls can drop or duplicate a row.
Reject a new package, `spaceId` on `TextSubmission`, and scoped `listText`.

Red flags passed for one write owner per table family, private internals, and
one membership path. Reject Space IDs on `saved_item`, JSON item lists,
frontend-only owner filters, and drag-only membership.

## Proof

This docs PR records pinned install, environment, format, and `corepack pnpm check`.
Playwright renders the sheet under `docs/proof/issue-8-design/`. That is artifact
quality, not persistence or authorization. Context7 checked
[Command](https://ui.shadcn.com/docs/components/base/command),
[Combobox](https://ui.shadcn.com/docs/components/base/combobox),
[Dropdown Menu](https://ui.shadcn.com/docs/components/base/dropdown-menu),
[Sheet](https://ui.shadcn.com/docs/components/base/sheet), and
[Alert Dialog](https://ui.shadcn.com/docs/components/base/alert-dialog).
Magic UI, Aceternity, Motion Primitives, Origin UI, and shadcn Blocks stay
pattern references. They are not added to `@sprout/ui`. The local pinned source
remains the authority for later installs.

## Review

Ohad's markup must resolve these before product implementation.

1. Approve the mature greenhouse Spaces, or mark numbered sheet IDs to change.
   Confirm Inter (and whether the optional Iowan/Palatino pairing is in or out),
   light and dark, desktop and Galaxy, and the named shadcn set.
2. Approve the two-table RLS sketch, composite FKs, no `saved_item` mutation, and
   post-receipt optional `add`.
3. When a Space is deleted, should memberships drop immediately, or should the
   Space enter recoverable Trash first?
4. May one capture attach an item to more than one Space, or only to one?
5. Should Space names that differ only by case or Unicode fold collide?

## Merge danger

**Door: two-way documentation. Future schema and RLS are one-way. Blast radius:
design guidance.** Opening or merging this docs PR does not authorize product
implementation, migrations, deployment, provider spending, or closing #8. No
product, test, package, or shared-agent files change. No merge is requested.
