# Accessibility

Target: WCAG 2.2 Level AA. Automated scans passing is **not** a claim of full conformance; the manual checks below matter as much.

## What's in place

- **Keyboard.** Every action is reachable by keyboard. Enter/Space on any focused control does that control's job (the study shortcuts only apply in the answer box). Tab only skips a step when focus is in the answer box, so it never traps navigation. All shortcuts (Ctrl/⌃ + H, P, O, Z, /, digits 1–3, Alt/⌥ + number) can be switched off in Settings → Accessibility.
- **Dialogs.** Every window (Settings, Upload, Essays, Start, How it works) is a labelled `role="dialog"` with `aria-modal`; opening it makes the page behind inert and moves focus inside, Tab stays inside, Escape closes, focus returns to the control that opened it (`js/a11y/dialogs.js`). Destructive actions (delete essay, reset progress, delete cloud data/account) ask for confirmation.
- **Typing.** The answer is a real, labelled `<textarea>` (`aria-label` includes the current step; `aria-describedby` points at the prompt). The styled overlay is `aria-hidden`, so typed text isn't read twice. IME composition never triggers auto-submit. **Standard text box** mode shows the plain textarea (same engine and marking).
- **Announcements.** A polite live region announces each new step, pass/fail with the score and what to press next; save failures use an assertive alert. Nothing is announced per keystroke, per WPM update or per animation frame.
- **Not colour alone.** Marking uses strike-through (wrong word, with "you wrote …" for screen readers), dotted underline + "(missed)", "(extra)", "(typed ahead)", and a dashed outline + legend for quote slips.
- **Motion.** Follows the device's reduced-motion setting by default; Settings → Reduce motion can force it on or off. With it on: no CSS transitions/animations, no background motion, Don and the platformer drop to ~1–2 frames per second (rewards and progress still shown).
- **Visual.** High-contrast option; text size 90–140%; contrast audited for text (4.5:1) and controls (3:1) in light and game themes; browser zoom is never disabled.
- **Touch.** Coarse-pointer devices get 44 px minimum targets; tap-to-pick choices are real buttons.
- **Canvas.** Background, sparkline, platformer and falcon canvases are decorative (`aria-hidden`); the numbers they illustrate are available as text.

## Automated checks

`npm run test:a11y` runs axe-core (WCAG 2.0/2.1/2.2 A/AA rules) on: main study screen, marking feedback, Settings, Upload, Essay library, Start menu, Rubric guide, game mode, high contrast, phone tap-to-pick, phone game-mode console. Serious/critical violations fail the build.

## Manual checks to repeat before a release

1. Keyboard only: open an essay, type a chunk, submit (Enter), read the marking, retry (Enter), skip (Tab from the answer box), open Settings, change marking mode, close with Escape — focus should land back on the ⚙ button.
2. Screen reader (NVDA + Firefox/Chrome on Windows; VoiceOver + Safari on Mac/iPhone): complete one build chunk and one paragraph recall using announcements alone; check the marking is understandable from the hidden "(you wrote …)" text.
3. 200% browser zoom and 140% text size: no clipped controls, no horizontal scrolling on the study screen.
4. Reduced motion on at OS level: background still, no animated transitions.
5. Phone with on-screen keyboard open: the answer box and the current prompt stay visible.

Deliberate exception: the faint “coming next” preview after the current chunk is intentionally low contrast (a hint, not required reading). It is hidden from screen readers, excluded from the contrast scan, and much stronger in High contrast mode. The chunk being typed is always full contrast.

Known gaps: the Rubric guide's large tables are readable but dense on small screens; the platformer itself has no non-visual equivalent beyond the level/coin text (it's a reward layer, not required content).
