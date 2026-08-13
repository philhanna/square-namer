# Chess Square Namer

A browser-based chess coordinate drill. A square lights up on the board and
you type its name (e.g. `e4`) before time runs out. It's modeled on
chess.com's Puzzle Rush: a 3-2-1 countdown before each session, a
configurable per-square time limit, and "3 strikes and you're out" — the
session ends after your third miss (a wrong guess or a timeout), whichever
comes first. When a session ends, a summary shows your accuracy, average
answer time, and your most/least difficult squares.

It's a single-page app with no backend, no build step, and no external
dependencies — just `index.html`, `sqname.css`, and `sqname.js`.

See [design.md](design.md) for the full design rationale and implementation
notes, and [CHANGELOG.md](CHANGELOG.md) for release history.

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
