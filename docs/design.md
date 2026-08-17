# Session Tracking — Design

## Problem

Chess Square Namer drills squares continuously with no notion of a practice
session: there's no way to say "here's a block of practice," measure
how long each square takes to answer, or see which squares are
consistently slow or error-prone.

## Goals

- Let the user start a practice session that runs until either they
  stop it manually or they rack up **three misses** — Puzzle
  Rush-style "3 strikes and you're out." A miss is a wrong guess *or*
  answering too slowly.
- Enforce a **per-square time limit**: a configurable number of
  milliseconds (default 5000) after the square is shown. Answering
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
  can be a later iteration. *(Later addressed by
  [session-tracker.md](session-tracker.md)'s `localStorage`-backed
  session log — this doc's own `session` object is still purely
  in-memory and still discarded on reload/new-session; the log is a
  separate, append-only record built from it at `endSession()` time.)*
- Aggregating difficulty trends across multiple sessions.
- Configurable session length/goals (e.g. "50 squares" or "5 minutes").
- Configurable strike limit — "3 strikes" is fixed, matching the
  Puzzle Rush convention this is modeled on.
- An accuracy **percentage**. Right/wrong counts are shown live and in
  the summary, but they're raw counts, not a derived rate. *(Revised
  later, for the summary only — see "Decisions" below and the Accuracy
  row under "Statistics table"; the live `#statRight`/`#statWrong`
  counters stay raw counts.)*
- A user-configurable slow-answer threshold — it's a fixed constant,
  separate from the (configurable) time limit. The slow threshold only
  flags a square as sluggish in the summary table; the time limit
  actually ends the attempt as a miss.

## Session lifecycle

A **session** is the span from when the pre-session countdown finishes
until it ends, either because the user racks up **3 misses** (strikes)
or because they press **Stop** manually.

- **Idle** (initial state / after the session ends): board shows no
  target, `#answerInput` is enabled and **focused** (both on page load
  and again right after a session ends), a **Start** button is shown,
  and the time-limit input is editable. Starting isn't limited to
  clicking the button — pressing **Enter in `#answerInput`** does the
  same thing, unconditionally, regardless of whatever (if anything)
  happens to be typed in it at the time.
- **Counting down** (after Start is pressed, before the session
  actually begins): a big **"3 … 2 … 1"** countdown (`#countdownOverlay`,
  Puzzle Rush-style) is shown centered over the board, one second per
  number. `#sessionBtn`, `#timeLimitInput`, and `#answerInput` are all
  disabled for the duration — clicking/pressing Enter on Start can't
  be done twice, the limit can't change mid-countdown, and there's
  nothing to type an answer to yet. Nothing session-related exists
  yet: no `session` object, no target square, no per-square timer, no
  session timer. The board is rebuilt to a plain, no-target state (in
  the current orientation) so the countdown has a clean board to sit
  over.
- **Running** (once the countdown finishes): a square is highlighted,
  the answer form is enabled, timing begins, and a per-square countdown
  for the configured time limit starts — this is the first moment any
  timer actually starts. The button reads **Stop**. Enter submits the
  guess — there is no separate Check button. The time-limit input stays
  disabled for the duration, so a session's data is never measured
  against a limit that changed mid-session.
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

Everything above the board is now a single compact row plus a thin
status line, both capped to the board's own width (`min(92vw, 420px)`)
so neither ever runs wider than the board itself. Settings that apply
to the session as a whole (time limit, orientation) were pulled out
into a separate popup to cut clutter from the main view — see
"Settings popup" below.

**`#topRow`, directly above the board** — the moment-to-moment
answering controls, in this order: `#sessionBtn`, `#pauseBtn`,
`#answerForm`, `#sessionTimer`, `#voiceBtn`, `#settingsBtn`.

- **Start/Stop button** (`#sessionBtn`) — single toggle button. Label
  switches between "Start" and "Stop". Sits on the left end of the row.
- **Pause/Resume button** (`#pauseBtn`) — an icon toggle right next to
  Start/Stop, disabled whenever no session is running (idle,
  mid-countdown, or after the session ends). See "Pause/Resume" below.
- `#answerForm`, containing only `#answerInput`, given `flex: 1` so it
  fills the remaining width and sits visually centered in the row.
- A small **session timer** (`#sessionTimer`) showing elapsed
  wall-clock time, updated once per second while running. Placed after
  `#answerForm` in the markup (not right after the button) so the
  flexible answer field lands in the middle of the row rather than off
  to one side.
