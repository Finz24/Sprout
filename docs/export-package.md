# Export package v1

`writeExportPackage(snapshot, destination)` writes a readable folder without requiring Sprout to open it. This is a readable export, not a disaster-recovery backup.

The writer is server-only Node code in `packages/runtime/src/library-export/index.ts`. It uses the Node standard library. It is deliberately absent from the runtime package's public entry point until the separately tracked integration work. Tests import the source by relative path.

## Input and result

The narrow `ExportSnapshot` input is an export projection, not the library domain model. It contains one `ownerId`, `items`, `spaces`, `settings`, and `omissions`. The caller supplies an already owner-scoped snapshot. The writer does not authenticate anyone, query a database, or establish ownership from `ownerId`.

Each item contains an ID, title, `location` of `library` or `trash`, seven record groups, and originals. All Trash items supplied in the snapshot are included. Each original is either `available`, with an ID, original name, and local `sourcePath`, or explicitly `missing`, with an ID, original name, and reason. An available source must be a regular file. An unexpectedly absent or unreadable source aborts the export instead of silently changing it to missing.

Each Space contains an ID, name, memberships identified by `itemId`, and named view preferences. Settings contain a name and data. The caller preserves valid IDs, references, and any provenance inside record data. The writer preserves these values rather than resolving relationships or reconstructing omitted records.

The function returns a promise of `ExportReport` with `formatVersion: 1`, the supplied `destination`, `complete`, and `counts`. `complete` is true only when no originals are missing and no omissions were declared. Validation and filesystem failures reject the promise.

The writer validates and copies metadata before its first asynchronous filesystem operation. It never mutates the caller's snapshot. Later changes to the caller's objects do not change the package. Source files must remain stable while copying; the metadata copy does not lock source files.

## Folder layout

```text
export/
  README.txt
  manifest.json
  items/
    000001/
      item.json
      item.md
    000002/
      item.json
      item.md
  originals/
    000001.bin
  spaces.json
  settings.json
```

Item directories and original files use six-digit, one-based ordinals in snapshot order. Titles, IDs, and original names never become path components. The `originals` directory exists only when there are available originals. The original name remains in the item metadata. A reader can copy a `.bin` file to that name to open it with its usual application.

JSON files use UTF-8 with indentation and a trailing newline. Markdown files provide a readable item view with separate sections for each record group. `README.txt` explains navigation, correction precedence, Trash, gaps, and the backup limitation. Paths such as `originals/000001.bin` are relative to the package root. Source filesystem paths do not enter the package.

Original files are copied byte for byte. No text encoding, line-ending, media, or filename conversion changes their contents. The unit fixture verifies exported SHA-256 against independently known input bytes. The manifest does not claim a checksum or restoration guarantee.

## Manifest schema

Every package has exactly this v1 manifest structure. Counts are nonnegative integers. IDs, names, notices, scopes, and reasons are strings. Each array is present even when empty.

```json
{
  "formatVersion": 1,
  "ownerId": "synthetic-owner",
  "notice": "This is a readable export, not a disaster-recovery backup.",
  "counts": {
    "items": 2,
    "libraryItems": 1,
    "trashItems": 1,
    "originals": 2,
    "exportedOriginals": 1,
    "missingOriginals": 1,
    "spaces": 1,
    "settings": 1
  },
  "trashIncluded": true,
  "omissions": [{ "scope": "source comments", "reason": "Not retained." }],
  "missingOriginals": [
    { "itemId": "item-1", "originalId": "original-2", "name": "video.mp4" }
  ],
  "partialFailures": [
    {
      "itemId": "item-1",
      "originalId": "original-2",
      "reason": "Not retained."
    }
  ]
}
```

`items` equals `libraryItems + trashItems`. `originals` equals `exportedOriginals + missingOriginals` and includes originals on Trash items. `spaces` and `settings` count exported entries, including entries with empty data.

`omissions` preserves caller-declared scope and reason pairs. `missingOriginals` identifies each explicitly missing original. Its matching `partialFailures` entry carries the reason. These arrays describe known gaps in a published package. Unexpected write or copy failures reject the operation and never produce a successful package with a hidden failure.

There is no manifest success flag. A published folder can contain known gaps, which these arrays expose. A report with `complete: true` describes only the supplied snapshot and declared omissions. It does not certify that the caller read the whole library.

## Record kinds

