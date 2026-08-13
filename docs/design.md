# Session Tracking — Design

## Problem

Square Namer currently drills squares continuously with no notion of a
practice session: there's no way to say "here's a block of practice,"
measure how long each square takes to answer, or see which squares are
consistently slow or error-prone.

## Goals

- Let the user start a practice session that runs until either they
  stop it manually or they answer a square wrong — a wrong answer
  always ends the session.
- Record how long each square takes to answer, from the moment it's
  highlighted to the moment a guess is submitted.
- Track per-square difficulty by timing alone. Right/wrong bookkeeping
  isn't needed beyond "was this the miss that ended the session" —
  every square in a session's history was answered correctly by
  construction.
- On session end, show a statistics table: how many squares were
  named before the session ended, which square (if any) broke the
  streak, and per-square timing.

## Non-goals

- Persisting sessions across page reloads (no localStorage/backend) —
  can be a later iteration.
- Aggregating difficulty trends across multiple sessions.
- Configurable session length/goals (e.g. "50 squares" or "5 minutes").
- Accuracy tracking of any kind — a session is pass/fail per square
  and ends at the first failure, so there's nothing to average.

## Session lifecycle

A **session** is the span from pressing **Start** until it ends,
either because the user answers a square wrong or because they press
**Stop** manually.

- **Idle** (initial state / after the session ends): board shows no
  target, answer form is disabled, a **Start** button is shown.
- **Running** (after Start): a square is highlighted, the answer form
  is enabled, timing begins. The button reads **Stop**. Enter submits
  the guess — there is no separate Check button (see below).
- **Ends automatically on a wrong answer**: the miss still gets the
  existing red flash on the square, and once that flash's timeout
  elapses, the session ends and the summary renders. No next square is
  shown.
- **Ends manually on Stop**: allowed at any time, including
  mid-answer. The in-flight, not-yet-answered square is discarded —
  it isn't counted. The summary renders immediately.

Only one session is tracked at a time; starting a new session discards
the previous session's in-memory data (the table remains visible from
the last session until a new Start is pressed, at which point it's
cleared).

## Data model

```js
session = {
  startedAt: Number,   // Date.now() when Start pressed
  endedAt: Number|null,
  attempts: [
    {
      square: 'e4',
      shownAt: Number,      // Date.now() when this square was highlighted
      answeredAt: Number,   // Date.now() when the guess was submitted
      elapsedMs: Number,    // answeredAt - shownAt
    },
    // ...
  ],
  missed: { square: 'h6', guess: 'g5', elapsedMs: Number } | null,
}
```

- `attempts` holds only **correct** answers, in order — a wrong answer
  never gets appended here, because it's what ends the session.
  There's no `correct` field to check; everything in the list is
  correct by construction.
- `missed` records the single wrong answer that ended the session, or
  stays `null` if the session was ended manually via Stop before any
  miss occurred.
- The headline session stat is simply `attempts.length` — the number
  of squares named correctly before the session ended.

Per-square stats are computed by grouping `attempts` by `square`:

```js
perSquare[square] = {
  count: Number,
  avgMs: mean(elapsedMs for attempts on this square),
  maxMs: max(elapsedMs for attempts on this square),
}
```

No accuracy field — every entry contributing to these stats was a
correct answer. "Difficulty" ranking is just `avgMs`, slowest first;
there's no accuracy to weight it by anymore.

The missed square itself is **not** included in `perSquare` / the
table rows — a wrong guess's elapsed time isn't a meaningful "how long
a correct answer takes" data point for that square. It's surfaced
separately in the summary header instead.

Squares that never appeared in the session are omitted from the table
rather than shown as zero/blank rows.

## Timing semantics

- The clock for a square starts the instant it is highlighted
  (`pickTarget()` / `highlightTarget()`), not when the user starts
  typing.
- The clock stops the instant the answer form is submitted (matches
  existing correct/wrong flash timing already in `sqname.js`).
- The post-answer `setTimeout` delay before the next square appears
  (350ms on correct) is **not** counted toward the next square's
  elapsed time, since the next square isn't shown yet. On a wrong
  answer, that same delay (900ms) now leads to the session ending
  instead of the next square appearing.

## UI changes

### Controls

- **Start/Stop button** (`#sessionBtn`) — single toggle button. Label
  switches between "Start session" and "Stop session".
- **No Check button.** `#answerForm` has exactly one text field
  (`#answerInput`), so pressing Enter submits the form via the
  browser's built-in implicit-submission behavior — a submit button
  isn't required for that to work. The button is removed from the
  markup entirely.
