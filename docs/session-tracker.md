# Session Log — Design

**Status: proposed, not yet implemented.**

## Problem

[design.md](design.md) explicitly defers two things as non-goals: "persisting
sessions across page reloads" and "aggregating difficulty trends across
multiple sessions" — each session's `attempts`/`misses` live only in the
in-memory `session` object and are discarded the moment a new session starts
or the page reloads (see design.md's "Session lifecycle" and "Data model").
That's fine for "how did *this* session go," but there's no way to answer
"am I getting faster on the queenside squares" or "which squares are still
consistently slow" without a human remembering across sessions by hand.

This document is that later iteration: a persistent, per-browser log of
completed sessions, stored in `localStorage`, that captures enough per-entry
detail (when, under what settings, with what input device, and the complete
stats) to support answering those questions later.

## Goals

- Every session that ends with at least one recorded attempt or miss is
  appended as one log entry to a `localStorage`-backed array, automatically —
  no extra step by the user.
- Each entry is self-contained: timestamp, the settings in effect for that
  session (time limit, orientation, coordinate labels), which input device(s)
  were used, and the complete stats (accuracy, misses, per-square
  count/avg/max) — enough to reconstruct everything the on-screen summary
  pop-up shows, without needing the original `session` object.
- Log data survives page reloads, browser restarts, and (for an installed
  PWA) app relaunches, since it's keyed off `localStorage`, not memory.
- An **export** control (in the Settings panel) that downloads the full log
  as a `.json` file, so the data isn't trapped in one browser profile —
  useful as a backup and as raw input to any future analysis.
- Bounded, defensive storage: a corrupted or missing log resets to empty
  rather than breaking the app, and the log can't grow without limit.

## Non-goals

- **No history/trends UI in this iteration** — no in-app screen that charts
  improvement or lists problem squares across sessions. This document defines
  the storage layer that such a screen would read from; building that screen
  is a separate, later design once there's actually a log to look at. (This
  mirrors how design.md itself was written before the summary pop-up gained
  its stats — storage first, presentation later.)
- **No import / restore.** Export is for backup and manual inspection, not
  round-tripping data back in. Without cross-device sync (below) there's no
  scenario in this app where restoring an exported file into a *different*
  browser would reconcile sensibly with that browser's own log, and
  restoring into the *same* browser only matters after data loss, which is
  rare enough not to design for yet.