- A **voice input button** (`#voiceBtn`), feature-detected hidden by
  default — full design in [voice-input.md](../voice-input.md); it's
  listed here only for row layout, not duplicated.
- A **⚙ settings button** (`#settingsBtn`) on the far right end of the
  row, opening the settings popup. Styled as a neutral square icon
  button (dark gray, not the primary yellow), distinct from the
  Start/Stop button.
- **No Check button.** `#answerForm` has exactly one text field, so
  pressing Enter submits the form via the browser's built-in
  implicit-submission behavior — a submit button isn't required for
  that to work. The button is removed from the markup entirely. This
  same implicit submission is what makes Enter-to-start work while
  idle — the form's `submit` handler branches on session state (see
  Implementation notes) rather than requiring a separate keyboard
  listener.
- `#answerInput` starts out enabled and focused (not disabled) so
  Enter-to-start works immediately on page load; it's only disabled
  during the countdown, and goes back to enabled+focused the instant
  a session ends. The board itself still shows no target square while
  idle (all squares in normal light/dark colors) — only the input's
  enabled state changed, not the board's.

**`#statusRow`, between `#topRow` and the board** — a thin line with
`justify-content: space-between`:

- `#feedback` on the left (`flex: 1`), unchanged in behavior — still
  just shows "Correct — e4" / "Wrong — …" / the malformed-guess
  warning.
- **Live right/wrong counts** (`#scoreCounts`, holding `#statRight` /
  `#statWrong`) on the right, `flex: 0 0 auto` so they stay compact.
  The right count is styled green (`var(--correct)`), the wrong count
  red (`var(--wrong)`), each with a small "right"/"wrong" label
  underneath.
- **No Reset stats button.** The live right/wrong counts are read
  directly from `session.attempts.length` / `session.misses.length`,
  and starting a new session already resets them — there's nothing
  left for a separate reset action to do.

Small centered **"White"/"Black" captions** above and below the board
(`#boardCaptionTop` / `#boardCaptionBottom`) swap whenever orientation
changes, so it's always clear which side is which even though the
orientation control itself now lives inside the settings popup, out of
the main view.

### Coordinate labels

A thin margin frames the board itself with rank numbers (1-8) down the
left edge and file letters (a-h) along the bottom edge — like a
standard chess board's own coordinate border, not a separate caption.
`#boardFrame` is a CSS grid (`1.3em 1fr` columns × `1fr 1.3em` rows)
wrapping `#boardStage`; `#rankLabels` and `#fileLabels` occupy the
label column/row (the bottom-left corner cell is left empty), each a
flex row/column of 8 equal-sized `<span>`s so they line up cell-for-
cell with the board's own 8×8 grid. Padded by `3px` on the label sides
to match `#board`'s own `3px` border, so a label's center lines up
with its square's center exactly, not the outer edge of `#boardStage`.

The labels are regenerated by `updateCoordinateLabels(ranks,
fileOrder)`, called from `buildBoard()` with the *same* `ranks`/
`fileOrder` arrays already computed there for placing the squares —
not a second, potentially-divergent orientation calculation. So the
labels are guaranteed to always match what's actually on the board,
including immediately on orientation change (`setOrientation()` already
calls `buildBoard()`, which now updates labels as a side effect, same
as it already did for the captions). `buildBoard()` also stashes those
same arrays in module-level `lastRanks`/`lastFileOrder`, purely so the
visibility toggle below can re-render the labels without needing to
rebuild the board (and without recomputing orientation logic itself).

**Visibility is configurable** via a checkbox in the settings popup
(`#showCoordinates`, checked by default). `updateCoordinateLabels()`
checks `showCoordinatesInput.checked`: when on, it populates
`#rankLabels`/`#fileLabels` as before; when off, it sets both to empty
`innerHTML`, leaving `#boardFrame`'s grid tracks (and thus the overall
board size) unchanged — the label columns/rows stay reserved as blank
space rather than the board resizing to fill them. Toggling the
checkbox calls `updateCoordinateLabels(lastRanks, lastFileOrder)`
directly — **not** `buildBoard()`, which would wipe `.target`/
`.flash-correct`/`.flash-wrong` classes on the actual squares
(`boardEl.innerHTML = ''` at the top of `buildBoard()`) and disrupt a
running session's highlighted square. This mirrors why orientation
changes call `setOrientation()` → `buildBoard()` and then explicitly
re-highlight the target afterward; the coordinate toggle sidesteps the
whole issue by never touching `#board` at all.

