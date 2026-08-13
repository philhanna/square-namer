# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions are tracked as git tags (no `vN.N.N` prefix).

## [Unreleased]

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
