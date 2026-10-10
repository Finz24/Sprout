# Sprout

A private personal knowledge workspace: save text, links and files, preserve originals, produce owner-controlled AI understanding, organize items in visual Spaces, and find them again with inspectable evidence.

## Current state

The owner selected Option C: React/Vite/TanStack Router, a separate Effect HTTP API and idle Effect worker, and PostgreSQL/Drizzle/pgvector. The repository now contains the development foundation and planning documents. Login, capture, AI processing, source/model support, Galaxy sharing, tunnel deployment and backup restoration remain future work.

The foundation supports local application processes with containerized PostgreSQL and full Docker Compose built from repository code, with Compose Watch. See [development setup](docs/development.md) for exact versions, startup, checks and offline preparation. Deployment is separate; authentication and private user ownership remain required from the first product release.

## Read next

| Document                                                         | Responsibility                                                        |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| [Product direction](docs/product-direction.md)                   | Purpose, first-release scope and UI direction                         |
| [Product specification](docs/specs/sprout-personal-workspace.md) | Required behavior and user stories                                    |
| [Architecture](docs/architecture.md)                             | Approved technologies, runtime chart and module/processing boundaries |
| [ADRs](docs/adr/0004-effect-api-and-worker.md)                   | Reasons for the accepted architecture and superseded choices          |
| [Open decisions](docs/open-decisions.md)                         | Details still to decide or validate                                   |
| [Glossary](CONTEXT.md)                                           | Domain terminology                                                    |
| [Testing boundary](docs/specs/sprout-testing-boundary.md)        | How application behavior must be verified                             |
| [Acceptance scenarios](docs/acceptance-scenarios.md)             | Observable core and future checks                                     |
| [Source corpus](docs/source-validation-corpus.md)                | Representative source cases; all remain untested                      |
| [Action flows](docs/action-flows.md)                             | Generated core, later and advanced journey contracts                  |

Open the [standalone connected flows](outputs/sprout-connected-flows-standalone.html) directly from disk. It needs no runtime downloads. The [builder instructions](scripts/README.md) explain offline rebuilding and verification.

## Checks

```powershell
corepack pnpm check
corepack pnpm test:integration
corepack pnpm test:e2e
```

Integration and screen tests require the running development environment. Documentation checks remain separate:

```powershell
python -B -X utf8 scripts/build-workflows.py --assemble
python -B -X utf8 scripts/check-workflows.py
```

These Python commands check planning documents and diagrams. Foundation checks prove infrastructure and screen sanity; they do not prove the complete product journey.

Specs and issues are tracked in [Finz24/Sprout](https://github.com/Finz24/Sprout). [Issue #2](https://github.com/Finz24/Sprout/issues/2) uses the owner-selected October 10 development contract. The parent product issue retains its publication history; local documents record subsequent product and architecture decisions.
