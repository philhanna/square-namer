# PWA Conversion — Design

**Status: implemented in `index.html`/`manifest.webmanifest`/`sw.js`,
matching this document.**

## Problem

Chess Square Namer is a static, no-build, no-dependency single-page app
(`index.html` / `sqname.css` / `sqname.js`) served from GitHub Pages at
`https://philhanna.github.io/square-namer/`. It works fine as a bookmarked
tab, but it has none of the properties that make a web app feel like an
installed one:

- No way to add it to a phone/desktop home screen with its own icon —
  it's just another browser tab, indistinguishable from any other site.
- Every load re-fetches all three files (and the SVG piece markup inlined
  in `sqname.js`) from the network. On a slow or flaky mobile connection
  — the primary use case for a quick drill session — that's a visible
  delay before the board even renders, and it fails outright with no
  connection at all.
- No `theme-color`/standalone display mode, so on mobile it opens inside
  the browser chrome (address bar, tab strip) rather than full-screen
  like a dedicated app, which eats into the already-tight vertical space
  the board needs (see the `min(92vw, 420px)` cap in
  [design.md](design.md)).

## Goals

- Installable: a "Add to Home Screen" / install prompt on mobile and
  desktop browsers that support it, launching into a standalone window
  with its own icon and name.
- Offline-capable: once loaded once, the app (board, drill logic, voice
  input) works with no network connection at all, since none of its
  gameplay logic ever required one.
- Fast repeat loads: the app shell (HTML/CSS/JS) is served from a local
  cache on the second and subsequent visits, not re-fetched.
- No change to gameplay behavior, timing semantics, or the data model
  described in [design.md](design.md) — this is purely a delivery-layer
  change.
- Stay within the project's existing constraints: no build step, no
  external dependencies, no backend. The manifest and service worker are
  hand-written static files alongside the existing three.

## Non-goals

- **No offline voice input.** [voice-input.md](../voice-input.md) already
  documents that Web Speech API recognition (at least in Chrome) sends
  audio to a remote server — that's a browser-implementation constraint
  this project has no control over, PWA or not. Voice input continues to
  require a network connection; only the typed-answer path is meaningful
  offline. This isn't a regression — it's already the status quo today.
- **No push notifications.** Nothing about a timed drill app benefits
  from a notification permission prompt, and asking for one unprompted
  is exactly the kind of install friction this conversion is trying to
  avoid.
- **No background sync.** There's still no persistence across page
  reloads (design.md's existing non-goal) — a service worker changes
  *how the app's own files are fetched*, not what happens to
  in-memory session data. Nothing here queues writes for a later
  connection, because there's nothing to write.
- **No app-store packaging** (TWA/Capacitor/Electron wrapper). Scope is
  strictly the web platform's own installability (manifest + service
  worker); anything that produces a store-distributable binary is a
  separate, much larger effort and not requested.
- **No cache of speech-recognition results or any other dynamic data.**
  The service worker caches exactly the static app shell — there is no
  dynamic content in this app to cache.
- **No build tooling.** No bundler, no manifest generator, no
  service-worker-generator library (e.g. Workbox). The manifest and
  service worker are written by hand, consistent with the rest of the
  project having no build step.

## New files

```
manifest.webmanifest    # Web App Manifest
sw.js                   # Service worker (cache-first app shell)
icons/
  icon-192.png           # Home-screen / launcher icon
  icon-512.png           # Splash screen / high-res icon
  icon-maskable-512.png  # Android adaptive-icon safe-zone variant
```

Icons are the one genuinely new asset class this adds — everything else
is markup/script. They need an opaque background (not transparent),
since `--bg: #1c1c1e` from `sqname.css` is the app's own dark theme and
a transparent PNG would look broken on a light OS icon tray. The board's
own light/dark square colors (`--light`/`--dark`) plus the yellow
highlight (`--highlight: #f5c518`) are the natural icon motif — a
2×2 corner of the checkerboard with the highlight square lit, echoing
what the app actually looks like mid-drill, rather than a generic chess
piece glyph.

## `manifest.webmanifest`

