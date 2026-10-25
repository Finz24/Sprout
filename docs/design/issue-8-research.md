# Spaces visual research

October 25, 2026. Round 2. Informs the [review sheet](issue-8-review.html).
Extends the Conservatory tokens from [issue #4](issue-4-research.md) and shipped
PR #43. Bright accents on paper, not a mint wash and not a toy greenhouse. No
schema or product code.

## Repository guidance

[Architecture, UI composition](../architecture.md#ui-composition) selects shadcn
components and tokens first. Discovery sources stay unofficial. The shipped
library already uses local Inter, greenhouse greens, raised cards, and Motion
card lift. Keep Inter as the product default. Add no font or dependency in this
docs PR. An optional Iowan/Palatino display pairing appears only on the sheet
for Ohad to pick.

## Checked references

These are design judgments from public pages. No third-party code or assets
are copied into the sheet. Community kits are pattern sources only. Later
installs use the named shadcn pieces in [issue-8-spaces.md](issue-8-spaces.md).

| Reference                                                                                       | What to use                                                                                                                          | Limit                                                                                  |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [shadcn Command](https://ui.shadcn.com/docs/components/base/command)                            | Cmd-K palette: `CommandDialog`, `CommandInput`, `CommandGroup`, `CommandItem`, `CommandEmpty`, `CommandShortcut`. No open animation. | Name the components. The static sheet uses HTML equivalents. Do not install cmdk here. |
| [shadcn Combobox](https://ui.shadcn.com/docs/components/base/combobox)                          | Capture **+** picker. Empty is valid. Recent-Space chips sit beside it.                                                              | Capture must stay a text save if the owner skips a Space.                              |
| [shadcn Dropdown Menu](https://ui.shadcn.com/docs/components/base/dropdown-menu)                | One **…** menu for add, move, remove, with `DropdownMenuShortcut`.                                                                   | Hover-only remove is rejected. 44px targets.                                           |
| [shadcn Sheet](https://ui.shadcn.com/docs/components/base/sheet)                                | Phone membership: one icon opens the same actions.                                                                                   | Overlay choice follows the task.                                                       |
| [shadcn Alert Dialog](https://ui.shadcn.com/docs/components/base/alert-dialog)                  | Delete-Space confirm. Title required. Tiles show items staying in the library.                                                       | Copy must say items stay in the library.                                               |
| [shadcn Blocks](https://ui.shadcn.com/blocks)                                                   | Sidebar + header chrome, command palette block, dialog density.                                                                      | Adapt structure. Do not paste a marketing dashboard.                                   |
| [shadcn composition](https://github.com/shadcn/ui/blob/main/skills/shadcn/rules/composition.md) | Dialog for create or rename. Empty for first Space. Badge for chips and the one small count.                                         | Do not use a modal for a browse that needs no focus trap.                              |
| [Arc](https://arc.net)                                                                          | Per-Space accent on header glass, sidebar dots, and a light tint. Slim chrome.                                                       | No browser-chrome costume. No toy tiles.                                               |
| [Linear](https://linear.app)                                                                    | Tight large headings, tabular counts, small meta labels, one short line under the title.                                             | No issue-tracker chrome.                                                               |
| [Are.na](https://www.are.na)                                                                    | Space cards as mosaics of the latest 3–4 real originals.                                                                             | No empty icon tiles standing in for content.                                           |
| [mymind](https://mymind.com)                                                                    | Mixed visual memory on the card face. Content first.                                                                                 | No mascot, leaf, or illustrated empty.                                                 |
| [Cosmos](https://www.cosmos.so)                                                                 | Quiet dark, rich near-black-green, reserved motion.                                                                                  | Dark is evening greenhouse, not neon.                                                  |
| [Things](https://culturedcode.com/things)                                                       | Calm density. Actions recede until needed.                                                                                           | No checklist costume.                                                                  |
| [Raycast](https://www.raycast.com)                                                              | Command palette with shortcuts. Instant.                                                                                             | Keyboard-opened Command has no animation.                                              |
| [Magic UI Bento Grid](https://magicui.design/docs/components/bento-grid)                        | Deliberate bento sized by count and recency.                                                                                         | No random tilt. No fake AI titles.                                                     |
| [Magic UI Dock](https://magicui.design/docs/components/dock)                                    | Compact, counted sidebar rows.                                                                                                       | Sidebar stays a list, not a toy dock.                                                  |
| [Aceternity Focus Cards](https://ui.aceternity.com/components/focus-cards)                      | Quiet the neighbors when a Space is hovered.                                                                                         | Pointer-only. Off under reduced motion.                                                |
| [Aceternity 3D Card](https://ui.aceternity.com/components/3d-card-effect)                       | Slight hover tilt on Space cards.                                                                                                    | No tilt on pickers, menus, or confirmations.                                           |
| [Motion Primitives](https://motion-primitives.com)                                              | `layoutId` card-grows-into-page. Spring stagger. Chip flies to the sidebar on move.                                                  | Reduced motion removes travel. Status never depends on motion.                         |
| [Origin UI](https://originui.com)                                                               | Combobox and composer field treatment.                                                                                               | Pattern only. Origin currently redirects; not an install.                              |

## Direction

One Conservatory extension, not a new world. Spaces are named contexts in the
same library. Capture stays the raised writing panel. A Space is optional. Few
words. Membership lives in one menu. Accents are bright and specific; mosaics
show real originals, not empty color blocks.

Named later `@sprout/ui` additions: Button, Textarea, Dialog, AlertDialog,
Command, Combobox, Popover, DropdownMenu, Sheet, Empty, Badge, Field, Input,
Label.

## Adoption boundary

Adapt patterns only. The sheet is authored HTML with the existing Inter file.
No registry install, no product component replacement, no new font file.
Schema, RLS, and membership invariants live in [issue-8-spaces.md](issue-8-spaces.md).
Visual approval stays with Ohad.