- **No cross-device sync, account system, or backend.** Consistent with the
  rest of this project (see pwa-design.md's constraints): no build step, no
  external dependencies, no server. The log lives in one browser's
  `localStorage`, full stop.
- **No per-attempt input-device tracking.** Voice input fills the same
  `#answerInput` and submits through the same form path as typing (see
  [voice-input.md](voice-input.md)) — there's no clean signal to label an
  *individual* attempt as voice vs. typed without adding new plumbing to the
  hot submit path. Input device is tracked per **session** instead (see "Data
  model" below), which is enough resolution for "was I using voice this
  session."
- **No privacy/anonymization controls.** The log contains nothing but drill
  performance numbers (squares, timings, settings) — no names, no accounts,
  nothing to anonymize.
- **No retention/expiry policy beyond a hard entry cap** (see "Storage" below)
  — no "delete sessions older than 90 days" setting. The cap alone is enough
  to keep `localStorage` usage bounded.

## Data model

```js
// localStorage key: "sqname.sessionLog"
{
  schemaVersion: 1,
  entries: [
    {
      timestamp: Number,     // session.endedAt (Date.now() when the session ended)
      durationMs: Number,    // session.endedAt - session.startedAt
      endedBy: 'struck out' | 'stopped manually',

      settings: {
        timeLimitMs: Number,       // timeLimitMs in effect for this session
        orientation: 'white' | 'black',
        showCoordinates: Boolean,
      },

      inputDevice: 'keyboard' | 'voice' | 'mixed',

      stats: {
        correct: Number,       // session.attempts.length
        missed: Number,        // session.misses.length
        accuracy: Number|null, // correct / (correct + missed); null if both are 0

        misses: [
          { square: 'h6', guess: 'g5' | null, elapsedMs: Number },
          // ... same shape as session.misses, in order
        ],

        perSquare: [
          { square: 'e4', count: Number, avgMs: Number, maxMs: Number },
          // ... same shape as the on-screen summary table's rows,
          //     one entry per square that appeared in a correct attempt
        ],
      },
    },
    // ... newest entries appended last
  ],
}
```

- **A top-level `schemaVersion`, not a per-entry one.** All entries in the
  array share one shape at any point in time; a future field addition or
  rename bumps this single number and the load path runs a migration (or, if
  the shape changed too much to migrate cheaply, resets the log) — see
  "Storage" below.
- **`stats.perSquare` and `stats.misses` reuse the exact shapes design.md
  already defines** (`perSquare[square] = { count, avgMs, maxMs }` and
  `session.misses` entries) rather than inventing new field names — the log
  entry is a serialization of data the app already computes for the on-screen
  summary, not a new stats model to keep in sync with that one.
- **No stored "most difficult" / "least difficult" / "slow" derived fields.**
  Those are sorts and threshold comparisons over `perSquare`
  (`SLOW_THRESHOLD_MS`, top-3-by-`avgMs`) that the on-screen summary already
  computes at render time from raw data — storing the derived version too
  would let it silently drift from the raw numbers it's derived from, and
  costs nothing to recompute whenever an entry is read.
- **`accuracy` is stored** even though design.md lists "an accuracy
  percentage" as a non-goal for the *live/on-screen* summary — that non-goal
  was about not cluttering the in-session UI with a derived rate; it doesn't
  apply to a log entry meant for later analysis, where a normalized rate is
  exactly what makes different sessions comparable.
- **`inputDevice` is computed at session end**, not read once from
  `voiceActive`: track two booleans through the session (`usedKeyboard`,
  `usedVoice`), each set the moment an attempt or miss is recorded based on
  whatever `voiceActive` is *at that instant* (mirrors the existing
  `if (!voiceActive) answerInput.focus()` checks already scattered through
  `sqname.js`). At log time: both set → `'mixed'`, only `usedVoice` →
  `'voice'`, otherwise → `'keyboard'` (also the default for a session with no
  recorded attempts/misses, though those aren't logged at all — see
  "Storage").

## Storage

```js
const SESSION_LOG_KEY = 'sqname.sessionLog';
const SESSION_LOG_SCHEMA_VERSION = 1;
const MAX_LOG_ENTRIES = 1000;

function loadSessionLog() {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSION_LOG_KEY));
    if (raw && raw.schemaVersion === SESSION_LOG_SCHEMA_VERSION && Array.isArray(raw.entries)) {
      return raw;
    }
  } catch {
    // fall through to a fresh log
  }
  return { schemaVersion: SESSION_LOG_SCHEMA_VERSION, entries: [] };
}

function saveSessionLog(log) {
  log.entries = log.entries.slice(-MAX_LOG_ENTRIES);
  try {
    localStorage.setItem(SESSION_LOG_KEY, JSON.stringify(log));
  } catch {
    // quota exceeded or storage disabled (private browsing, etc.) — the
    // session itself already ran and its on-screen summary already
    // rendered; losing the log entry isn't worth surfacing as an error.
  }
}

function logSession(session) {
  if (session.attempts.length === 0 && session.misses.length === 0) return;

  const log = loadSessionLog();
  log.entries.push(buildLogEntry(session));
  saveSessionLog(log);
}
```

- **Read-modify-write on every session end, not a running in-memory
  mirror.** Sessions end infrequently (this is a multi-minute drill, not a
  per-keystroke event) — the cost of re-parsing `localStorage` each time is
  negligible, and it avoids a second source of truth that could drift from
  what's actually persisted if, say, two tabs are open.
- **Empty sessions (Start immediately followed by Stop) are not logged.**
  `session.attempts.length === 0 && session.misses.length === 0` means
  nothing happened worth recording — logging it would just be a no-data
  entry cluttering any future history view.
- **`MAX_LOG_ENTRIES` (1000) is a defensive cap, not a real-world limit.**
  Each entry is at most a few KB even for a long, varied session (64 squares
  possible, each with a handful of numeric fields) — a thousand entries is
  low-single-digit megabytes, well under `localStorage`'s typical 5–10MB
  per-origin quota, and represents years of regular practice. The cap exists
  so a pathological case (or a bug that logs far more often than intended)
  can't grow the log unbounded; it trims oldest-first on every save.
- **`saveSessionLog` swallows quota/storage errors silently.** By the time
  this runs, the session has already ended and its on-screen summary has
  already rendered (see "Integration" below) — a storage failure shouldn't
  retroactively make the *drill* look like it failed. Private browsing modes
  that disable or heavily restrict `localStorage` degrade the same way: the
  app works exactly as it does today, it just doesn't accumulate history.
- **Corrupted/missing/version-mismatched data resets to an empty log**
  rather than throwing. `schemaVersion` is checked on load so that a future
  shape change doesn't hand old-shaped entries to code expecting the new
  shape; for v1 there's nothing to migrate *from* yet, so a mismatch just
  means "start fresh" (a real migration function is future work, once there's
  a v2).

## Integration

- `logSession(session)` is called from `endSession()` in `sqname.js`,
  alongside the existing `renderSummary()` call — same place, same moment,
  using the same `session` object design.md already documents. It runs after
  `session.endedAt` is set, so `durationMs` and `timestamp` are available.
- `usedKeyboard` / `usedVoice` are set on the `session` object itself (e.g.
  `session.usedKeyboard = true`) at the two existing points where an attempt
  or a miss is recorded — the `answerForm` submit handler and
  `handleTimeout()` — each checking `voiceActive` the same way the existing
  `if (!voiceActive) answerInput.focus()` lines already do nearby. No new
  event listeners; just one line at each of those two existing recording
  points.
- **Settings snapshot is read at session start, not session end.**
  `timeLimitInput`/`orientationWhite`/`orientationBlack`/`showCoordinates`
  are already disabled for the duration of a running session (design.md,
  "Session lifecycle"), so start and end values are always identical in
  practice — reading at start just matches where `timeLimitMs` is already
  captured today (`beginCountdown()`), rather than introducing a second read
  site.
- **Export button** lives in the Settings panel (`#settingsOverlay`), next to
  the existing toggles — e.g. "Export session log". Handler:
  ```js
  function exportSessionLog() {
    const log = loadSessionLog();
    const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sqname-session-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  ```
  Disabled (or hidden) when the log is empty, matching the existing pattern
  of `pauseBtn` being `disabled` when there's no session to pause.

## Testing

- DevTools → Application → Local Storage: run a few sessions (mix of
  struck-out and manually-stopped, at least one with voice input if
  available), confirm `sqname.sessionLog` accumulates one well-formed entry
  per session and that `schemaVersion`/array shape match the data model
  above.
- Confirm an empty Start→Stop session (no attempts, no misses) does **not**
  add an entry.
- Corrupt the stored value by hand (DevTools → edit the key to invalid JSON)
  and reload: confirm the app doesn't throw and a subsequent session starts
  a fresh log rather than crashing on load.
- Simulate quota exhaustion (DevTools can throttle/quota-limit storage, or
  temporarily lower `MAX_LOG_ENTRIES` and pre-fill past it) and confirm a
  session still completes and its on-screen summary still renders even if
  the log write silently fails.
- Export with a non-empty log, open the downloaded file, and confirm it's
  valid JSON matching the data model.
- Private browsing / storage-disabled check: confirm the app still runs a
  full session normally when `localStorage` throws on every access.

## Decisions

- **`localStorage`, not `IndexedDB`.** The log is a small, append-mostly
  array with no need for indexed queries, transactions, or large binary
  data — `IndexedDB`'s async, cursor-based API would be strictly more
  ceremony for the same outcome at this data volume (see "Storage" sizing
  above). If per-square cross-session querying ever becomes a real
  performance concern, that's a reason to revisit, not a reason to start
  there.
- **One JSON blob under one key, not one `localStorage` key per session.**
  Keeps the read/write path to two functions (`loadSessionLog`/
  `saveSessionLog`) instead of needing to enumerate keys by prefix, and
  makes export a direct passthrough of what's already loaded.
- **Log entries mirror design.md's existing field names and shapes**
  (`perSquare`, `misses`, `avgMs`/`maxMs`) instead of a fresh vocabulary —
  anyone who already understands the on-screen summary (design.md) can read
  a log entry with no translation.
- **Session-level, not attempt-level, input-device tracking.** Matches what
  the app can actually observe cheaply (see "Non-goals") rather than adding
  new plumbing to distinguish voice-filled from typed submissions on the hot
  answer-submission path.
- **Export only, no import, no sync, no backend** — consistent with this
  project's standing constraint (pwa-design.md) of no build step, no
  external dependencies, no server; a log that only ever lives in one
  browser's `localStorage` is the smallest thing that satisfies "track
  improvement over time" for a single user on a single device.