```json
{
  "name": "Chess Square Namer",
  "short_name": "Sq. Namer",
  "description": "A square lights up — type its name and hit Enter. A chess coordinate drill modeled on Puzzle Rush.",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#1c1c1e",
  "theme_color": "#1c1c1e",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- **`start_url`/`scope` are relative (`./`), not root-absolute (`/`)**.
  GitHub Pages serves this project at `/square-namer/`, not at the
  origin root — `philhanna.github.io` itself hosts a different
  (username) page. A root-absolute `/index.html` would point at the
  wrong site entirely. Relative paths resolve correctly under both
  GitHub Pages (`/square-namer/`) and a local static server rooted at
  the project directory (`python3 -m http.server`), matching how
  `index.html` already references `sqname.css`/`sqname.js` with
  relative, not absolute, paths.
- **`background_color`/`theme_color` match `--bg`** so the OS splash
  screen (shown briefly while the app launches standalone, before any
  CSS has painted) and the browser/OS chrome around the standalone
  window don't flash a mismatched color against the app's own
  permanently-dark theme. This app has no light theme to account for —
  `sqname.css` doesn't define one — so a single fixed value is correct,
  not a `prefers-color-scheme`-dependent pair.
- **`orientation: portrait`**: the board and its controls are already
  designed around a narrow (`min(92vw, 420px)`) column; there's no
  landscape layout to preserve, and letting the OS auto-rotate would
  just make the board comically small on a phone turned sideways.
  Locking orientation only affects the standalone installed window
  (browser tabs ignore it), so it doesn't constrain anyone using the
  page normally.
- **No `id` field**: not needed — there's exactly one app at this scope,
  so there's no ambiguity for the browser to resolve between multiple
  manifests.

### `index.html` changes

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#1c1c1e">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

The last three exist because Safari on iOS doesn't read the manifest's
own icon/display fields for "Add to Home Screen" — it needs its own
`apple-touch-icon` link and `apple-mobile-web-app-*` meta tags to behave
the same way (standalone launch, correct icon) as manifest-aware
browsers. `apple-mobile-web-app-status-bar-style: black-translucent`
lets the app's own dark background show through the iOS status bar
area rather than leaving a mismatched default-gray bar across the top.

The `viewport` meta tag was a follow-up fix discovered during
implementation: without `width=device-width, initial-scale=1`, the
standalone (installed) window rendered the whole page zoomed out to
comically small on mobile — browsers assume a desktop-width viewport by
default absent this tag, standalone mode included. `viewport-fit=cover`
lets the app's background extend under any device notch/safe-area
rather than leaving a strip of unstyled background there. The `<link
rel="icon">` uses the same `icon-192.png` as the manifest/apple-touch
icon, so the browser tab favicon matches the install icon instead of
falling back to a generic globe/blank icon.

## Service worker (`sw.js`)

### Strategy: cache-first for the app shell, versioned by cache name

The entire app is four static files plus the manifest/service-worker
pair itself — there's no dynamic content, no API calls, nothing that
needs a network-first or stale-while-revalidate strategy. Cache-first is
the simplest correct choice: once cached, every asset is served locally
with zero network round-trips, and updates are picked up via cache-name
versioning (below) rather than per-request freshness checks.

```js
const CACHE_NAME = 'sqname-v1';   // bump on every deploy that changes a cached file
const APP_SHELL = [
  './',
  './index.html',
  './sqname.css',
  './sqname.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

- **`CACHE_NAME` is a hand-bumped version string (`sqname-v1`,
  `sqname-v2`, ...), not a hash or build-time-generated value** — this
  project has no build step to generate one, so the version bump is a
  manual part of the release checklist (see "Deployment" below),
  exactly like the existing manual `## [X.Y.Z]` `CHANGELOG.md` entries
  and `pyproject.toml`-style version bumps this user already does for
  other projects.
- **`skipWaiting()` + `clients.claim()` in `install`/`activate`**: a new
  service worker takes control immediately rather than waiting for all
  open tabs of the old version to close first. For a small drill app
  with typically one tab open, waiting for a natural close-and-reopen
  before an update takes effect would mean stale code lingers far
  longer than necessary; immediate takeover is the better default here.
  The tradeoff — a page open *during* the update could have its
  in-flight fetches served by a service worker that just changed
  underneath it — is negligible for a single-page app with no
  in-session network calls to interrupt.
- **`activate` deletes every cache key except the current `CACHE_NAME`**,
  so old versions don't accumulate in the browser's cache storage
  indefinitely across releases.
- **Fetch handler is unconditional cache-first with a network
  fallback**, not scoped to same-origin/GET-only beyond the method
  check shown. There's nothing else this app fetches — no CDN scripts,
  no API calls, no third-party requests of any kind (the chess piece
  SVGs are inlined as markup in `sqname.js`, not fetched as image
  files) — so there's no cross-origin request class that needs special
  handling or exclusion.
- **No runtime/dynamic cache** beyond the app shell — there is no
  dynamic content in this app to cache opportunistically.

### Registration (`sqname.js` or a small inline script in `index.html`)

```js
if ('serviceWorker' in window.navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}
```

- Guarded by feature detection so browsers without service worker
  support (a shrinking but nonzero set) fall through to exactly today's
  behavior — plain network fetches, no offline capability, no install
  prompt. This mirrors the existing "degrade invisibly" principle
  [voice-input.md](../voice-input.md) already established for
  `SpeechRecognition` support.
- Registered after `load`, not at the top of the script, so it doesn't
  compete with the app's own initial render for the main thread during
  first paint.
- Placed as a small standalone script rather than folded into
  `sqname.js`'s existing module-level init code, since it's
  infrastructure unrelated to drill/session logic — keeping it
  separate means a future reader looking for gameplay code in
  `sqname.js` doesn't have to skip past unrelated registration
  boilerplate. (Whether that's a `<script>` block in `index.html` or a
  few lines appended to `sqname.js` is a small enough call to leave to
  implementation time — the guarded, post-`load`, feature-detected
  shape above is the part that matters.)

## Deployment (GitHub Pages)

- GitHub Pages already serves everything over HTTPS, which service
  workers require (`localhost` is also allowed unencrypted, for local
  testing via `python3 -m http.server`) — no infrastructure change
  needed there.
- **Every deploy that changes any file listed in `APP_SHELL` must bump
  `CACHE_NAME`.** Forgetting this means users with the app already
  installed keep silently running the old cached version indefinitely
  — the service worker's whole job is to *avoid* re-fetching those
  files, so nothing will alert them to drift. This should become a
  checklist item alongside the existing `CHANGELOG.md`/version-bump
  habit, not something remembered ad hoc per change.
- No change to the existing `README.md` "Running the app" instructions
  for local development beyond noting that `sw.js` requires being
  served over `http://localhost` (or HTTPS) — opening `index.html`
  directly via `file://` does not support service worker registration,
  so the plain-file-open path in the README becomes offline-incapable
  (but otherwise fully functional, since `register()` is guarded) while
  the `python3 -m http.server` path gets full PWA behavior.

## Testing

- Chrome DevTools → Application → Manifest / Service Workers panels:
  verify the manifest parses with no warnings, the service worker
  installs and activates, and "Add to Home Screen" / the install icon
  in the address bar appears.
- Lighthouse's PWA audit category as a smoke test for the checklist
  items above (installability, offline start, viewport meta tag,
  themed splash screen) — not a target score to chase for its own
  sake, since several Lighthouse PWA criteria (e.g. HTTPS) are already
  satisfied by GitHub Pages regardless of anything in this document.
- Manual offline check: load the app once online, then DevTools →
  Network → "Offline", reload, and confirm the board renders and a
  full drill session (start → answer squares → summary) runs
  identically to online behavior. Voice input is expected to fail
  gracefully offline per "Non-goals" above — confirm it does (button
  present but recognition errors handled, not a hard crash) rather
  than actually working.
- Cache-bump check: change a cached file, bump `CACHE_NAME`, reload an
  already-installed instance, and confirm the new version takes over
  without the user needing to uninstall/reinstall.

## Decisions

- **Cache-first over network-first or stale-while-revalidate**: correct
  specifically because this app has no dynamic content — every cached
  file only changes on a deploy the developer controls, not on a
  schedule or per-request basis a smarter strategy would need to
  account for.
- **Hand-bumped `CACHE_NAME` over a build-time hash**: consistent with
  the project's no-build-step constraint; the manual step is a small,
  known cost already paid elsewhere in this project's release process
  (version bumps in other projects' `pyproject.toml`/`CHANGELOG.md`).
- **`skipWaiting`/`clients.claim` (immediate takeover) over the
  default wait-for-close-then-activate behavior**: appropriate for a
  small single-page app with no in-session network calls to disrupt;
  the usual risk this default protects against (interrupting a
  long-lived session with mixed-version code) doesn't apply here.
- **No Workbox or other service-worker library**: the entire cache
  strategy is nine lines of `fetch`/`caches` API calls; a library would
  add a dependency (and, for most of them, a build step) to avoid
  writing less code than the manifest itself.
- **Portrait-locked, single fixed theme color**: the app has exactly
  one layout (narrow column) and one theme (permanently dark,
  per `sqname.css`) — there's no responsive/light-mode variation for
  the manifest to account for.
- **Icons depict the board itself, not a generic chess glyph**: reuses
  the app's own visual identity (light/dark squares, yellow highlight)
  rather than introducing new iconography unrelated to what launching
  the icon actually shows.