### Settings popup

`#settingsOverlay` (fixed, full-viewport backdrop, `z-index: 100`) and
its inner `#settingsPanel` card follow the exact same pattern as the
session-summary popup — same backdrop dimming, same `summaryPopIn`
scale/fade-in animation, opened/closed the same way (button + backdrop
click) — but narrower (`min(92vw, 280px)` vs. 420px) since it holds far
less content, and it's opened by `#settingsBtn` rather than appearing
automatically. It contains, stacked vertically for compactness:

- **Board orientation** (first in the panel), under a small "BOARD
  ORIENTATION" caption, set by the same two mutually exclusive radio
  buttons (`#orientationWhite` / `#orientationBlack`) as before — not a
  single "Flip board" toggle button. The two options sit in one
  horizontal row (`.orientationOptions`, a `flex-direction: row` wrapper
  around just the two `<label>`s, siblings of the caption rather than
  stacked under it) rather than one per line — there are only two
  mutually exclusive choices, so a row reads faster than a column and
  costs less vertical space. Selecting one directly sets which color
  occupies the bottom row; the popup doesn't need to be closed for this
  to take effect, and doesn't auto-close when you do it.
- The **time limit** input (`#timeLimitInput`, milliseconds, default
  1000), labeled "Per-square time limit (ms)" (`#timeLimitLabel`). Same
  element, same behavior as before the popup existed — still editable
  only while idle and disabled for the duration of a running session —
  just relocated. `#timeLimitLabel`/`#timeLimitInput` are restyled
  (`#settingsPanel #timeLimitLabel { flex-direction: column; }`, full-
  width input) for a vertical popup instead of the old inline row.
- A **"Show rank/file labels"** checkbox (`#showCoordinates`, checked
  by default), toggling the coordinate border described above. Same
  immediate-effect, no-close-needed behavior as the orientation radios.
- A **Close** button (`#settingsCloseBtn`), full-width.

Opening/closing the settings popup doesn't pause or otherwise interact
with a running session or an in-progress countdown — it's purely a
view on top of `#timeLimitInput`/the orientation radios/the coordinate
checkbox, which already know how to reflect and enforce their own
idle/running-disabled state (or, for the checkbox, apply instantly
without touching session state at all) regardless of which container
they're rendered inside.

### Pre-session countdown

