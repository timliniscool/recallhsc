<div align="center">

# Recall<sub><sup>HSC</sup></sub>

**Memorise HSC English essays, chunk by chunk.**

Type it, recall it, own it, in the browser, offline, for free.

[![Open RecallHSC](https://img.shields.io/badge/Open-RecallHSC-0284c7?style=for-the-badge)](https://timliniscool.github.io/recallhsc/)
[![Try the beta](https://img.shields.io/badge/iPad_beta-Handwriting-a855f7?style=for-the-badge)](https://timliniscool.github.io/recallhsc/beta/)

![Vanilla JS](https://img.shields.io/badge/vanilla-JS-f7df1e?logo=javascript&logoColor=000)
![No build step](https://img.shields.io/badge/build-none-22c55e)
![Works offline](https://img.shields.io/badge/PWA-works_offline-0ea5e9)
![Accessibility](https://img.shields.io/badge/WCAG-2.2_AA_aim-8b5cf6)
![No cookies](https://img.shields.io/badge/cookies-none-64748b)

<img src="docs/images/recallhsc.png" alt="RecallHSC: a chunk being typed from memory, with live telemetry and the memory profile beside it" width="900">

</div>

---

## Why RecallHSC

Memorising a 1,000-word essay by rereading it doesn't stick. RecallHSC builds it the way memory actually works: **small pieces, recalled from memory, then joined into bigger ones**, with honest marking every step of the way.

| | |
|---|---|
| 🧩 **Chunk drills** | Each sentence is built up a few meaningful words at a time. Long sentences are learnt in two halves first. |
| 🪜 **A recall ladder** | Chunk → sentence → IQTVE / quote + analysis unit → paragraph (twice at the end) → the whole essay so far at checkpoints. |
| ✍️ **Any kind of writing** | Essays, creative, discursive and hybrid pieces. Structure, moves (narrative, reflection, question, turn) and recurring motifs are found automatically. |
| ✅ **Marking you can trust** | Standard (spelling-tolerant, the default), Exact words, Strict quotes or Verbatim. Every check shows exactly what you missed. |
| 📈 **See it working** | Live typing telemetry, a memory profile (your nemesis word, signature typo, slip point) and progress by word, sentence and paragraph. |
| 📚 **Rubric guide** | NESA rubrics, trial-question stats, exam tips, Module C exemplars and a writing booklet, built in. |
| 🎮 **Game mode** | A retro platformer that runs on your recall, with a handheld-console layout on phones. And Don the falcon. |

## Built for real study sessions

- **Works offline.** After the first visit it runs without a connection, and installs like an app (Settings → App).
- **Updates itself.** Open the site and you're on the latest version. If an update lands while you're mid-answer, it waits for you to tap Update.
- **Optional cloud sync.** Sign in with an email link to carry essays and progress across devices. Everything works without an account.
- **Accessible.** Fully keyboard-operable, screen-reader announcements, accessible dialogs, reduced motion, high contrast, a standard text box mode and adjustable text size.
- **Private by default.** Essays stay in your browser. No cookies, no ads. Anonymous usage counts can be switched off. See the [privacy policy](https://timliniscool.github.io/recallhsc/privacy.html).

## ✍️ iPad beta: write it by hand

HSC exams are handwritten, so the [beta](https://timliniscool.github.io/recallhsc/beta/) lets you practise by hand with **Apple Pencil** (iPad only).

- Endless lined or blank paper with an exam-style margin; Apple Pencil writes, fingers scroll, palms are ignored.
- Press **Check** and your writing is read **on the iPad itself** (TrOCR-small via transformers.js + ONNX Runtime Web). It's free and private, and works offline after a one-time download.
- It's fast because it already knows what you meant to write: finished lines are prepared while you write, and messy-but-right words get the benefit of the doubt, while genuinely wrong words still fail.

## For developers

No framework and no build step: the repository *is* the site GitHub Pages serves. Node is only used for tests.

```bash
npm install
npm run serve          # http://localhost:5179/  (add ?nosw to skip the service worker while editing)
npm test               # unit + browser + accessibility tests
npm run stamp          # re-stamp the service worker after changing cached files
```

<details>
<summary><b>Project layout</b></summary>

```
index.html                 markup + styles (no inline scripts; strict CSP)
privacy.html               privacy policy
manifest.webmanifest       PWA manifest (scoped to ./ for the /recallhsc/ path)
sw.js                      service worker (versioned app-shell cache; auto-updates on open)
js/engine/                 pure algorithms shared by the page, the worker and the tests
  text.js chunker.js parser.js marking.js policies.js recall.js
js/workers/                compute.worker.js + worker-manager.js (latest-wins, fallback)
js/app.js                  UI, state, storage, guide          js/boot.js        start-up
js/pet.js  js/game.js      Don the falcon, game mode          js/a11y/dialogs.js
js/pwa/pwa.js              install + update flow              js/analytics.js   cookie-free counts
js/sync/                   config.js, conflict.js (merge rules), sync.js
js/vendor/                 supabase-js (loaded only when signing in)
supabase/migrations/       database schema + Row Level Security
tests/                     unit (node:test), e2e + a11y (Playwright, axe-core), performance
.github/workflows/         CI, and Pages (main at /recallhsc/, beta at /recallhsc/beta/)
```

</details>

<details>
<summary><b>How it's tested</b></summary>

- **Unit:** golden regression tests for the chunking and marking engine, every marking mode, the worker manager, and the cloud-sync merge rules.
- **Browser:** end-to-end flows in Playwright, including offline use, updates, backups and the handwriting beta.
- **Accessibility:** axe-core checks of every screen, in normal and game mode, on desktop and phone.
- **CI** runs all of it on every push.

</details>

## Contributing

Bug reports and ideas are welcome: [open an issue](https://github.com/timliniscool/recallhsc/issues). If you're an HSC student and something about the way RecallHSC drills your essay doesn't fit how you learn, that's worth an issue too.

<div align="center"><sub>Made by a student, for students. Good luck in the HSC.</sub></div>
