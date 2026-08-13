# Session Tracking — Design

## Problem

Square Namer drills squares continuously with no notion of a practice
session: there's no way to say "here's a block of practice," measure
how long each square takes to answer, or see which squares are
consistently slow or error-prone.

## Goals

- Let the user start a practice session that runs until either they
  stop it manually or they rack up **three misses** — Puzzle
  Rush-style "3 strikes and you're out." A miss is a wrong guess *or*
  answering too slowly.
- Enforce a **per-square time limit**: a configurable number of
  milliseconds (default 1000) after the square is shown. Answering
  after the limit counts as a miss (a "timeout"), same as answering
  wrong — even if the guess would otherwise have been correct.
- Record how long each square takes to answer, from the moment it's
  highlighted to the moment a guess is submitted.
- Track per-square difficulty by timing alone, computed only from
  correct answers within the time limit.
- Show live **right/wrong counts** during the session, colored so
  they're readable at a glance (right in green, wrong in red).
- On session end, show a statistics table: how many squares were
  named correctly, which squares were missed and how (wrong guess vs.
  timeout), and per-square timing. It appears as a separate pop-up,
  not inline with the board, so it doesn't reflow the practice view.
- Distinguish a genuine miss (wrong guess or timeout — counts as a
  strike) from a malformed guess (not a square name at all — doesn't
  count against the user at all).

## Non-goals

- Persisting sessions across page reloads (no localStorage/backend) —
  can be a later iteration.
- Aggregating difficulty trends across multiple sessions.
- Configurable session length/goals (e.g. "50 squares" or "5 minutes").
- Configurable strike limit — "3 strikes" is fixed, matching the
  Puzzle Rush convention this is modeled on.
- An accuracy **percentage**. Right/wrong counts are shown live and in
  the summary, but they're raw counts, not a derived rate.
- A user-configurable slow-answer threshold — it's a fixed constant,
  separate from the (configurable) time limit. The slow threshold only
  flags a square as sluggish in the summary table; the time limit
  actually ends the attempt as a miss.

## Session lifecycle

A **session** is the span from pressing **Start** until it ends,
either because the user racks up **3 misses** (strikes) or because
they press **Stop** manually.

- **Idle** (initial state / after the session ends): board shows no
  target, answer form is disabled, a **Start session** button is
  shown, and the time-limit input is editable.
- **Running** (after Start): a square is highlighted, the answer form
  is enabled, timing begins, and a per-square countdown for the
  configured time limit starts. The button reads **Stop session**.
  Enter submits the guess — there is no separate Check button. The
  time-limit input is disabled for the duration, so a session's data
  is never measured against a limit that changed mid-session.
- **A miss** is either a wrong guess *or* the per-square time limit
  expiring with no valid guess submitted (a "timeout"). Either way:
  the square still gets the existing red flash, and once that flash's
  900ms delay elapses, either the next square appears (fewer than 3
  misses so far) or the session ends (the 3rd miss — "struck out").
- **Ends manually on Stop**: allowed at any time, including
  mid-answer. The in-flight, not-yet-answered square is discarded —
  it isn't counted. The summary renders immediately (no 900ms delay).
- **A malformed guess is not a miss.** A guess that isn't a well-formed
  square name at all (see "Input validation" below) doesn't count as
  a strike and doesn't reset or cancel the time-limit countdown — the
  session keeps running on the same square, clock still ticking.

