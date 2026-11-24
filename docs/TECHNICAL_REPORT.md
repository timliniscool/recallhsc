# RecallHSC v2 — technical upgrade report

Date: 24 November 2026. Scope: Web Worker processing, installable offline PWA, optional cloud sync, accessibility,
automated tests, marking modes, plus a security/optimisation review and UI changes requested during the work
(Settings window, Focus tile, compact top bar, handheld game mode on phones).

Status key: **Done + tested** · **Done, externally unverified** (needs a real Supabase project or a real device) · **Needs manual setup** · **Open**.

## 1. Summary

| Area | Status |
|---|---|
| Engine extracted into pure modules (page, worker, tests share one copy) | Done + tested (golden regression vs the original code) |
| Web Worker marking/parsing with latest-wins, stale-result guards, timeouts, restart, inline fallback | Done + tested |
| Faster alignment (word interning + typed-array memo), identical results | Done + tested (2.6–6× faster, §5) |
| Marking modes: Standard (default) · Exact words · Strict quotes · Verbatim | Done + tested |
| PWA: manifest, icons, service worker, offline, install UI, safe update flow | Done + tested in Edge (install prompt UI and iOS/Mac instructions are device-dependent) |
| Optional Supabase sync: schema + RLS, local-first engine, conflict resolution, account UI | Code + unit tests done. Project configured, migration applied, anonymous access verified as blocked (401). **Not yet tested:** magic-link sign-in and two-device sync by a real user, and the two-user RLS check |
| Accessibility: dialogs, keyboard, live regions, reduced motion, high contrast, plain text box, text size, touch targets | Done + tested (axe + Playwright); manual screen-reader pass still recommended |
| Tests: unit, e2e, a11y, PWA/offline, performance; GitHub Actions CI | Done: 76 unit, 23 e2e, 11 a11y screens, all passing (§13). The CI workflow is written but has not run on GitHub yet |
| Settings window, Focus tile (pearlescent), compact top bar, handheld game mode on phones | Done + visually checked |
| Backup restores settings (validated); honest failure on full storage | Done + tested |

## 2. Files

**New**
- `js/engine/{text,chunker,parser,marking,policies,recall}.js`
- `js/workers/{compute.worker,worker-manager}.js`
- `js/{app,pet,game,boot,booklet-data}.js` (moved out of `index.html`)
- `js/a11y/dialogs.js`, `js/pwa/pwa.js`
- `js/sync/{config,conflict,sync}.js`, `js/vendor/supabase-2.117.3.js`
- `manifest.webmanifest`, `sw.js`, `icons/*`
- `supabase/migrations/20261124000000_recallhsc_sync.sql`
- `tests/{unit,e2e,a11y,performance,fixtures,helpers}/*`
- `tools/{serve,capture-golden,split-monolith,stamp-sw,make-icons}.cjs`, `tools/rls-check.mjs`, `tools/patches/*`
- `.github/workflows/ci.yml`, `package.json`, `package-lock.json`, `playwright.config.js`, `.gitignore`
- `docs/*`

**Modified:** `index.html` (scripts moved out; CSP; manifest/icons; Settings window; compact top bar; accessibility markup; new styles), `README.md`. `robots.txt` and `sitemap.xml` are unchanged.

## 3. Architecture

