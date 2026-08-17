# Chess Square Namer

A browser-based chess coordinate drill. A square lights up on the board and
you type its name (e.g. `e4`) — or say it aloud — before time runs out. It's
modeled on chess.com's Puzzle Rush: a 3-2-1 countdown before each session, a
configurable per-square time limit, and "3 strikes and you're out" — the
session ends after your third miss (a wrong guess or a timeout), whichever
comes first. A session can be paused and resumed without losing its timing.
When a session ends, a summary shows your accuracy, average answer time, and
your most/least difficult squares in a table sortable by any column — and
every completed session is logged to `localStorage`, exportable as `.json`
from the Settings panel, so you can track progress across sessions.

It's a single-page app with no backend, no build step, and no external
dependencies — just `index.html`, `sqname.css`, and `sqname.js`. It's also
installable as a PWA (add it to your home screen / app dock) and works
fully offline once loaded once, via `manifest.webmanifest` and `sw.js`
(voice input still requires a network connection, since browser speech
recognition is cloud-based).

See [docs/design.md](docs/design.md) for the full design rationale and
implementation notes, [voice-input.md](docs/voice-input.md) for the voice input
feature, [docs/session-tracker.md](docs/session-tracker.md) for the
persistent session log, [docs/pwa-design.md](docs/pwa-design.md) for the PWA
conversion, and [CHANGELOG.md](CHANGELOG.md) for release history.

## Credits

The chess piece graphics are Colin M. L. Burnett's "cburnett" set, inlined
as SVG markup in `sqname.js` and extracted from the
[python-chess](https://github.com/niklasf/python-chess) library
(`chess/svg.py`). They're licensed under
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

## Running the app directly from GitHub
You do not need to do the rest of the steps in this document unless you want
to work on the code.  You can run the app simply by clicking
[https://philhanna.github.io/square-namer](https://philhanna.github.io/square-namer)

## Cloning the repository

```sh
git clone git@github.com:philhanna/square-namer.git
cd square-namer
```

(Use the HTTPS URL instead if you haven't set up SSH access to GitHub:
`git clone https://github.com/philhanna/square-namer.git`.)

## Running the app

There's nothing to build or install. Either open `index.html` directly in a
browser:

```sh
open index.html        # macOS
xdg-open index.html     # Linux
```

or serve the directory with any static file server, for example:

```sh
python3 -m http.server 8000
```

and visit `http://localhost:8000/`.

Note: the service worker (`sw.js`) only registers when the app is served
over `http://`/`https://` — opening `index.html` directly via `file://`
still runs the app fine, just without offline caching or install support.