- **No Reset stats button.** The live "squares correct so far" count
  is read directly from `session.attempts.length`, and starting a new
  session already clears it — there's nothing left for a separate
  reset action to do.
- While idle, `#answerForm` is disabled and the board shows no target
  square (all squares in normal light/dark colors).
- A small **session timer** (`#sessionTimer`) showing elapsed
  wall-clock time, updated once per second while running.

The existing "Flip board" button remains unchanged.

### Live counter

The old three-metric panel (Streak / Accuracy / Attempts) is replaced
with a single number: **squares answered correctly this session**
(`session.attempts.length`, updated live). Streak and Attempts
collapsed into the same number once a miss always ends the session
outright, and Accuracy no longer means anything mid-session (it's
100% right up until the session ends).

### Slow threshold setting

A **slow threshold** (`#slowThresholdInput`, milliseconds) is
configurable by the user and defaults to **600ms**. A square's average
answer time above this value marks it as a trouble square in the
summary table.

- Editable while idle (before Start), to avoid changing the meaning of
  an in-progress session's data.
- Stored as a module-level `slowThresholdMs` variable, initialized to
  `600` and updated from the input's value when a new session starts.
- Applies uniformly across all squares (not per-square), since the
  goal is a single tunable sensitivity knob, not per-square
  configuration.

### Statistics table

Rendered into a new `#sessionSummary` section, shown after the session
ends and hidden while idle/running:

- Header line: total duration, number of squares answered correctly,
  and how it ended — e.g. `0m 42s · 12 squares · missed h6 (typed g5)`
  or, for a manual stop, `0m 42s · 12 squares · stopped manually`.
- Table columns: **Square**, **Times shown**, **Avg time**,
  **Slowest**. No Accuracy column.
- Rows sorted worst-first by `avgMs` (slowest average first).
- Row highlighting (`.slow` class) for squares whose `avgMs` exceeds
  the slow threshold.

```
Session: 0m 42s · 12 squares · missed h6 (typed g5)

 Square │ Times shown │ Avg time │ Slowest
────────┼─────────────┼──────────┼─────────
   f7   │      2      │  1.4s    │  1.8s
   b2   │      1      │  0.9s    │  0.9s
   e4   │      3      │  0.5s    │  0.7s
   ...
```

## Implementation notes (sqname.js)

- Remove the `checkBtn` element and its references entirely — the
  form has no submit button.
- Remove `resetBtn` and its click handler entirely.
- Replace `streak`/`correctCount`/`attemptCount` module state with the
  `session` object; the live counter reads `session.attempts.length`
  directly rather than a separately maintained variable.
- `pickTarget()` records `shownAt = Date.now()` when the target is
  set, same as before.
- The `answerForm` submit handler:
  - On a **correct** guess: pushes `{square, shownAt, answeredAt,
    elapsedMs}` onto `session.attempts`, updates the live counter,
    flashes green, and schedules `pickTarget()` after 350ms.
  - On a **wrong** guess: sets `session.missed = {square, guess,
    elapsedMs}`, flashes red, and schedules `endSession()` after
    900ms instead of `pickTarget()`.
- `startSession()`: creates a fresh `session` (`attempts: []`,
  `missed: null`), reads `slowThresholdMs` from
  `#slowThresholdInput`, resets the live counter display, enables the
  form, hides the summary table, calls `buildBoard()` + `pickTarget()`.
- `endSession()` (used by both the Stop button and the auto-miss
  path): sets `session.endedAt`, disables the form, clears the
  highlighted target, computes per-square stats from
  `session.attempts`, and renders `#sessionSummary`. The Stop button's
  click handler calls this directly; the wrong-answer path calls it
  from the 900ms timeout instead of calling `pickTarget()`.
- No changes needed to `squareColor`/`buildBoard`/`highlightTarget`
  geometry logic — session tracking is additive around the existing
  drill loop.

## Decisions

- **Stop mid-answer**: allowed. The currently-highlighted,
  not-yet-answered square is discarded — it is not counted as an
  attempt.
- **Slow threshold**: configurable, default **600ms**, an absolute
  cutoff rather than a comparison to the session average.
- No minimum session length/attempt count is required before showing
  the table — it always renders with whatever data exists, even for a
  single attempt.
- **No Check button**: Enter-to-submit relies on the browser's
  implicit form submission for a single-field form; no button is
  needed for that behavior.
- **No Reset stats button**: removed — nothing to reset once the live
  counter is derived directly from session data.
- **Session ends on first miss**: a wrong answer always ends the
  session (no continuing past a mistake). Right/wrong bookkeeping is
  reduced to "was this square the one that ended the session" —
  there's no accuracy percentage anywhere in the design anymore.
