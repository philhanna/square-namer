# Voice Input — Design

**Status: design only — nothing in this document is implemented in `sqname.js`
yet.**

## Problem

On mobile, the on-screen keyboard that pops up when `#answerInput` is
focused covers a large portion (often over half) of the viewport,
including the board itself. During a timed session, the player needs
to see the board and the newly-highlighted target square at the exact
moment they're expected to answer — a keyboard covering that square
defeats the drill.

## Goals

- Let the player answer a square by speaking its name (e.g. "e four")
  instead of typing it, so no on-screen keyboard ever needs to appear.
- Let the player say **"start"** / **"stop"** to control the session
  the same way `#sessionBtn` does, for the same reason — no need to
  tap a keyboard-adjacent control mid-drill.
- Recognize only a small, fixed vocabulary: the two command words and
  the 64 square names (spoken as a file letter + a rank digit, e.g.
  "b seven"). This is not general dictation.
- Degrade invisibly on any browser without Web Speech API support —
  the app works exactly as it does today, keyboard-only.

## Non-goals

- **No voice control of settings.** Time limit, orientation, and the
  coordinate-label toggle stay mouse/touch-only, exactly as they are
  now — explicitly out of scope per the user.
- No free-form dictation, no wake word, no "Hey Square Namer."
- No attempt to disambiguate a misheard-but-well-formed square from a
  genuine wrong guess (see "Known limitations" below) — no
  confirmation step, since that would slow down a timed drill.
- No offline/on-device recognition — this relies on whatever the
  browser's `SpeechRecognition` implementation provides (in Chrome,
  that means audio is sent to Google's servers; see "Browser support"
  below).
- No changes to scoring, timing, or session-lifecycle rules from
  [design.md](design.md). Voice is purely an alternate way of
  performing the same two actions a player can already perform by
  hand.

## Core design principle

**Voice input never talks to game-state functions directly.** It only
ever does one of two things, both already wired up for mouse/keyboard
use:

1. Fill `#answerInput.value` with a recognized square and call
   `answerForm.requestSubmit()` — exactly what typing a square and
   pressing Enter does today.
2. Call `sessionBtn.click()` — exactly what tapping Start/Stop does
   today.

Every state guard that already exists (`#sessionBtn` disabled during
the countdown, `SQUARE_NAME_RE` validation, `session.endedAt` checks,
the malformed-guess warning path) keeps working unmodified, because
voice is going through the same code path a real click or keypress
would. There is no second, parallel implementation of the drill logic
to keep in sync with the first.

## Vocabulary and recognition strategy

### Fast path: the engine already fused it

Chrome's speech engine frequently applies inverse text normalization
to spoken alphanumerics, so "e four" often comes back as the literal
string `"E4"` or `"e4"`, not two separate words. The parser checks for
this first:

```js
function parseVoiceSquare(transcript) {
  const cleaned = transcript.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const compact = cleaned.replace(/\s+/g, '');
  if (SQUARE_NAME_RE.test(compact)) return compact;
  return parseVoiceSquareFromWords(cleaned);
}
```

Reuses the existing `SQUARE_NAME_RE` (`/^[a-h][1-8]$/`) from
`sqname.js` — the same pattern that already validates typed guesses.

### Slow path: word-by-word mapping

If the fast path doesn't match, split the cleaned transcript into
words and map each one against small phonetic tables, keyed by the
letter/digit they represent:

```js
const FILE_WORDS = {
  a: 'a',
  b: 'b', be: 'b', bee: 'b',
  c: 'c', see: 'c', sea: 'c',
  d: 'd', dee: 'd',
  e: 'e',
  f: 'f', ef: 'f', eff: 'f',
  g: 'g', gee: 'g',
  h: 'h', aitch: 'h',
};

const RANK_WORDS = {
  one: '1', won: '1',
  two: '2', to: '2', too: '2',
  three: '3',
  four: '4', for: '4', fore: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8', ate: '8',
};

function parseVoiceSquareFromWords(cleaned) {
  const words = cleaned.split(/\s+/);
  let file = null, rank = null;
  for (const w of words) {
    if (!file && FILE_WORDS[w]) file = FILE_WORDS[w];
    if (!rank && RANK_WORDS[w]) rank = RANK_WORDS[w];
  }
  return (file && rank) ? file + rank : null;
}
```

Both tables are deliberately small and data-driven so new misheard
variants can be added as they're observed in practice, without
touching the parsing logic itself. Filler words ("square", "the",
"go to") are harmless — they simply match nothing in either table and
are skipped.

`SpeechRecognition.maxAlternatives` is set to `3`; when a result comes
back, each alternative transcript is tried through `parseVoiceSquare`
in order, and the first one that resolves to a well-formed square
wins. This costs nothing and catches cases where the top guess is
noise but a lower-ranked alternative is a clean match.

