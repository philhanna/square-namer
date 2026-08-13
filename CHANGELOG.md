# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project does not use version numbers; entries are grouped under `[Unreleased]`.

## [Unreleased]

### Added
- Session tracking: Start/Stop control, elapsed-time timer, and a per-square
  timing/difficulty summary table shown when a session ends.
- Configurable slow-answer threshold (ms) used to flag slow squares in the
  summary table.
- Small centered "White"/"Black" captions above and below the board that
  flip along with the board orientation.

### Changed
- Redesigned the session model so a wrong answer always ends the session;
  streak/accuracy tracking was dropped in favor of a single "squares
  answered correctly" count, and per-square stats now rank by average time
  alone (see `docs/design.md`).
- Split the inline CSS/JS out of the original `square-namer.html` into
  `index.html`, `sqname.css`, and `sqname.js`.

### Removed
- The "Check" button — the answer form has a single field, so Enter already
  submits it via the browser's implicit form submission.
- The "Reset stats" button — Start/Stop already delimit a session, so a
  separate mid-session reset serves no purpose.

## [0.0.0] - 2026-08-12
- Initial commit: basic square-naming drill (board, target highlighting,
  answer input, streak/accuracy/attempts stats).
