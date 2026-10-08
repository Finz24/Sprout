# Sprout

A private personal knowledge workspace: save text, links and files, preserve originals, produce owner-controlled AI understanding, organize items in visual Spaces, and find them again with inspectable evidence.

## Current state

The product direction, architecture and testing boundary are approved. This directory contains the current specification and documentation tools; the application, database, worker and tunnel have not been implemented. Source/model support, Galaxy sharing and backup restoration are not yet proven.

The first deployment runs on the owner's Windows computer, with Galaxy access through a named Cloudflare Tunnel. Authentication and private user ownership exist from the first application release. Future hosting can support separate private libraries for other users.

## Read next

| Document | Responsibility |
|---|---|
| [Product direction](docs/product-direction.md) | Purpose, first-release scope and UI direction |
| [Product specification](docs/specs/sprout-personal-workspace.md) | Required behavior and user stories |
| [Architecture](docs/architecture.md) | Approved technologies, runtime chart and module/processing boundaries |
| [ADRs](docs/adr/0001-modular-application-two-processes.md) | Reasons for the durable architecture choices |
| [Open decisions](docs/open-decisions.md) | Details still to decide or validate |
| [Glossary](CONTEXT.md) | Domain terminology |
| [Testing boundary](docs/specs/sprout-testing-boundary.md) | How application behavior must be verified |
| [Acceptance scenarios](docs/acceptance-scenarios.md) | Observable core and future checks |
| [Source corpus](docs/source-validation-corpus.md) | Representative source cases; all remain untested |
| [Action flows](docs/action-flows.md) | Generated core, later and advanced journey contracts |

Open the [standalone connected flows](outputs/sprout-connected-flows-standalone.html) directly from disk. It needs no runtime downloads. The [builder instructions](scripts/README.md) explain offline rebuilding and verification.

## Checks

```powershell
python -B -X utf8 scripts/build-workflows.py --assemble
python -B -X utf8 scripts/check-workflows.py
```

These check planning documents and diagrams. Application tests, TypeScript typechecking and linting will be available after the application and its tooling are created.

Specs and issues are tracked in [Finz24/Sprout](https://github.com/Finz24/Sprout). The local specification includes the October 3 architecture decisions; it is not a claim that the original GitHub issue body has been synchronized with these local updates.