`item.json` has `id`, `title`, `location`, `records`, and `originals`. Each group below contains records with `label`, `id`, and `data`. Data preserves the supplied JSON-compatible payload.

| Record group             | Output label              | Meaning                                                                                          |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------ |
| `originalInput`          | `original input`          | Text, links, and other submitted context.                                                        |
| `sourceMaterial`         | `source material`         | Collected source context.                                                                        |
| `generatedUnderstanding` | `generated understanding` | Generated interpretation or facts.                                                               |
| `ownerCorrection`        | `owner correction`        | Owner changes, with `corrects` and `field` identifying the generated record and corrected field. |
| `savingIntent`           | `saving intent`           | Why the owner saved the item.                                                                    |
| `evidence`               | `evidence`                | Supplied support and attribution.                                                                |
| `subject`                | `subject`                 | Each independently described subject.                                                            |

Owner corrections take precedence over generated understanding. Both values remain separate. The writer does not merge the correction into the generated record. Markdown identifies superseded generated records and their corrections.

Available originals have `label: "original file"`, `id`, `name`, and `file`. Missing originals have the same label, ID, and name, plus `missing: true` and `reason`, without a `file` field.

`spaces.json` contains a `spaces` array. Each Space retains its ID and name. Its `memberships` array contains `{ "label": "membership", "itemId": "..." }`. Its `viewPreferences` array contains records with `label: "view preference"`, `name`, and `data`. Memberships reference the exported item ID without duplicating its content.

`settings.json` contains a `settings` array of records with `label: "setting"`, `name`, and `data`. No settings or organization change is executed by the export.

## Validation and publication

Before creating files or folders, the writer recursively examines supplied metadata, including unknown properties. It rejects property names containing `token`, `secret`, `password`, `cookie`, `apikey`, or `session` after lowercasing and removing separators. It also checks logical setting and view-preference names. Rejection messages do not echo the rejected value.

This guard examines structured keys and logical names. It does not scan prose, URLs, or original bytes for secrets. Such scanning would not establish that arbitrary content is secret-free. The caller supplies appropriate owner data. Credentials, sessions, and authentication configuration are outside this input contract.

Unsupported values such as functions, undefined values, cycles, accessors, nonfinite numbers, and non-JSON object prototypes reject before publication. The format is JSON data, not JavaScript object serialization.

The destination must be fresh and have an existing, caller-controlled parent directory. The writer rejects an existing destination, including an empty directory or a symlink. It never replaces a previously published package. Repeating an export to the same destination rejects and leaves the earlier package unchanged. Retrying a failed export can use the original destination once no destination was published.

Writes occur in a uniquely named sibling ending in `.partial-<random>`. Original copies run sequentially. The writer writes the README and manifest after all copies succeed, then renames the sibling to the destination. There is no copy-based publication fallback. An exception triggers removal of only that invocation's staging directory. If cleanup also fails, an `AggregateError` retains the original error and cleanup cause. Error causes can contain private filesystem paths and are not package contents.

A process termination can leave a `.partial-*` sibling. That name always means incomplete staging and must not be treated as a published package, even if individual files exist. Publication relies on the local filesystem's same-parent directory rename semantics. It does not promise power-loss durability, coordinate changes by unrelated processes in the parent directory, or make a backup.

## Version rules and scope

`formatVersion` is an integer describing the disk format, independent of Sprout's application or database version. Version 1 fixes the filenames, labels, field meanings, and declared-gap semantics above. A change that removes or renames a field, changes its type or meaning, or changes paths requires a new format version. Readers reject unsupported versions rather than guessing. Consumers may ignore additional descriptive fields, but must not reinterpret v1 fields.

This output-only format has no import or restore contract. [Issue #30](https://github.com/Finz24/Sprout/issues/30) covers this writer and synthetic filesystem proof. The following work remains outside the slice:

- The authenticated, owner-scoped database reader, two-user isolation proof, HTTP download, and UI journey belong to [#38](https://github.com/Finz24/Sprout/issues/38).
- Records-and-media backup, recovery, and tested restoration belong to [#31](https://github.com/Finz24/Sprout/issues/31).
- Search projections are disposable and are not authoritative export records.
- No schema changes, migrations, auth setup, provider calls, reprocessing, or library writes occur.
- The writer does not execute reminders, calendar changes, notifications, resurfacing, refinement, or version restoration.
- Tests use synthetic content. Passing them does not prove a complete application journey or a real owner's full library export.