Only one session is tracked at a time; starting a new session discards
the previous session's in-memory data (the pop-up remains visible from
the last session until a new Start is pressed, at which point it's
hidden and any pending pop-up is cancelled).

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
  misses: [
    {
      square: 'h6',
      guess: 'g5' | null,   // null means it was a timeout, not a wrong guess
      elapsedMs: Number,
    },
    // ...  up to STRIKE_LIMIT (3) entries; the session ends on the 3rd
  ],
}
```

- `attempts` holds only **correct, within-time-limit** answers, in
  order. There's no `correct` field to check; everything in the list
  is correct by construction.
- `misses` holds every strike, in order — both wrong guesses and
  timeouts. `guess` is the (well-formed but incorrect) square name the
  user typed, or `null` if the time limit expired before any valid
  guess was submitted. The session ends once `misses.length` reaches
  `STRIKE_LIMIT` (3); if it's ended manually via Stop, `misses.length`
  may be 0, 1, or 2.
- The live right/wrong counts are simply `attempts.length` and
  `misses.length`.
- A malformed guess is never recorded anywhere — see "Input
  validation".

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

Missed squares are **not** included in `perSquare` / the table rows —
a miss's elapsed time (whether a wrong guess or a timeout) isn't a
meaningful "how long a correct answer takes" data point for that
square. Misses are surfaced separately in the summary header instead.

Squares that never appeared in the session are omitted from the table
rather than shown as zero/blank rows.

## Timing semantics

- The clock for a square starts the instant it is highlighted
  (`pickTarget()`), which is also when the per-square time-limit timer
  (`setTimeout(handleTimeout, timeLimitMs)`) is armed.
- The clock stops the instant the answer form is submitted — which
  also cancels the pending time-limit timer (`clearTimeout(answerTimeout)`),
  so a guess that arrives just under the wire doesn't get overtaken by
  its own deadline.
- If nothing is submitted before `timeLimitMs` elapses, `handleTimeout()`
  fires: this is scored as a miss (a timeout) using
  `Date.now() - targetShownAt` as its `elapsedMs`, exactly as if a
  wrong guess had been submitted at that instant.
- The post-answer `setTimeout` delay before the next square appears
  (350ms on correct, 900ms on a miss) is **not** counted toward the
  next square's elapsed time, since the next square isn't shown yet.
  On the 3rd miss, that same 900ms delay leads to the session ending
  instead of the next square appearing.
- A malformed guess doesn't stop, reset, or extend the clock at all —
  the current square's `shownAt` and pending time-limit timer are
  untouched, so the eventual valid answer's `elapsedMs` still reflects
  the true time since the square lit up, and a slow enough sequence of
  garbage guesses can still time out.

## Input validation

A guess only counts as an answer to the current square — correct or
wrong — if it matches `/^[a-h][1-8]$/`, a well-formed square name.

- A guess that doesn't match (garbage like `zz`, `e10`, or a lone
  letter/digit) is **not** treated as an error: it shows a warning
  message in the feedback line (`.warn` styling, distinct from the
  correct/wrong colors) and is discarded — not scored, not pushed onto
  `session.misses`, and doesn't end the session. The current target
  keeps waiting for a real answer, and its time-limit timer keeps
  running in the background.
- This keeps a strike meaningful: it's earned by naming the wrong
  square or running out of time, not by fat-fingering the input.

## UI changes

### Controls

- **Start/Stop button** (`#sessionBtn`) — single toggle button. Label
  switches between "Start session" and "Stop session".
- **No Check button.** `#answerForm` has exactly one text field
  (`#answerInput`), so pressing Enter submits the form via the
  browser's built-in implicit-submission behavior — a submit button
  isn't required for that to work. The button is removed from the
  markup entirely.
- **No Reset stats button.** The live right/wrong counts are read
  directly from `session.attempts.length` / `session.misses.length`,
  and starting a new session already resets them — there's nothing
  left for a separate reset action to do.
- While idle, `#answerForm` is disabled and the board shows no target
  square (all squares in normal light/dark colors).
- A small **session timer** (`#sessionTimer`) showing elapsed
  wall-clock time, updated once per second while running.
- A **time limit** input (`#timeLimitInput`, milliseconds, default
  1000) sits in the same `#session` control row as the Start/Stop
  button and the timer — labeled "Time limit (ms)" (`#timeLimitLabel`).
  Like the old slow-threshold input, it's editable only while idle and
  disabled for the duration of a running session, so a session's
  timing data is never measured against a limit that changed partway
  through.
- **Live right/wrong counts** (`#scoreCounts`, holding `#statRight` /
  `#statWrong`) sit in that same row, immediately to the left of the
  orientation radios. The right count is styled green
  (`var(--correct)`), the wrong count red (`var(--wrong)`), each with
  a small "right"/"wrong" label underneath, mirroring the old
  `.stats` panel's val/label look but inline in the row instead of a
  separate block below it.
- **Board orientation** is set by two mutually exclusive radio buttons
  (`#orientationWhite` / `#orientationBlack`) in that same row — not a
  single "Flip board" toggle button. Selecting one directly sets which
  color occupies the bottom row.
- Small centered **"White"/"Black" captions** above and below the
  board (`#boardCaptionTop` / `#boardCaptionBottom`) that swap
  whenever orientation changes, so it's always clear which side is
  which.

### Slow threshold

