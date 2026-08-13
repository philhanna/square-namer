# Square Namer — Design

## Problem

Square Namer drills squares continuously with no notion of a practice
session: there's no way to say "here's a block of practice," measure
how long each square takes to answer, or see which squares are
consistently slow or error-prone.

## Goals

- Let the user explicitly start and stop a timed practice session.
- Record how long each square takes to answer, from the moment it's
  highlighted to the moment a guess is submitted.
- Track per-square difficulty (time and accuracy) across the session.
- On stop, show a statistics table summarizing the session.
- Distinguish a genuine wrong answer (named the wrong square) from a
  malformed guess (not a square name at all) — only the former counts
  against accuracy.

## Non-goals

- Persisting sessions across page reloads (no localStorage/backend).
- Aggregating difficulty trends across multiple sessions.
- Configurable session length/goals (e.g. "50 squares" or "5 minutes").
- A user-configurable slow-answer threshold — it's a fixed constant.

## Session lifecycle

A **session** is the span between pressing **Start** and pressing
**Stop**.

- **Idle** (initial state / after Stop): board shows no target, answer
  form is disabled, a **Start session** button is shown.
- **Running** (after Start): a square is highlighted, the answer form
  is enabled, timing begins. The button reads **Stop session**. Enter
  submits the guess — there is no separate Check button. A wrong
  answer resets the streak but does **not** end the session; the drill
  advances to a new square exactly as a correct answer does.
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
maintained incrementally, keeping the running/stop logic simple. Only
well-formed square-name guesses become attempts — a malformed guess
(see "Input validation" below) is never added.

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
  (350ms correct / 900ms wrong) is **not** counted toward the next
  square's elapsed time, since the next square isn't shown yet.
- A malformed guess doesn't stop or reset the clock — the current
  square's `shownAt` is untouched, so the eventual valid answer's
  `elapsedMs` still reflects the true time since the square lit up.

## Input validation

A guess is only accepted as an answer to the current square if it
matches `/^[a-h][1-8]$/` — a well-formed square name, whether or not
it's the *right* one.

- A guess that doesn't match (garbage like `zz`, `e10`, or a lone
  letter/digit) is **not** treated as an error: it shows a warning
  message in the feedback line (`.warn` styling, distinct from the
  correct/wrong colors) and is discarded — not scored, not added to
  `session.attempts`, and the current target keeps waiting for a real
  answer.
- This keeps accuracy meaningful: it measures "did you name the wrong
  square," not "did you fat-finger the input."

## UI changes

### Controls

- **Start/Stop button** (`#sessionBtn`) — single toggle button,
  replacing the drill's "always running" behavior. Label switches
  between "Start session" and "Stop session".
- **No Check button.** `#answerForm` has exactly one text field
  (`#answerInput`), so pressing Enter submits the form via the
  browser's built-in implicit-submission behavior — a submit button
  isn't required for that to work.
- **No Reset stats button.** Starting a new session already resets the
  running counters; a separate mid-session reset serves no purpose.
- While idle, `#answerForm` is disabled and the board shows no target
  square (all squares in normal light/dark colors).
- A small **session timer** (`#sessionTimer`) showing elapsed
  wall-clock time, updated once per second while running, alongside
  Streak/Accuracy/Attempts.
- **Board orientation** is set by two mutually exclusive radio buttons
  (`#orientationWhite` / `#orientationBlack`) in the `#session` control
  row, replacing the old single "Flip board" toggle button. Selecting
  one directly sets which color occupies the bottom row — no state to
  infer from a button's current label.
- Small centered **"White"/"Black" captions** above and below the
  board (`#boardCaptionTop` / `#boardCaptionBottom`) that swap
  whenever orientation changes, so it's always clear which side is
  which regardless of which radio is currently selected.

### Slow threshold

A fixed **`SLOW_THRESHOLD_MS`** constant (500ms), declared at the top
of `sqname.js` — not user-configurable. A square's average answer time
above this value marks it as a trouble square in the summary table.

### Statistics table

Rendered into a new `#sessionSummary` section, shown after Stop and
hidden while idle/running:

- Header line: total duration (`endedAt - startedAt`), total attempts,
  overall accuracy.
- Table columns: **Square**, **Attempts**, **Accuracy**, **Avg time**,
  **Slowest**.
- Rows sorted worst-first by `difficultyScore` so problem squares are
  immediately visible at the top.
- Row highlighting (`.slow` class) for squares whose `avgMs` exceeds
  `SLOW_THRESHOLD_MS`, an absolute cutoff (not relative to the
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

- `SLOW_THRESHOLD_MS` and `SQUARE_NAME_RE` are declared as constants
  at the top of the file.
- The module-level `flipped`/`target`/`streak`/etc. state plus a
  `session` object (or `null` when idle) together represent the
  current session's running totals.
- `pickTarget()` records `shownAt = Date.now()` on the current
  attempt-in-progress instead of only setting `target`.
- The `answerForm` submit handler:
  - First checks the trimmed/lowercased guess against
    `SQUARE_NAME_RE`; if it doesn't match, shows the warning feedback
    and returns without touching session/streak state or the target.
  - Otherwise pushes a completed attempt record (`square`, `shownAt`,
    `answeredAt`, `elapsedMs`, `correct`, `guess`) onto
    `session.attempts` if a session is running, updates
    streak/accuracy counters, flashes the result, and schedules
    `pickTarget()` after 350ms (correct) or 900ms (wrong) — the drill
    always continues to a new square while the session is running.
- `startSession()`: creates a fresh `session`, resets streak/correct/
  attempt counters, enables the form, hides the summary table, calls
  `buildBoard()` + `pickTarget()`.
- `stopSession()`: sets `session.endedAt`, disables the form, clears
  the highlighted target, computes per-square stats from
  `session.attempts`, and renders `#sessionSummary`.
- `setOrientation(newFlipped)` (called from the radios' `change`
  handlers): updates `flipped`, rebuilds the board (which also updates
  the White/Black captions via `updateBoardCaptions()`), and
  re-highlights the current target if one is showing.
- No changes needed to `squareColor`/`highlightTarget` geometry logic
  — session tracking and orientation are additive around the existing
  drill loop.

## Decisions

- **Stop mid-answer**: allowed. The currently-highlighted,
  not-yet-answered square is discarded — it is not counted as an
  attempt.
- **Wrong answers don't end the session**: only Stop does. A miss
  resets the streak but the drill keeps going.
- **Slow threshold**: a fixed constant (`SLOW_THRESHOLD_MS = 500`),
  not user-configurable.
- No minimum session length/attempt count is required before showing
  the table — it always renders with whatever data exists, even for a
  single attempt.
- **No Check button**: Enter-to-submit relies on the browser's
  implicit form submission for a single-field form; no button is
  needed for that behavior.
- **No Reset stats button**: removed — starting a new session already
  clears the counters.
- **No Flip-board toggle**: replaced by mutually exclusive White/Black
  orientation radios, which set state directly instead of toggling it.
- **Malformed guesses are warned, not scored**: a guess that isn't a
  real square name at all doesn't count against accuracy and doesn't
  advance the drill — only a guess that names an actual (wrong) square
  does.
