2026-10-23: merged #36 (design for #3) as 99ca810, squash, ohad-approved.
2026-10-24: ohad merged #37 (#3 auth + greenhouse sign-in) after review; e2e flake came from desktop+mobile sharing one in-memory sign-in budget, fixed by restarting the api per browser project.
2026-10-24: merged #40 (#30 export), ohad-approved; parallel scoping off #3 worked.
2026-10-24: merged #41 (#31 backup/restore) as cc27459, ohad-approved (2647 lines, over the 300-line cap); backup test stopping the shared api broke auth integration tests until isolated. codex/opencode usage limits stalled #31 for hours; the grok-4.6 fallback finished it.
2026-10-24: merged #42 (design for #4) as 1078256. The first sheet was rejected as too minimal and flat. Revision 2 kept the schema proposal and shipped Conservatory A with layered green planes.
2026-10-25: ohad merged #43 (#4 text save) as bef2e57. Isolated `--e2e-only` on a fresh database is the browser proof. Compose-then-e2e on leftover items is not.