A fixed **`SLOW_THRESHOLD_MS`** constant (500ms), declared at the top
of `sqname.js` — not user-configurable. A square's average answer time
above this value marks it as a trouble square in the summary table.

### Statistics table

Rendered into `#sessionSummary`, a modal card inside a fixed,
full-viewport `#summaryOverlay` backdrop — not part of the board's
normal document flow. It does not appear the instant the session
ends: it pops up **`SUMMARY_POPUP_DELAY_MS` (500ms) after** `endSession()`
runs, so the board/feedback state from the final square has a moment
to register before the view is covered. The card is dismissed by its
**Close** button or by clicking the backdrop outside it; both just
hide the overlay, they don't affect session data.

- Header line: total duration, right count, wrong count, and how it
  ended (`struck out` once 3 misses accumulate, otherwise
  `stopped manually`) — e.g.
  `0m 42s · 12 right · 3 wrong · struck out`. If there were any
  misses, a second line lists each one via `describeMiss()` — e.g.
  `h6 (typed g5), b3 (timed out), e4 (typed d4)`.
- Table columns: **Square**, **Times shown**, **Avg time**,
  **Slowest** — computed from `session.attempts` only (correct,
  within-time-limit answers). No Accuracy column, no miss rows.
- Rows sorted worst-first by `avgMs` (slowest average first).
- Row highlighting (`.slow` class) for squares whose `avgMs` exceeds
  `SLOW_THRESHOLD_MS`.
- Starting a new session before the 500ms popup timer has fired (e.g.
  Stop → immediately Start again) cancels the pending pop-up — it must
  not appear mid-way through the next session.

```
Session: 0m 42s · 12 right · 3 wrong · struck out
h6 (typed g5), b3 (timed out), e4 (typed d4)

 Square │ Times shown │ Avg time │ Slowest
────────┼─────────────┼──────────┼─────────
   f7   │      2      │  1.4s    │  1.8s
   b2   │      1      │  0.9s    │  0.9s
   a1   │      3      │  0.5s    │  0.7s
   ...
```

## Implementation notes (sqname.js)

- `SLOW_THRESHOLD_MS`, `SQUARE_NAME_RE`, `SUMMARY_POPUP_DELAY_MS`,
  `DEFAULT_TIME_LIMIT_MS` (1000), and `STRIKE_LIMIT` (3) are declared
  as constants at the top of the file. Module-level `timeLimitMs`
  (initialized to `DEFAULT_TIME_LIMIT_MS`) holds the active session's
  configured limit; `answerTimeout` holds the pending per-square
  timeout id.
- No `checkBtn`, `resetBtn`, or `flipBtn` elements — the form has no
  submit button, there's no reset action, and orientation is set by
  the `#orientationWhite`/`#orientationBlack` radios instead of a
  toggle button.
- Module-level `streak`/`correctCount`/`attemptCount` state is
  replaced by the `session` object; the live counts read
  `session.attempts.length` / `session.misses.length` directly rather
  than separately maintained variables (`updateLiveCounts()`).
- `pickTarget()` records `shownAt = Date.now()` when the target is
  set, then arms the time-limit timer:
  `answerTimeout = setTimeout(handleTimeout, timeLimitMs)` (after a
  defensive `clearTimeout(answerTimeout)`).
- `handleTimeout()`: guarded by
  `if (!session || session.endedAt || !target) return;`. Computes
  `elapsedMs` from `targetShownAt`, sets the "Too slow" feedback, and
  calls `registerMiss(target, null, elapsedMs)` — `guess: null` is
  what distinguishes a timeout from a wrong guess.
- `registerMiss(square, guess, elapsedMs)` — shared by both the
  wrong-guess and timeout paths: pushes onto `session.misses`, flashes
  red, updates the live counts, clears the input, then after 900ms
  either calls `endSession()` (if `misses.length >= STRIKE_LIMIT`) or
  `pickTarget()` (otherwise).
- The `answerForm` submit handler:
  - First checks the trimmed/lowercased guess against
    `SQUARE_NAME_RE`. If it doesn't match, shows the warning feedback
    and returns immediately — no session state changes, no target
    change, no timer touched.
  - Otherwise calls `clearTimeout(answerTimeout)` — a valid guess (hit
    or miss) always defuses that square's pending timeout.
  - On a **correct** guess: pushes `{square, shownAt, answeredAt,
    elapsedMs}` onto `session.attempts`, updates the live counts,
    flashes green, and schedules `pickTarget()` after 350ms.
  - On a **wrong** guess: sets the "Wrong" feedback, then calls
    `registerMiss(target, guess, elapsedMs)`.