- **No build step.** The repo is what GitHub Pages serves. npm is used only for development and testing.
- **Algorithms.** They live in `js/engine/` as classic scripts that attach to `RecallEngine` (on `window`, or the worker's `self`) and also `module.exports` for Node. The page, the worker and the tests load the **same files**: there is no duplicate implementation.
- **The original code is archived** at `tests/fixtures/index.original.html`. `tools/capture-golden.cjs` slices its algorithms out verbatim and records their outputs (`golden.json`: 215 cases covering sentence splitting, word normalising, edit distance, fuzzy matching, chunking at sizes 2–7, long-sentence splits, alignment, type detection, full parses in essay and creative modes, and every task queue under four settings variants). The refactored engine must match it exactly.
- **The app** (`js/app.js`) keeps its original structure. Engine functions are bound from `RecallEngine` under their old names, so UI code was barely touched. `rangeText`/`buildQueue` now take their state as an argument.
- **Load order** (all `<script src>`, no inline JS):
  1. engine
  2. worker manager
  3. app
  4. Don
  5. game
  6. boot
  7. dialogs
  8. sync config
  9. conflict
  10. sync
  11. PWA

## 4. Web Worker

- **Protocol**
  - Request: `{id, op, payload}`. Response: `{id, ok, result | error}`.
  - Ops: `mark` (full marking for any mode), `live` (live "match so far"), `parse` (upload preview), `ping`.
- **Manager** (`createCompute`):
  - Jobs under 250 words run inline, because messaging costs more than the work. Larger jobs go to the worker.
  - Each *channel* (`mark`, `live`, `uparse`) is latest-wins: a newer request settles the older one as `STALE`.
  - `cancel()` runs on every new attempt, task change, essay load, reset or mode change.
  - A 10 s timeout, a worker crash or a failed post recomputes the request inline and restarts the worker. After 3 restarts the worker is disabled.
  - If `new Worker()` throws (CSP, unsupported, file missing), everything runs inline.
- **Stale-proof submission:**
  - `check()` snapshots `{task, essay, reset epoch, marking mode, attempt token}` and switches to phase `marking`. Input and Enter are ignored meanwhile, so double-submits are impossible.
  - `finishCheck` runs only if every snapshot field still matches. This prevents duplicate rewards, advancing the wrong task, writing to another essay, undoing a reset, or racing a retry.
  - Live accuracy results are applied only when the attempt is unchanged.
- **IME:** no auto-submit while composing; Enter during composition is ignored.
- **CSP:** `worker-src 'self'`. Worker scripts use relative `importScripts`, which works under `/recallhsc/`.

## 5. Performance (measured: `npm run test:performance`, Node 26, Windows laptop)

Mean ms, from two separate runs on the same machine; figures move a few percent between runs (second run: 5,000 words 292 → 117, 1,000 words 39.5 → 6.7). "old" = original monolith functions; "new" = current engine (the new marking column includes tokenising both texts). Results identical in every row.

| words | parse old → new | chunk old → new | align/mark old → new |
|---|---|---|---|
| 100 | 0.138 → 0.106 | 0.014 → 0.014 | 1.3 → 0.84 |
| 500 | 0.411 → 0.340 | 0.010 → 0.008 | 18.1 → 3.0 |
| 1000 | 0.613 → 0.570 | 0.011 → 0.011 | 41.9 → 7.2 |
| 2000 | 1.4 → 1.1 | 0.013 → 0.016 | 99.9 → 20.6 |
| 5000 | 3.9 → 2.7 | 0.011 → 0.022 | 307 → 117 |

**Before the alignment optimisation**, an intermediate version was *slower* than the original (349 vs 322 ms at 5,000 words), because of a string-keyed cache. Mapping each word to a number and caching matches in a typed array fixed that. Heap use in the benchmark fell from 14.8 to 7.8 MB.

**What the student feels:**
- Marking above 250 words runs off the main thread, so typing and animation never stall.
- In the browser, a 287-word whole-essay recall was marked on the worker in about 40 ms, with the same result as inline.
- Chunk-level marking stays inline: under 1 ms.

**Booklet:** the PDF data (65 KB) now loads only when the booklet is opened or downloaded.

## 6. PWA

- **Manifest:** `id`/`start_url`/`scope` are `./`, so it works at `/recallhsc/` and locally. Includes 192, 512, maskable 512, SVG and Apple touch icons, all rendered from the existing brand mark.
- **Service worker caching:**
  - The app shell (29 files) is precached as one versioned set, `recallhsc-shell-<version>-<ASSET_HASH>`, and served cache-first. This is deliberate: a network-first page with cached scripts could mix versions.
  - Google Fonts: the stylesheet is stale-while-revalidate, font files cache-first.
  - Nothing else is intercepted. In particular, Supabase and auth traffic is never cached.
  - Activation deletes only this app's old shell caches.
- **Updates:**
  - `npm run stamp` hashes every precached file into `sw.js`. CI fails if the stamp is stale, so students can't get stuck on an old version.
  - Updates are checked hourly and when the app comes back to the foreground.
  - A new version shows "An update to RecallHSC is available" with Update / Later. Nothing reloads by itself.
  - Update saves progress, stashes an in-progress answer, swaps workers and reloads once. The answer is restored (same essay and step, within 10 minutes).
- **Install:**
  - Chromium browsers (Windows, macOS, Android, ChromeOS) get an Install button from `beforeinstallprompt`.
  - iPhone/iPad: Share → Add to Home Screen. Mac Safari: File → Add to Dock. Firefox desktop is told it can't install apps.
  - The install option is hidden when already running as an installed app.
- **Development:** `?nosw` disables the service worker for that tab session.

## 7–10. Cloud sync (see docs/CLOUD_SYNC.md for exact setup)

- **Architecture:** GitHub Pages (static) + Supabase Auth (passwordless email link, PKCE) + Postgres with RLS + localStorage as the source of truth. No server of our own.
- **Opt-in per student.** `js/sync/config.js` now holds a real project URL and publishable key (added during the upgrade), so Settings → Cloud sync offers sign-in. Nothing is sent until a student signs in *and* turns sync on. The 218 KB vendored supabase-js loads only when a student opens sync, is finishing a sign-in link, or already has a session. With the file emptied, the site is local-only.
- **Schema:**
  - Tables: `essays`, `progress` (keyed by essay revision), `stats` (one row per device), `prefs`.
  - Every table has `user_id` defaulting to `auth.uid()`, with RLS enabled and forced, and policies limited to the owner.
  - Server-side `updated_at` triggers make device clocks irrelevant. There are size and format checks.
  - `delete_my_account()` is security definer and grants access only to `authenticated`.
- **Engine:**
  - Every local save marks a persistent queue (`syncQueue`). Passes are debounced (4 s) and also run on reconnect, on returning to the tab and every 5 minutes.
  - Failures back off exponentially with jitter, capped at 5 minutes.
  - Status shown: local only / syncing / up to date / offline (saved locally) / sync problem (work safe locally).
- **Conflicts** (`js/sync/conflict.js`, unit-tested):
  - Essays carry a content hash (`rev`) and an edit counter (`ver`).
  - Progress merges only between identical revisions. Learnt flags are combined; the furthest position wins.
  - Intentional resets raise an `epoch`; the higher epoch wins, so an older device can't undo a reset.
  - Deletions become tombstones with the text removed from the cloud. A device that reconnects later doesn't bring them back, but edits made after a deletion are kept rather than lost.
  - The same essay edited differently on two devices: both kept, the second as "(other device)".
  - Identical essays are linked, not duplicated.
  - Stats are uploaded per device and summed for display, so nothing is double-counted.
  - Preferences: unsynced local changes win, otherwise the account's settings apply.
- **First sync** explains that libraries are *combined*, not replaced. If a device last synced with another account, it's never uploaded to the new one silently. Signing out keeps local copies.
- **Security:** only the public URL and publishable key are in the repo. The CSP `connect-src` is narrowed to `'self' https://fcnqhlcumstgoyfovuzt.supabase.co wss://fcnqhlcumstgoyfovuzt.supabase.co`. RLS can be checked with `tools/rls-check.mjs` (needs two test users).
- **Verified so far:**
  - project URL and publishable key in `js/sync/config.js`
  - migration applied in the Supabase SQL editor
  - auth Site URL `https://timliniscool.github.io/recallhsc/`, with redirects for that and `http://localhost:5179/recallhsc/`
  - anonymous requests to every table and to `delete_my_account` return 401
- **Still untested:** magic-link sign-in and two-device sync by a real user, and the two-user RLS check (`tools/rls-check.mjs` has not been run).

## 11. Accessibility

See docs/ACCESSIBILITY.md:
- dialogs with focus management
- Enter/Space always work on focused controls (this fixed a real bug where Enter on a button submitted the answer)
- Tab skips only from the answer box
- shortcuts can be switched off
- live announcements
- marking that doesn't rely on colour alone
- reduced motion (device setting plus override)
- high contrast, standard text box, text size
- 44 px touch targets

## 12. Marking modes

| | Standard (default) | Exact words | Strict quotes | Verbatim |
|---|---|---|---|---|
| Case / punctuation | ignored | ignored | ignored | **counted** (curly↔straight quotes, dash types, "…" and spacing are normalised) |
| Spelling | 0/1/2 edits by length | exact | exact **inside quotes**, tolerant elsewhere | exact |
| Typing ahead | free | free | free | counts |
| Stray words | half | half | half | full |
| Pass rule | pass mark | pass mark | pass mark **and** every quoted word right | pass mark |

- Quote spans come from the essay text, carried across sentences; apostrophes never count as quotes.
- A mode change applies from the next attempt.
- Stats record the mode per attempt. Legacy history counts as Standard.
- On phones, stricter modes are genuinely assessed:
  - Verbatim offers a capitals/punctuation variant as a decoy.
  - Exact and quotes offer a misspelling as a decoy.

## 13. Tests and results

Run on 24 Nov 2026 with Node 26.8.1 and Edge (Chromium), Playwright 1.56.1, axe-core 4.10.2:

- `npm run test:unit`: **76/76 pass**
  - golden regression: 11
  - marking modes: 13
  - worker manager: 9
  - conflict resolution: 31
  - sync engine against a fake cloud: 12
- `npm run test:e2e`: **23/23 pass** (26 s). Tests cover:
  - first visit and upload flows
  - pass, fail and retry
  - worker equivalence and blocked-worker fallback
  - stale results and double submission
  - all marking modes, including a mode change mid-answer
  - legacy-data migration, corrupted storage, storage-full reporting
  - backup round trip
  - dialog keyboard and focus
  - Focus tile, accessibility preferences, shortcuts toggle, announcements, IME
  - phone tap-to-pick
  - manifest/icons, offline study, update flow
- `npm run test:a11y`: **11/11 screens pass** with no serious or critical axe violations (18 s): main, marking feedback, Settings, Upload, Essay library, Start menu, Rubric guide, game mode, high contrast, phone tap-to-pick, phone game mode.
  - Fixed along the way:
    - unlabelled sliders in Settings (critical)
    - an empty tooltip announced as a tooltip
    - low contrast on the footer "HSC"
  - Scans run with animations frozen, so colours are measured as finally shown (fade-ins had caused false contrast failures).
  - The deliberately faint "coming next" preview is excluded and documented (docs/ACCESSIBILITY.md).
- `npm run test:performance` and `npm run check:sw`: run and passing (figures in §5).
- CI runs unit, e2e and a11y tests plus the benchmark on Ubuntu with Chrome. The RLS check is a separate manual job that needs secrets.

## 14. Known limitations

- **Cloud sync:** configured and the database is locked to anonymous users. Real sign-in, two-device sync and the two-user RLS check are untested (§7–10). The built-in sample essay isn't synced.
- **Installing:** "Install" depends on the browser (Firefox desktop can't). On iOS it's manual via Share.
- **Very long whole-essay recalls** (5,000+ words) take about 0.1 s of worker time; correct, but not instant on slow phones.
- **Tap-to-pick decoys** are heuristic (word class, ending, length, bigrams from the essay).
- **Accessibility:** automated scans aren't full WCAG verification; a manual screen-reader pass is recommended.

## 15. Manual configuration remaining

- Supabase is set up: config filled in, migration applied, auth URLs set, CSP narrowed to the project.
- Still to do:
  - a real sign-in with a magic link
  - a two-device sync test
  - `tools/rls-check.mjs` with two test users (or the CI `rls` job with repository secrets)
- Optionally add repository secrets for the RLS CI job.

## 16. Deploying

1. `npm ci && npm test` (optional locally).
2. `npm run stamp`.
3. Commit and push to `main`; GitHub Pages serves the root. Existing visitors get the update prompt on their next visit.

## 17. Backwards compatibility

- Storage keys are unchanged (`essayRecall2.*`).
- New fields are optional with safe defaults: settings `mode`, `reduce`, `hc`, `plainInput`, `fs`, `keys`, `v`; progress `epoch` and `rev`; stats `modes` and the third history element.
- All stored data is validated on load. The settings validation is idempotent and drops unknown keys.
- The old side-panel "settings" entry is removed from hidden-panel lists.
- Nothing is ever cleared as a "migration".
- v2 and v3 backups restore, and settings restore only when asked.
- Tested with seeded legacy data and with corrupted storage.
