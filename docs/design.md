# Session Tracking — Design

## Problem

Square Namer currently drills squares continuously with no notion of a
practice session: there's no way to say "here's a block of practice,"
measure how long each square takes to answer, or see which squares are
consistently slow or error-prone.

## Goals

- Let the user explicitly start and stop a timed practice session.
- Record how long each square takes to answer, from the moment it's
  highlighted to the moment a guess is submitted.
- Track per-square difficulty (time and accuracy) across the session.
- On stop, show a statistics table summarizing the session.

## Non-goals

- Persisting sessions across page reloads (no localStorage/backend) —
  can be a later iteration.
- Aggregating difficulty trends across multiple sessions.
- Configurable session length/goals (e.g. "50 squares" or "5 minutes").

## Session lifecycle

A **session** is the span between pressing **Start** and pressing
**Stop**.

- **Idle** (initial state / after Stop): board shows no target, answer
  form is disabled, a **Start** button is shown.
- **Running** (after Start): existing drill behavior is active — a
  square is highlighted, the answer form is enabled, timing begins.
  The button reads **Stop**.
- Pressing **Stop** ends the session: the in-flight square attempt (if
  any) is discarded from stats, the drill stops advancing, and the
  statistics table is rendered. Stop is allowed at any time, including
  mid-answer — there is no requirement to submit the current square
  first.

Only one session is tracked at a time; starting a new session discards
the previous session's in-memory data (the table remains visible from
the last stopped session until a new Start is pressed, at which point
it's cleared).

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
      correct: Boolean,
      guess: String,
    },
    // ...
  ],
}
```

`attempts` is the single source of truth; all statistics (overall and
per-square) are derived from it when the session stops rather than
maintained incrementally, keeping the running/stop logic simple.

Per-square stats are computed by grouping `attempts` by `square`:

```js
perSquare[square] = {
  count: Number,
  correctCount: Number,
  accuracy: correctCount / count,
  avgMs: mean(elapsedMs for attempts on this square),
  maxMs: max(elapsedMs for attempts on this square),
}
```

"Difficulty" for ranking purposes is `avgMs` weighted down by accuracy
— a simple sort key is enough:

```
difficultyScore = avgMs / accuracy   // slower AND less accurate ranks worse
```

Squares that never appeared in the session are omitted from the table
rather than shown as zero/blank rows.

## Timing semantics

- The clock for a square starts the instant it is highlighted
  (`pickTarget()` / `highlightTarget()`), not when the user starts
  typing.
- The clock stops the instant the answer form is submitted (matches
  existing correct/wrong flash timing already in `sqname.js`).
- The post-answer `setTimeout` delay before the next square appears
  (350ms/900ms in the current code) is **not** counted toward the next
  square's elapsed time, since the next square isn't shown yet.

## UI changes

### Controls

Replace/augment the existing `#toggles` row with a session control:

- **Start/Stop button** (`#sessionBtn`) — single toggle button,
  replacing the drill's "always running" behavior. Label switches
  between "Start session" and "Stop session".
- While idle, `#answerForm` is disabled and the board shows no target
  square (all squares in normal light/dark colors).
- A small **session timer** (`#sessionTimer`) showing elapsed
  wall-clock time, updated once per second while running, useful as a
  live indicator alongside Streak/Accuracy/Attempts.

The existing "Flip board" and "Reset stats" buttons remain, but
**Reset stats** only clears the running Streak/Accuracy/Attempts
counters shown during play — it does not touch session history.

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

Rendered into a new `#sessionSummary` section, shown after Stop and
hidden while idle/running:

- Header line: total duration (`endedAt - startedAt`), total attempts,
  overall accuracy.
- Table columns: **Square**, **Attempts**, **Accuracy**, **Avg time**,
  **Slowest**.
- Rows sorted worst-first by `difficultyScore` so problem squares are
  immediately visible at the top.
- Row highlighting (`.slow` class) for squares whose `avgMs` exceeds a
  **slow threshold**, an absolute cutoff (not relative to the
  session's average) so it stays meaningful for very short or very
  fast-paced sessions.

```
Session: 3m 42s · 51 attempts · 88% accuracy

 Square │ Attempts │ Accuracy │ Avg time │ Slowest
────────┼──────────┼──────────┼──────────┼─────────
   f7   │    3     │   33%    │  4.1s    │  6.8s
   b2   │    2     │   50%    │  3.6s    │  5.0s
   e4   │    4     │  100%    │  0.9s    │  1.2s
   ...
```

## Implementation notes (sqname.js)

- Wrap the existing module-level `flipped`/`target`/`streak`/etc.
  state with a `session` object (or `null` when idle) plus the
  existing counters, which continue to represent the current
  session's running totals.
- `pickTarget()` records `shownAt = Date.now()` on the current
  attempt-in-progress instead of only setting `target`.
- The `answerForm` submit handler, on producing a result, pushes a
  completed attempt record (`square`, `shownAt`, `answeredAt`,
  `elapsedMs`, `correct`, `guess`) onto `session.attempts` if a
  session is running; if not running (shouldn't happen once the form
  is properly disabled, but guard anyway), ignore the submit.
- `startSession()`: creates a fresh `session`, reads `slowThresholdMs`
  from `#slowThresholdInput`, resets streak/correct/attempt counters,
  enables the form, hides the summary table, calls `buildBoard()` +
  `pickTarget()`.
- `stopSession()`: sets `session.endedAt`, disables the form, clears
  the highlighted target, computes per-square stats from
  `session.attempts`, and renders `#sessionSummary`.
- No changes needed to `squareColor`/`buildBoard`/`highlightTarget`
  geometry logic — session tracking is additive around the existing
  drill loop.

## Decisions

- **Stop mid-answer**: allowed. The currently-highlighted,
  not-yet-answered square is discarded — it is not counted as an
  attempt.
- **Slow threshold**: configurable, default **600ms** (see "Slow
  threshold setting" above), rather than a relative comparison to the
  session average.
- No minimum session length/attempt count is required before showing
  the table — it always renders with whatever data exists, even for a
  single attempt.
