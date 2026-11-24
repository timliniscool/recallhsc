# RecallHSC

Memorise HSC English essays by typing them, chunk by chunk. A static web app (vanilla HTML/CSS/JS) hosted on GitHub Pages: https://timliniscool.github.io/recallhsc/

- **Chunk drills and a recall ladder.** Meaning-based chunks build each sentence; long sentences are learnt in two halves; then the IQTVE / quote + analysis unit, the paragraph (twice at the end), and the whole essay at checkpoints.
- **Any writing.** Paste or upload essays, creative, discursive or hybrid pieces. Structure, moves (narrative, reflection, question, turn) and motifs are detected automatically.
- **Marking modes.** Standard (spelling tolerant, the default), Exact words, Strict quotes, Verbatim. Every submission shows the marking.
- **Works offline, installs like an app.** After the first visit it runs without a connection; install it from Settings → App.
- **Optional cloud sync.** Off unless the site owner configures Supabase and a student signs in. Local-only mode needs no account.
- **Accessible.** Keyboard operable, screen-reader announcements, accessible dialogs, reduced motion, high contrast, a standard text box mode, text size.
- **Extras.** Live telemetry and memory profile, Rubric guide (NESA rubrics, trial-question stats, exam tips, Mod C exemplars, writing booklet), gamify mode (retro platformer; a handheld-console layout on phones), and Don the falcon.

Everything is stored in the browser (localStorage). Back up / restore from **Essays**.

## Project layout

```
index.html                 markup + styles (no inline scripts; strict CSP)
manifest.webmanifest       PWA manifest (scoped to ./ for the /recallhsc/ path)
sw.js                      service worker (versioned app-shell cache)
js/engine/                 pure algorithms, shared by the page, the worker and the tests
  text.js chunker.js parser.js marking.js policies.js recall.js
js/workers/                compute.worker.js + worker-manager.js (latest-wins, fallback)
js/app.js                  UI, state, storage, guide          js/boot.js   start-up
js/pet.js  js/game.js      Don the falcon, gamify mode        js/a11y/dialogs.js
js/pwa/pwa.js              install + update flow               js/booklet-data.js (lazy)
js/sync/                   config.js (empty = local only), conflict.js, sync.js
js/vendor/                 supabase-js (loaded only if sync is configured)
icons/                     app icons (npm run icons regenerates them)
supabase/migrations/       database schema + Row Level Security
tests/                     unit, e2e, a11y, performance, fixtures (golden outputs)
tools/                     dev server, icon/sw stamping, RLS check, one-off migration scripts
docs/                      TECHNICAL_REPORT.md, CLOUD_SYNC.md, ACCESSIBILITY.md
```

## Development

No build step: the files in the repo are what GitHub Pages serves. npm is only used for tests and tooling.

```
npm install                 # dev tools only (Playwright, axe-core, supabase-js source for vendoring)
npm run serve               # http://localhost:5179/recallhsc/   (add ?nosw to disable the service worker while editing)
npm run test:unit           # algorithms, marking modes, worker manager, conflict resolution, sync engine
npm run test:e2e            # browser tests (uses installed Edge/Chrome; PW_CHANNEL=chrome|msedge)
npm run test:a11y           # axe-core accessibility scans
npm run test:performance    # engine benchmark: original vs current, 100–5,000 words
npm run stamp               # REQUIRED before deploying: re-stamps sw.js so students get the update
```

`npm run check:sw` fails if `sw.js` wasn't re-stamped after a change (CI runs it).

## Deploying

Push to `main`; GitHub Pages serves the repo root. Run `npm run stamp` first. The service worker offers the update to students ("An update to RecallHSC is available"); it never reloads by itself.

Cloud sync setup: see [docs/CLOUD_SYNC.md](docs/CLOUD_SYNC.md). Architecture, measurements and test results: [docs/TECHNICAL_REPORT.md](docs/TECHNICAL_REPORT.md).