- `startSession()`: reads `timeLimitMs` from `#timeLimitInput`
  (`parseInt(...) || DEFAULT_TIME_LIMIT_MS`) and disables that input,
  creates a fresh `session` (`attempts: []`, `misses: []`), resets the
  live counts, enables the answer form, hides the summary overlay,
  calls `buildBoard()` + `pickTarget()`.
- `endSession()` (used by the Stop button, the 3rd-miss path via
  `registerMiss()`, and nowhere else): cancels any pending
  `answerTimeout`, sets `session.endedAt`, disables the form,
  re-enables `#timeLimitInput`, clears the highlighted target,
  computes per-square stats via `renderSummary()` (which only
  populates `#summaryHeader`/`#summaryBody` — it does not toggle
  visibility), then schedules `summaryOverlayEl.hidden = false` via
  `setTimeout(..., SUMMARY_POPUP_DELAY_MS)`, storing the timeout id in
  `summaryPopupTimeout`. Guarded by
  `if (!session || session.endedAt) return;` so it's safe to call
  twice (e.g. Stop clicked during the post-miss delay).
- `startSession()` calls `clearTimeout(summaryPopupTimeout)` and hides
  `#summaryOverlay` up front, so a popup queued by a just-ended session
  can never appear after a new one has started.
- `describeMiss(miss)` renders one `session.misses` entry as
  `"<square> (typed <guess>)"` or `"<square> (timed out)"` depending
  on whether `guess` is set; `renderSummary()` joins these for the
  header's second line.
- The Close button and clicks on the overlay backdrop (but not on the
  card itself — checked via `e.target === summaryOverlayEl`) both just
  set `summaryOverlayEl.hidden = true`.
- `setOrientation(newFlipped)` (called from the radios' `change`
  handlers): updates `flipped`, rebuilds the board (which also updates
  the White/Black captions via `updateBoardCaptions()`), and
  re-highlights the current target if one is showing.
- No changes needed to `squareColor`/`highlightTarget` geometry logic
  — session tracking, timing, and orientation are additive around the
  existing drill loop.

## Decisions

- **Stop mid-answer**: allowed. The currently-highlighted,
  not-yet-answered square is discarded — it is not counted as an
  attempt.
- **Slow threshold**: a fixed constant (`SLOW_THRESHOLD_MS = 500`),
  not user-configurable.
- No minimum session length/attempt count is required before showing
  the table — it always renders with whatever data exists, even for a
  single attempt.
- **No Check button**: Enter-to-submit relies on the browser's
  implicit form submission for a single-field form; no button is
  needed for that behavior.
- **No Reset stats button**: removed — nothing to reset once the live
  counter is derived directly from session data.
- **No Flip-board toggle**: replaced by mutually exclusive White/Black
  orientation radios, which set state directly instead of toggling it.
- **3 strikes and you're out**: the session ends on the 3rd miss, not
  the 1st — a couple of mistakes don't end the drill, but a pattern of
  them does. The strike limit itself is fixed at 3, not configurable.
- **A timeout counts the same as a wrong guess**: no partial credit or
  separate "too slow" bucket — both are a strike, both flash red, both
  advance the same 900ms delay logic. They're only distinguished in
  the summary (`guess: null` → "(timed out)").
- **Time limit is configurable, strike limit is not**: the time limit
  is a difficulty knob the user tunes per session; "3 strikes" is the
  fixed rule of the game, matching the Puzzle Rush convention this is
  modeled on.
- **Time limit input disabled mid-session**: same rationale as the
  old slow-threshold input — changing the limit partway through would
  make a session's own timing data inconsistent with itself.
- **Malformed guesses are warned, not scored**: a guess that isn't a
  real square name at all doesn't count as a strike and doesn't touch
  the time-limit clock — only a guess that names an actual (wrong)
  square, or the clock simply running out, does.
- **Right/wrong shown as raw counts, not a percentage**: mirrors the
  "no accuracy percentage" stance from earlier iterations — the counts
  are informative on their own without being reduced to a rate.
- **Summary is a pop-up, not inline**: it lives in a fixed overlay
  separate from the board, appears 500ms after the session actually
  ends (not instantly), and is closed explicitly (Close button or
  backdrop click) rather than by starting a new session — though
  starting a new session does hide it and cancel any pending pop-up.