`#board` is wrapped in `#boardStage`, a `position: relative` container
sized to fill the `board` grid area of `#boardFrame` (see "Coordinate
labels" above) — `width: 100%; height: 100%`, with `#board` itself
also `100%`/`100%` inside that. This gives the countdown a positioning
context that covers precisely the checkerboard, not the coordinate
labels or the whole page.

`#countdownOverlay` is an absolutely-positioned (`inset: 0`) sibling of
`#board` inside `#boardStage`: a big (`9rem`), bold, white number
centered over a translucent dark backdrop, so it reads clearly
regardless of the board's own colors. Each tick replaces its content
with a fresh `<span class="tick">` element (not just new text) so the
`countdownTick` scale/fade-in CSS animation restarts every second
instead of only playing once.

The countdown itself is 3 steps (`COUNTDOWN_START = 3`) at
`COUNTDOWN_STEP_MS = 1000` each — "3", "2", "1", each shown for a full
second. After "1" is hidden, there's a further
**`POST_COUNTDOWN_DELAY_MS` (350ms)** pause on the plain board before
`startSession()` runs — the overlay disappearing and a target square
lighting up at the exact same instant felt disorienting (the eye has
to jump from "center of the board" to wherever the target turns out to
be, with no beat to reorient), even though the per-square timer itself
was correctly getting the full configured limit. That pause is a UX
fix, not a timing fix: it doesn't shorten the first square's own time
limit, it just delays when that limit starts counting.

### Pause/Resume

`#pauseBtn` freezes every session timer — the per-square timeout and the
session clock — without discarding any in-progress state, so a break
mid-drill can't silently burn down the current square's remaining time
or count paused wall-clock time as elapsed/answer time.

- Timeouts that need to survive a pause (the per-square deadline, the
  post-answer/post-miss delays, the summary pop-up delay) are created via
  `pausableSetTimeout(callback, delayMs)` instead of the raw
  `setTimeout`, and tracked in a module-level `activePausableTimeouts`
  set. `pauseAllTimeouts()` clears each one's underlying `setTimeout` and
  records how much delay was left (`remaining`); `resumeAllTimeouts()`
  reschedules each with that leftover delay.
- `pauseSession()`: guarded by `if (!session || session.endedAt ||
  paused) return;`. Records `pauseStartedAt`, stops the session-clock
  interval, calls `pauseAllTimeouts()`, disables `#answerInput`, and
  swaps `#pauseBtn`'s icon/label to a Resume state (`.paused` class).
- `resumeSession()`: shifts `session.startedAt` and `targetShownAt`
  forward by the paused duration (`Date.now() - pauseStartedAt`) — this
  is what keeps paused time out of both the session timer and the
  current square's `elapsedMs`, rather than tracking pause spans as a
  separate field. Then calls `resumeAllTimeouts()`, restarts the
  session-clock interval, re-enables `#answerInput`, and swaps the
  button back to its Pause state.
- `endSession()` also resolves an in-progress pause first (folding the
  paused duration into `session.startedAt` the same way `resumeSession()`
  does) so a session stopped while paused still reports accurate
  duration/timing, and resets the button's visual state.
- `#pauseBtn` is disabled whenever no session is running (idle,
  mid-countdown, or after the session ends) — the same `disabled`-gating
  pattern used elsewhere (e.g. `#timeLimitInput` during a session).
- Voice can also trigger pause/resume by saying "pause"/"resume" — see
  [voice-input.md](../voice-input.md), which reuses `pauseBtn.click()`
  rather than calling `pauseSession()`/`resumeSession()` directly.

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

- Header line (`#summaryHeader`): total duration and how it ended
  (`struck out` once 3 misses accumulate, otherwise `stopped
  manually`) — e.g. `0m 42s · struck out`. Right/wrong counts are not
  repeated here — they're already the live `#statRight`/`#statWrong`
  counters the player watched during the session, and the Accuracy row
  below folds them into one number. If there were any misses, a second
  line lists each one via `describeMiss()` — e.g. `h6 (typed g5), b3
  (timed out), e4 (typed d4)`.
- **Summary stats** (`#summaryStats`), a tabular label/value block
  between the header and the table — a CSS grid
  (`grid-template-columns: max-content 1fr`), one `<div class="statLabel">`
  + `<div class="statValue">` pair per row via a small `statRow(label,
  value)` helper, so every value starts at the same x position
  regardless of label length:
  - **Accuracy** (always shown, first row): `<correct> of <total>
    (<pct>%)` — e.g. `12 of 15 (80%)`, where `total =
    attempts.length + misses.length` and `pct` is that ratio rounded to
    a whole percent. Shows `—` instead of `0 of 0 (NaN%)` if literally
    nothing was answered or missed (Stop clicked the instant a session
    starts, before the first square is even attempted). This is the one
    place in the UI that shows an accuracy percentage — the live
    right/wrong counts during play (see "Live right/wrong counts"
    above) remain raw counts by design; a post-session summary stat is
    a different context than a live in-the-moment readout, so showing a
    computed rate here doesn't conflict with that. The `<n> of <m>`
    detail lives on this row rather than in the header, replacing the
    separate right/wrong counts the header used to show.
  - The remaining three rows only appear if `rows.length` (see the
    table below) is non-zero — no correct answers means nothing to
    compute an average/most/least-difficult from:
    - **Average time**: the mean of `row.avgMs` **across distinct
      squares** (`rows.reduce(...) / rows.length`), not a grand mean
      weighted by how many times each square happened to reappear. A
      square answered once and a square answered five times count
      equally toward this average.
    - **Most difficult**: the first 3 entries of a descending copy
      (`[...rows].sort((a, b) => b.avgMs - a.avgMs)`) — the 3 squares
      with the highest `avgMs`.
    - **Least difficult**: the first 3 entries of a separate ascending
      copy (`[...rows].sort((a, b) => a.avgMs - b.avgMs)`) — the 3
      squares with the lowest `avgMs`. Both are their own freshly
      sorted copies of `rows` rather than one being derived from the
      other (e.g. `rows.slice(-3).reverse()`), so neither is silently
      dependent on `rows`'s own order — which, since the table became
      sortable by any column, is just insertion order and not
      meaningfully sorted at all.
    - Both lists are rendered via `formatSquareList(rows)` as a plain
      comma-separated list of square names — no per-square timing in
      this line, since the table immediately below already shows each
      square's own avg time. With fewer than 6 distinct squares in the
      session, the two lists can and will overlap (e.g. a square
      appearing in both "most" and "least" difficult with only 5
      total) — not deduplicated, since with a normal-length session
      this essentially never happens and isn't worth the complexity.
- Table columns: **Square**, **Times shown**, **Avg time**,
  **Slowest** — computed from `session.attempts` only (correct,
  within-time-limit answers). No Accuracy column here (that's the
  `#summaryStats` row above, not a per-square breakdown), no miss rows.
- **Sortable by any column**: each `<th>` carries a `data-sort` key
  (`square`/`count`/`avgMs`/`maxMs`); clicking one sorts `summaryRows`
  by that key via `renderSummaryRows()`, and clicking the
  already-active column again flips direction instead of re-sorting by
  something else. Module-level `summarySortKey`/`summarySortDir` persist
  across re-renders within a session (e.g. re-sorting after a session
  ends still reflects whatever was last clicked). Defaults to `avgMs`
  descending (slowest first) on a fresh page load — switching to a new
  column defaults to descending too, except `square`, which defaults to
  ascending (a-h reads naturally that way). The active column/direction
  is shown via `.sort-asc`/`.sort-desc` classes on its `<th>`.
- Row highlighting (`.slow` class) for squares whose `avgMs` exceeds
  `SLOW_THRESHOLD_MS`, independent of sort order.
- Starting a new session before the 500ms popup timer has fired (e.g.
  Stop → immediately Start again) cancels the pending pop-up — it must
  not appear mid-way through the next session.

```
Session: 0m 42s · struck out
h6 (typed g5), b3 (timed out), e4 (typed d4)

Accuracy         12 of 15 (80%)
Average time     0.9s
Most difficult   f7, b2, a1
Least difficult  a1, b2, f7

 Square │ Times shown │ Avg time │ Slowest
────────┼─────────────┼──────────┼─────────
   f7   │      2      │  1.4s    │  1.8s
   b2   │      1      │  0.9s    │  0.9s
   a1   │      3      │  0.5s    │  0.7s
   ...
```

## Implementation notes (sqname.js)

- `SLOW_THRESHOLD_MS`, `SQUARE_NAME_RE`, `SUMMARY_POPUP_DELAY_MS`,
  `DEFAULT_TIME_LIMIT_MS` (1000), `STRIKE_LIMIT` (3), `COUNTDOWN_START`
  (3), `COUNTDOWN_STEP_MS` (1000), and `POST_COUNTDOWN_DELAY_MS` (350)
  are declared as constants at the
  top of the file. Module-level `timeLimitMs` (initialized to
  `DEFAULT_TIME_LIMIT_MS`) holds the active session's configured
  limit; `answerTimeout` holds the pending per-square timeout id.
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
  - First checks `if (!session || session.endedAt)`: if idle, calls
    `beginCountdown()` and returns — this is what makes Enter in
    `#answerInput` behave like clicking Start while idle, reusing the
    browser's own implicit form-submission-on-Enter rather than a
    separate keyboard listener. No guess-parsing happens in this case;
    whatever (if anything) is in the field is irrelevant.
  - Otherwise checks the trimmed/lowercased guess against
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
- The Start click handler now runs `beginCountdown()`, not
  `startSession()` directly:
  - `beginCountdown()`: reads `timeLimitMs` from `#timeLimitInput`
    (`parseInt(...) || DEFAULT_TIME_LIMIT_MS`) and disables that
    input, disables `#sessionBtn` (so it can't be clicked again mid-
    countdown) and `#answerInput` (clearing its value too, so any
    stray idle-typed text doesn't carry into the session), clears
    leftover feedback/summary state from any prior session, calls
    `buildBoard()` for a clean no-target board, then starts
    `runCountdownStep(COUNTDOWN_START)`. Nothing here creates a
    `session` object or touches any timer.
  - `runCountdownStep(n)`: shows `n` in `#countdownOverlay` (as a
    fresh `<span class="tick">` so the CSS animation replays), waits
    `COUNTDOWN_STEP_MS`, then either recurses with `n - 1` (if
    `n > 1`) or hides the overlay and waits a further
    `POST_COUNTDOWN_DELAY_MS` before re-enabling `#sessionBtn` and
    calling `startSession()` — this nested delay, not the
    `COUNTDOWN_STEP_MS` wait itself, is what gives the eye a beat on
    the plain board before the first target appears. This is the only
    path into `startSession()`.
  - `startSession()`: creates a fresh `session` (`attempts: []`,
    `misses: []`), resets the live counts, enables the answer form,
    sets the button to "Stop", and only *here* does anything
    time-related actually start: `pickTarget()` (which arms the
    per-square timeout) and `startTimer()` (the session clock).
- `endSession()` (used by the Stop button, the 3rd-miss path via
  `registerMiss()`, and nowhere else): cancels any pending
  `answerTimeout`, sets `session.endedAt`, re-enables
  `#timeLimitInput`, clears the highlighted target, then clears and
  **re-focuses** `#answerInput` (it's back to idle behavior: enabled,
  ready for another Enter-to-start) — it does *not* disable the input,
  unlike every other idle-transition in earlier iterations. Then
  computes per-square stats via `renderSummary()` (which only
  populates `#summaryHeader`/`#summaryBody` — it does not toggle
  visibility), then schedules `summaryOverlayEl.hidden = false` via
  `setTimeout(..., SUMMARY_POPUP_DELAY_MS)`, storing the timeout id in
  `summaryPopupTimeout`. Guarded by
  `if (!session || session.endedAt) return;` so it's safe to call
  twice (e.g. Stop clicked during the post-miss delay). It also calls
  `logSession(session)` right after `renderSummary()`, appending the
  completed session to the persistent `localStorage` log — see
  [session-tracker.md](session-tracker.md) for that storage layer; it
  reuses `renderSummary()`'s own `summaryRows` for its per-square data
  rather than recomputing them.
- `startSession()` calls `clearTimeout(summaryPopupTimeout)` and hides
  `#summaryOverlay` up front, so a popup queued by a just-ended session
  can never appear after a new one has started.
- `describeMiss(miss)` renders one `session.misses` entry as
  `"<square> (typed <guess>)"` or `"<square> (timed out)"` depending
  on whether `guess` is set; `renderSummary()` joins these for the
  header's second line.
- `formatSquareList(rows)` renders an array of per-square row objects
  as a comma-separated list of just `row.square`, no timing; used for
  both the "Most difficult" and "Least difficult" rows in
  `#summaryStats`. `statRow(label, value)` wraps a label/value pair as
  the `.statLabel`/`.statValue` div pair the CSS grid expects, used for
  every row in `#summaryStats` including Accuracy.
- The Close button and clicks on the overlay backdrop (but not on the
  card itself — checked via `e.target === summaryOverlayEl`) both just
  set `summaryOverlayEl.hidden = true`.
- `#settingsBtn`/`#settingsOverlay`/`#settingsCloseBtn` follow the
  identical show/hide/backdrop-click pattern as the summary popup:
  `settingsBtn` click sets `settingsOverlayEl.hidden = false`;
  `settingsCloseBtn` click and backdrop clicks (`e.target ===
  settingsOverlayEl`) both set it back to `true`. No session-state
  interaction at all — `#timeLimitInput` and the orientation radios
  it contains already own their own enable/disable and change
  behavior regardless of which DOM container they render inside, so
  moving them into the popup required no logic changes, just a
  location change.
- `setOrientation(newFlipped)` (called from the radios' `change`
  handlers): updates `flipped`, rebuilds the board (which also updates
  the White/Black captions via `updateBoardCaptions()` and the rank/
  file coordinate labels via `updateCoordinateLabels()`), and
  re-highlights the current target if one is showing.
- No changes needed to `squareColor`/`highlightTarget` geometry logic
  — session tracking, timing, and orientation are additive around the
  existing drill loop.
- `#answerInput.focus()` is called in three places: once at module init
  (page load), and inside `startSession()`/`endSession()` — i.e.
  whenever the app lands on a state where typing (an answer, or just
  Enter) is the expected next action.

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
- **`#answerInput` is enabled while idle, not just while running**: the
  earlier design disabled it until a session started. Now it starts
  (and returns, after a session ends) enabled and focused specifically
  so Enter-to-start can reuse the same implicit-submission mechanism as
  Enter-to-answer, instead of needing a separate always-listening
  keyboard handler. It's disabled only during the countdown, when
  there's genuinely nothing valid to do with it.
- **Enter starts a session unconditionally**: whatever is typed in
  `#answerInput` while idle is ignored — Enter always means "start,"
  never "validate this as a square name first." `beginCountdown()`
  clears the field itself, so stray idle text never leaks into the
  session.
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
- **Live right/wrong counts stay raw; the post-session summary gets an
  accuracy percentage**: during play, `#statRight`/`#statWrong` remain
  unreduced counts — informative on their own without being turned
  into a rate while still updating every answer. Once the session is
  over, though, `#summaryStats` does show a computed `Accuracy` row —
  a look-back stat where a percentage is the more useful framing,
  unlike a live counter you're watching tick up in real time. This
  revises the earlier "no accuracy percentage anywhere" stance, scoped
  specifically to this one summary-only context.
- **Summary is a pop-up, not inline**: it lives in a fixed overlay
  separate from the board, appears 500ms after the session actually
  ends (not instantly), and is closed explicitly (Close button or
  backdrop click) rather than by starting a new session — though
  starting a new session does hide it and cancel any pending pop-up.
- **Pressing Start doesn't start the session — it starts a countdown**:
  no `session` object, target square, or timer of any kind exists until
  the 3-2-1 countdown finishes. This is deliberate: the time limit is
  strict (as little as 100ms), so the player needs a predictable,
  timer-free moment to get ready, exactly like chess.com's Puzzle Rush.
- **Countdown length/pace is fixed**: `COUNTDOWN_START = 3` and
  `COUNTDOWN_STEP_MS = 1000` are constants, not configurable — the
  countdown itself isn't a difficulty knob the way the time limit is.
- **350ms buffer after the countdown, not a longer first-square time
  limit**: measured empirically that the first square's timer really
  was getting the full configured `timeLimitMs` (no shortfall) —
  what needed fixing was the abrupt overlay-disappears/target-appears
  transition, not the clock. `POST_COUNTDOWN_DELAY_MS` delays *when*
  the (unchanged) limit starts counting rather than special-casing the
  first square's limit.
- **`#sessionBtn` disabled during the countdown**: prevents a double
  click from starting two overlapping countdowns/sessions. It's the
  only place the button is disabled outside the countdown itself.
- **Settings pulled into a popup, not left inline**: the time limit and
  orientation controls don't need to be visible while actually playing
  — they're configured once and rarely touched mid-session — so hiding
  them behind a `#settingsBtn` gear icon shrinks the always-visible
  chrome down to just the answer row and a thin status line, leaving
  more of the view to the board itself.
- **Answer row moved above the board, not left below it**: puts the
  input the player is actually typing into right next to the title,
  closer to eye level and immediately visible without scrolling past
  the board first; the board itself becomes the single large element
  below it rather than being sandwiched between two control rows.
- **Gear icon on the right, not the left**: keeps the primary
  Start/Stop action anchored on the left (consistent with reading
  order and where it's always been) while the secondary, rarely-used
  settings action sits at the opposite end — the two are never
  confusable at a glance.
- **Settings popup doesn't pause anything**: opening it mid-countdown
  or mid-session is allowed and inert — it's a read/adjust view over
  state that already knows how to protect itself
  (`#timeLimitInput.disabled`), not a modal that needs to coordinate
  with the drill loop.
- **Coordinate labels are configurable, on by default**: a "Show
  rank/file labels" checkbox in settings, checked out of the box so
  the border is discoverable rather than opt-in-only. No persistence
  across page reloads (consistent with every other setting).
- **Toggling coordinates never touches `#board`**: it's implemented as
  a targeted re-render of just `#rankLabels`/`#fileLabels` from cached
  `lastRanks`/`lastFileOrder`, specifically to avoid calling
  `buildBoard()` (which clears and rebuilds all 64 squares, wiping
  `.target`/flash classes) from a control that has nothing to do with
  gameplay state. Same reasoning that keeps the popup from pausing
  anything — a settings toggle shouldn't have side effects on a
  running session.
- **Turning labels off reserves the same space rather than resizing
  the board**: `#boardFrame`'s grid tracks are unconditionally sized;
  hiding labels just empties their content. Keeps the board's own
  pixel size stable regardless of the toggle, so nothing else on the
  page needs to reflow when it's flipped.
- **`#summaryStats` is a CSS grid of label/value pairs, not a list of
  full sentences**: earlier iterations used sentence-style lines like
  "Average time for all squares: 0.9s". A `max-content 1fr` grid keeps
  every value column-aligned to the same x position regardless of
  label length, reading closer to the table right below it than to
  free-form prose — appropriate now that there are 4 rows instead of 1
  or 2.
