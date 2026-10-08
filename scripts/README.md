# Workflow documentation builder

`docs/workflow-data.json` is the editable source for journey nodes, edges, stages, rules and open decisions. The builder generates `docs/action-flows.md` and `outputs/sprout-connected-flows.html` together, using cached SVGs in `outputs/workflow-svg/`.

For browser viewing or opening from disk, use `outputs/sprout-connected-flows-standalone.html`. It includes UTF-8 metadata, responsive viewport settings and a light/dark theme, with no external dependencies or runtime scripts. `sprout-connected-flows.html` remains an embeddable fragment and needs its host's theme and encoding; do not open that fragment as a standalone page.

Run `python -B -X utf8 scripts/build-workflows.py --assemble` to regenerate Markdown and both HTML outputs using the retained SVG cache. This is offline and needs only Python's standard library. It refuses stale cached graphs; rule-only edits can reuse them.

For a browser preview, run `python -B -X utf8 scripts/build-workflows.py --serve`, then open `http://127.0.0.1:8781/`. Use `--port` if occupied. This is a local documentation server, not Sprout or a deployment; stop the foreground process when finished. The page owns its encoding and theme and does not depend on an installed agent skill.

When graph nodes or edges change, provide the complete **Mermaid 11.12.0 dist directory** from an approved installed/cached package, then start the server with `--mermaid-dir "C:\path\to\mermaid\dist"`. Open `/build` and select **Build diagrams**. The browser loads the local renderer and the server validates/caches the results. No CDN or runtime download is used. If the package is unavailable, acquiring the pinned distribution is a separate network preparation step; for an air-gapped machine, transfer the cached package/distribution beforehand. Viewing and cached assembly never require Mermaid.

Run `python -B -X utf8 scripts/check-workflows.py` after rebuilding. It checks workflow contracts, graph/SVG identities and markers, native disclosures, standalone encoding/theme and all retained local documentation links. These checks validate documentation, not future application behavior. Every source/target must exist, SVG labels are non-HTML and the fragment stays below 1 MB.

On narrow layouts, explicit source → labeled transition → destination routes replace any diagram whose labels would become too small. All rules remain available under native disclosure controls. Inspect wide/narrow and light/dark views after changes, including keyboard opening and closing of chapters and rule details.