### Commands

```js
function parseVoiceCommand(transcript) {
  const cleaned = transcript.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned === 'start') return 'start';
  if (cleaned === 'stop') return 'stop';
  return null;
}
```

Matched with **exact equality on the whole utterance**, not
`.includes()`. If the player says "e4" that's a single-word utterance
too, so an `includes`-style check on "stop" would risk false-triggering
on background conversation ("let's stop for coffee" ending a session
mid-drill). Exact-match after trimming means only an utterance that
was *just* "stop" and nothing else fires the command.

## Lifecycle

- **Unsupported browser**: `window.SpeechRecognition ||
  window.webkitSpeechRecognition` is checked once at module init.
  If neither exists, `#voiceBtn` stays `hidden` for the whole session
  — same pattern already used for `#countdownOverlay[hidden]` — and
  no `SpeechRecognition` instance is ever constructed.
- **Idle, voice off** (default): `#voiceBtn` shown, not active. No
  microphone permission has been requested yet — `SpeechRecognition`
  is deliberately not constructed until the player first taps
  `#voiceBtn`, since starting it earlier would trigger a mic
  permission prompt the player hasn't asked for, and browsers require
  a user gesture to start recognition anyway.
- **Toggled on** (`voiceActive = true`): `recognizer.start()` is
  called; `#voiceBtn` gets a `.listening` class (pulsing indicator).
  Recognition runs continuously — through the countdown, through the
  running session, after it ends — until the player taps `#voiceBtn`
  again. It is *not* automatically paused during the countdown or
  while `#settingsOverlay`/`#summaryOverlay` are open; saying "start"
  or a square name in those states goes through `sessionBtn.click()`
  / `answerForm.requestSubmit()` exactly as an errant Enter keypress
  would in the same state today, which is already-existing behavior,
  not something voice introduces.
- **Recognized command** ("start" or "stop"): `sessionBtn.click()`.
  The button's own `disabled` state (set during the countdown) already
  prevents a double-start the same way it prevents a double-click.
- **Recognized square**: `answerInput.value` is set to the parsed
  square and `answerForm.requestSubmit()` is called. From there,
  everything is unchanged from [design.md](design.md) — correct/wrong/
  malformed handling, timing, misses, all identical to a typed answer.
- **Unresolved utterance** (neither a command nor a square): silently
  ignored — no warning shown. Voice recognition produces far more
  noise than a keyboard (ambient sound, false final-results, cut-off
  words), so surfacing every miss as a `.warn` message the way a
  malformed typed guess does today would spam the feedback line.
- **Toggled off**: `recognizer.stop()`. `#voiceBtn` loses
  `.listening`.

## UI changes

- `#voiceBtn` — a new button in `#topRow`, feature-detected `hidden`
  by default. Sits beside `#settingsBtn` at the right end of the row
  (both are secondary toggles, distinct from the primary
  `#sessionBtn` action on the left): `#sessionBtn`, `#answerForm`,
  `#sessionTimer`, `#voiceBtn`, `#settingsBtn`.
- Icon: 🎙, styled like `#settingsBtn` (neutral gray square button) when
  off. A `.listening` class swaps it to a distinguishable active state
  — e.g. a red pulsing dot/border via a CSS animation, so the player
  can tell at a glance whether the mic is live without needing to
  check `aria-pressed` or read text.
- `#answerInput` and `#sessionBtn` are completely unchanged — voice is
  additive, not a replacement. A player can type, tap, or speak
  interchangeably at any point.

## Implementation notes

- Module-level state: `voiceSupported` (computed once at init),
  `voiceActive` (boolean, whether the mic toggle is on), `recognizer`
  (the lazily-constructed `SpeechRecognition` instance, `null` until
  first toggled on).
- `createRecognizer()`:
  ```js
  function createRecognizer() {
    const Impl = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new Impl();
    r.continuous = true;
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.lang = 'en-US';
    r.onresult = handleVoiceResult;
    r.onerror = handleVoiceError;
    r.onend = handleVoiceEnd;
    return r;
  }
  ```
- `handleVoiceResult(event)` iterates `event.results` from
  `event.resultIndex` onward, skips non-final results
  (`!result.isFinal`), and for each final result tries each
  alternative's transcript through `parseVoiceCommand` then
  `parseVoiceSquare` until one resolves, then acts (`sessionBtn.click()`
  or fill-and-submit) and stops looking at further alternatives for
  that result.
- `handleVoiceEnd()`: browsers commonly end a recognition session on
  their own after a period of silence, even with `continuous = true`
  — behavior isn't fully consistent across engines. If `voiceActive`
  is still `true`, immediately call `recognizer.start()` again so
  listening resumes transparently; the player never has to notice or
  re-toggle.
