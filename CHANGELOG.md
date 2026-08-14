# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions are tracked as git tags (no `vN.N.N` prefix).

## [2.1.0] - 2026-08-14

### Changed
- Replaced the voice-input mic button's 🎙 emoji with an inline SVG icon
  (same pattern as `#pauseBtn`), since the emoji relies on the OS's
  color-emoji font and rendered as a flat, illegible glyph on desktop
  Chrome without one.

## [2.0.0] - 2026-08-13

### Added
- Voice input mode (🎙 button, Web Speech API): square names and the
  start/stop/pause/resume commands can now be spoken instead of typed,
  addressing the mobile on-screen keyboard covering the board while
  answering. Recognized speech routes through the same
  form-submit/button-click paths as manual input rather than
  duplicating game logic (issue #1).
- Pause/Resume control (`#pauseBtn`) that freezes all session timers.
  The per-square timeout, post-answer transition delays, and session
  clock all route through a pausable-timeout wrapper (or have their
  anchor timestamps shifted forward on resume), so pausing mid-drill
  can't silently burn down the timer or count paused wall-clock time
  as elapsed/answer time (issue #3).
- The board now renders the opening chess position with inlined
  python-chess piece art. Pieces stay pinned to their real squares so
  orientation flips still work, and the SVG markup is inlined (not
  `<img src>`) so it renders when `index.html` is opened directly via
  `file://`, which Chrome otherwise blocks.
- `voice-input.md`, a design doc for the voice input feature.
- A README section on running the app directly from GitHub.

### Fixed
- The top row could overflow past the board's right edge:
  `#answerInput` had `flex: 1` but no `min-width: 0`, so its
  browser-default intrinsic minimum width overrode `flex-shrink` and
  let it balloon past its container (issue #3).
- `#topRow` and `#statusRow` were sized to `#boardWrap`'s outer edge
  rather than the board's actual left edge, which sits 1.3em further
  right behind the rank-label gutter, so both rows stuck out past
  where the board actually starts (issue #3).
- `answerInput.focus()` calls (in `startSession`/`resumeSession`/
  `endSession`/`setOrientation`) were reopening the Android on-screen
  keyboard during voice sessions. Those calls are now guarded against
  an active voice session, and the input is blurred when voice input
  is toggled on.

## [1.3.1] - 2026-08-12

### Fixed
- The session summary popup's Close button could be pushed off-screen
  by a long per-square table, requiring the whole popup to be scrolled
  to reach it. The table now scrolls in its own internal region while
  the Close button stays pinned and always visible at the bottom.

## [1.3.0] - 2026-08-12

### Added
- A tabular summary-statistics block in the session summary popup,
  between the header and the per-square table: accuracy %, average time
  across all squares answered correctly, the 3 most difficult squares,
  and the 3 least difficult squares. Values are column-aligned rather
  than run into sentences, and the difficulty lists show just the
  square names (their average time is already in the table below).
- `README.md`, covering what the app is, how to clone it, and how to run
  it (no build step — just open `index.html` or serve the directory).
- `LICENSE` (MIT).

### Changed
- Moved `docs/design.md` to `design.md` at the repo root and removed the
  now-empty `docs/` directory.

## [1.2.0] - 2026-08-12

### Added
- A "Show rank/file labels" checkbox in the Settings popup (checked by
  default), letting the board's coordinate border be turned off. Applies
  instantly and doesn't affect a running session's highlighted square.

### Changed
- Reordered the Settings popup: Board orientation now comes before the
  per-square time limit.
- The White/Black orientation options are now a single horizontal row
  instead of two stacked rows.

## [1.1.0] - 2026-08-12

### Added
- A thin coordinate border around the board: rank numbers (1-8) down the
  left edge, file letters (a-h) along the bottom edge, updating to match
  whenever the board orientation flips.

### Changed
- The answer field is now focused as soon as the page loads (and again
  right after a session ends), instead of only once a session starts.
- While idle, pressing Enter in the answer field starts a session, same
  as clicking Start — regardless of what, if anything, is typed there.
  The field is only disabled during the pre-session countdown now,
  where previously it stayed disabled for the entire idle state.

## [1.0.0] - 2026-08-12

First release.

### Added
- A big "3 … 2 … 1" pre-session countdown (Puzzle Rush-style), centered
  over the board. Pressing Start no longer begins the session
  immediately — the session (and every timer: per-square time limit,
  session clock) only starts once the countdown finishes.
- A 350ms pause on the plain board after the countdown, before the first
  square lights up — the countdown overlay disappearing and a target
  appearing at the same instant felt disorienting, even though the
  per-square timer itself was already getting its full configured limit.
- A **Settings popup** (gear icon, `#settingsBtn`), holding the per-square
  time limit input and the White/Black orientation radios — the same
  overlay/backdrop pattern as the session summary popup, just narrower.

### Changed
- Moved the Start/Stop button and the session timer down into the bottom
  row alongside the answer input, instead of the settings row above the
  board. Both control rows are capped to the board's own width.
- Shortened the button label from "Start session"/"Stop session" to just
  "Start"/"Stop".
- Reordered the bottom row so the answer input sits between the Start/Stop
  button and the session timer, centering it in the row instead of having
  it flush against the button.
- Renamed the "Time limit (ms)" label to "Per-square time limit (ms)" for
  clarity.
- Changed `#timeLimitInput` from `type="number"` to a plain
  `type="text"` field (with `inputmode="numeric"` for mobile keyboards),
  removing the browser's up/down spinner arrows.
- **Reworked the top-of-page layout to cut clutter**: the per-square time
  limit input and orientation radios moved out of the always-visible
  settings row into the new Settings popup. The answer row (Start/Stop,
  answer input, session timer) moved from below the board to a single
  row directly above it, with the settings gear on the right. The
  right/wrong counts moved into a thin status line between that row and
  the board, alongside the feedback message. Net effect: everything
  above the board is now one control row plus one status line, instead
  of a settings row, a stats row, the board, and a controls row below it.

## [1.0.0-RC1] - 2026-08-12

### Added
- A configurable per-square time limit (`#timeLimitInput`, default 1000ms),
  shown in the same row as the orientation radios. Answering after the
  limit counts as a miss ("timed out"), even if the guess is correct.
- Live right/wrong counts (green/red) in that same row, to the left of the
  orientation radios, replacing the earlier single "Squares" counter.

### Changed
- Sessions are now "3 strikes and you're out," Puzzle Rush-style: a miss
  (wrong guess or timeout) no longer ends the session immediately — it
  takes 3 misses. The summary lists every miss and how it happened
  (`typed g5` vs. `timed out`).

## [0.4.0] - 2026-08-12

### Changed
- A wrong answer now ends the session automatically, same as pressing Stop —
  practice sessions are pass/fail per square instead of continuing past a
  mistake.
- Accuracy tracking is gone. The three-metric Streak/Accuracy/Attempts panel
  is replaced by a single live "Squares" counter, and the summary table
  drops its Accuracy column (now: Square, Times shown, Avg time, Slowest).
  The summary header reports how the session ended (`missed h6 (typed g5)`
  or `stopped manually`).
- The session summary is now a pop-up modal (backdrop + centered card,
  dismissed via a Close button or by clicking outside it) instead of a
  panel inline below the board, and it appears 500ms after the session
  ends rather than instantly.

## [0.3.0] - 2026-08-12

### Added
- White/Black radio buttons to set board orientation directly, replacing the
  toggle-style "Flip board" button.
- Input validation: a guess that isn't a well-formed square name (e.g. "zz",
  "e10") shows a warning message instead of being scored as a wrong answer,
  and doesn't advance to a new square — the user just retries.

### Removed
- The "Reset stats" button — Start/Stop already delimit a session, so a
  separate mid-session reset serves no purpose.
- The "Flip board" button — superseded by the White/Black orientation
  radios.
- The configurable slow-threshold input — the value is now a hard-coded
  `SLOW_THRESHOLD_MS = 500` constant at the top of `sqname.js`.

## [0.2.0] - 2026-08-12

### Added
- Session tracking: Start/Stop control, elapsed-time timer, and a per-square
  timing/difficulty summary table shown when a session stops.
- Configurable slow-answer threshold (ms) used to flag slow squares in the
  summary table.
- Small centered "White"/"Black" captions above and below the board that
  flip along with the board orientation.
- Design doc (`docs/design.md`) proposing a revised session model — a wrong
  answer ends the session and accuracy tracking is dropped in favor of a
  single "squares answered correctly" count.

### Removed
- The "Check" button — the answer form has a single field, so Enter already
  submits it via the browser's implicit form submission.

## [0.1.0] - 2026-08-12

- Initial commit: basic square-naming drill (board, target highlighting,
  answer input, streak/accuracy/attempts stats).
- Split the inline CSS/JS out of the original `square-namer.html` into
  `index.html`, `sqname.css`, and `sqname.js`.
