# Spaces visual research

October 25, 2026. Informs the [review sheet](issue-8-review.html). Extends Conservatory
from [issue #4](issue-4-research.md) and shipped PR #43. No schema or product code.

## Repository guidance

[Architecture, UI composition](../architecture.md#ui-composition) selects shadcn
components and tokens first. Discovery sources stay unofficial. The shipped
library already uses local Inter, greenhouse greens, raised cards, and Motion
card lift. Keep Inter. Add no font or dependency in this docs PR.

## Checked references

These are design judgments from public pages. No third-party code or assets
are copied into the sheet.

| Reference                                                                                       | What to use                                                                                                                | Limit                                                                                      |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [shadcn Command](https://ui.shadcn.com/docs/components/base/command)                            | Searchable Space list with `CommandDialog`, `CommandInput`, `CommandGroup`, `CommandItem`, `CommandEmpty`. Keyboard first. | Name the components. The static sheet uses HTML equivalents. Do not install cmdk here.     |
| [shadcn Combobox](https://ui.shadcn.com/docs/components/base/combobox)                          | Optional capture picker. Empty is valid. Chips only after a chosen Space.                                                  | Capture must stay a text save if the owner skips a Space.                                  |
| [shadcn Alert Dialog](https://ui.shadcn.com/docs/components/base/alert-dialog)                  | Delete-Space confirm. Cancel and destructive action. Title required.                                                       | Copy must say items stay in the library.                                                   |
| [shadcn composition](https://github.com/shadcn/ui/blob/main/skills/shadcn/rules/composition.md) | Dialog for create or rename. Sheet for phone membership. Empty for first Space. Badge for membership count.                | Overlay choice follows the task. Do not use a modal for a browse that needs no focus trap. |
| [transitions.dev panel reveal](https://transitions.dev/transitions/panel-reveal/)               | Short Space-view and picker open. Same ease as the #4 receipt.                                                             | Reduced motion removes travel. Status never depends on motion.                             |
| [transitions.dev accordion](https://transitions.dev/transitions/accordion/)                     | Membership row open for add or remove on a card.                                                                           | No drag-only path. #26 owns arrangement.                                                   |
| [Aceternity 3D Card](https://ui.aceternity.com/components/3d-card-effect)                       | Keep Conservatory card planes and offset shadow.                                                                           | No pointer-tilt on pickers or confirmations.                                               |
| [Magic UI Bento Grid](https://magicui.design/docs/components/bento-grid)                        | Space list as uneven living beds, not a flat folder grid.                                                                  | No fake AI titles. Cards show real original excerpts.                                      |
| [useLayouts](https://uselayouts.com/)                                                           | Touch-sized membership actions that sit on the card, not a hover menu.                                                     | Hover-only remove is rejected.                                                             |
| [Opensource UI](https://opensourceui.in/)                                                       | Phone frames for empty, populated, and delete states.                                                                      | Emulated Galaxy S9+, not a physical device.                                                |

## Direction

One Conservatory extension, not three new worlds. Spaces are beds in the same
greenhouse. Capture stays the raised writing panel. A Space is optional. Few
words. Membership controls are visible buttons, 44px, and keyboard reachable.

Named later `@sprout/ui` additions: Button, Textarea, Dialog, AlertDialog,
Command, Combobox, Sheet, Empty, Badge, Field, Input, Label.

## Adoption boundary

Adapt patterns only. The sheet is authored HTML with the existing Inter file.
No registry install, no product component replacement, no new font.
Schema, RLS, and membership invariants live in [issue-8-spaces.md](issue-8-spaces.md).
Visual approval stays with Ohad.