- `handleVoiceError(event)`: `'no-speech'` and similar transient
  errors are expected during normal pauses and are ignored — `onend`
  will fire right after and the restart logic above handles it. On
  `'not-allowed'` or `'service-not-allowed'` (mic permission denied or
  blocked), set `voiceActive = false`, update `#voiceBtn`, and show a
  one-time `.warn` message in `#feedback` ("Microphone permission
  denied") — retrying automatically would just re-prompt forever.
- `#voiceBtn` click handler toggles `voiceActive`, lazily calls
  `createRecognizer()` on first use, and calls `recognizer.start()` /
  `recognizer.stop()` to match.

## Browser support

Verify directly before relying on any of this, since support shifts —
but as a starting point:

- **Chrome / Edge (desktop and Android)**: full support via
  `webkitSpeechRecognition`. Recognition is cloud-based — audio is
  streamed to Google's servers — so it requires a network connection
  and has inherent round-trip latency.
- **Safari (macOS and iOS)**: `webkitSpeechRecognition` has been
  available since Safari 14.1, but continuous recognition and
  auto-restart-on-end have historically been less reliable than
  Chrome's. Test specifically on iOS Safari before depending on it —
  this is the platform that motivated the feature in the first place.
- **Firefox**: no support (`window.SpeechRecognition` is `undefined`).
  `#voiceBtn` simply never un-hides; those players get today's
  keyboard-only experience with no error, no broken button.
- **Secure context required**: the Web Speech API only works on
  `https://` or `http://localhost` origins. Opening `index.html`
  directly via `file://` (mentioned as an option in the README) will
  not expose voice input — feature detection handles this the same
  way as an unsupported browser, since `SpeechRecognition` still
  exists but `.start()` will error immediately.

## Known limitations

- **A misheard-but-well-formed square is scored as a genuine miss.**
  If the player says "e4" and the engine hears "d4", the app has no
  way to know that wasn't the player's real guess — it's recorded as
  a wrong guess like any other, same as design.md's existing
  malformed-vs-wrong distinction, just one level up (this time the
  "typo" happens in the microphone, not the keyboard). No confirmation
  step is added to guard against this, since it would slow down a
  timed drill for the sake of a failure mode that's already
  self-correcting (it costs a strike, not the whole session).
- **Recognition latency makes voice impractical at short time
  limits.** Between the pause needed for the engine to detect
  end-of-utterance and the network round-trip in Chrome's
  implementation, total latency is commonly 300–800ms on top of however
  long the player takes to actually speak. Below roughly
  1500–2000ms `timeLimitMs`, voice is more a novelty than a
  competitive input method — this is a property of the underlying API,
  not something the app can optimize around.
- **Ambient noise / conversation can misfire.** The exact-match
  command check mitigates "stop" appearing inside a longer sentence,
  but a short one-word background utterance that happens to be
  literally "stop" (or a well-formed square, purely by chance) is
  still possible. Given the low stakes of a practice drill, this is
  accepted rather than engineered around.

## Decisions

- **Reuse `answerForm.requestSubmit()` / `sessionBtn.click()` rather
  than calling `startSession()`/`endSession()`/scoring logic
  directly**: keeps a single source of truth for every state guard
  already in `sqname.js`. A second parallel path invoked by voice
  would inevitably drift out of sync with the keyboard/mouse path as
  the app evolves.
- **No settings by voice**: explicitly requested scope. Settings are
  configured once per session and rarely touched mid-drill, unlike
  square-naming and start/stop, which happen constantly and are
  exactly what the keyboard-covers-the-board problem affects.
- **Silent-ignore for unresolved utterances, not a warning**: voice
  produces far more noise than typing; treating every unresolved
  utterance as a warning (mirroring the malformed-typed-guess UX)
  would spam `#feedback` constantly instead of just when the player
  actually tried and failed to say a square.
- **Exact-match, not substring-match, for commands**: prevents
  "stop" appearing inside unrelated speech (background conversation,
  a longer sentence) from ending a session the player didn't intend
  to end.
- **Recognizer constructed lazily, on first toggle**: avoids
  requesting microphone permission before the player has expressed
  any interest in voice input, and matches the browser requirement
  that recognition only starts from a user gesture.
- **Continuous mode with auto-restart-on-end, not push-to-talk**: the
  whole point is to never need to touch a keyboard-adjacent control
  mid-drill; a push-to-talk button would reintroduce a tap-timing
  problem similar to the one voice is meant to solve.
- **No accuracy percentage or scoring changes**: voice is purely an
  input method swap. Every scoring, timing, and session-lifecycle rule
  from [design.md](design.md) is unchanged.
