# One-off migration scripts

These scripts were run once, in order, during the v2 upgrade (November 2026) to transform the original single-file
`index.html` (kept at `tests/fixtures/index.original.html`) into the current layout. They are kept as a record of
exactly what changed; they are not part of the build and will fail if re-run (their anchors no longer exist).

1. `../split-monolith.cjs`  split the inline script into js/engine/*, js/app.js, js/pet.js, js/game.js, js/boot.js, booklet data
2. `p1-worker-modes.cjs`    worker manager + marking modes wired into the app (async, stale-safe submission)
3. `p2-storage-csp.cjs`     settings/stats schema v2 with validation; CSP (no inline scripts, workers, manifest)
4. `p3-settings-a11y.cjs`   Settings window, accessibility preferences, announcements
5. `p4-topbar-focus.cjs`    compact top bar, Focus tile, Enter/Space on focused controls
6. `p5-handheld.cjs`        game mode layout on phones

Golden outputs of the original algorithms: `tools/capture-golden.cjs` → `tests/fixtures/golden.json`.
