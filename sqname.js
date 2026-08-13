const SLOW_THRESHOLD_MS = 500;
const SQUARE_NAME_RE = /^[a-h][1-8]$/;
const SUMMARY_POPUP_DELAY_MS = 500;
const DEFAULT_TIME_LIMIT_MS = 1000;
const STRIKE_LIMIT = 3;
const COUNTDOWN_START = 3;
const COUNTDOWN_STEP_MS = 1000;
const POST_COUNTDOWN_DELAY_MS = 350;

const files = ['a','b','c','d','e','f','g','h'];

const BACK_RANK_ORDER = ['R','N','B','Q','K','B','N','R'];
// Inlined (rather than loaded via <img src>) so the board still renders
// when index.html is opened directly as a file:// URL — Chrome refuses
// to load a local SVG image from a file:// page ("'file:' URLs are
// treated as unique security origins").
const PIECE_SVG = {
  K: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 45 45\"><g id=\"white-king\" class=\"white king\" fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M22.5 11.63V6M20 8h5\" stroke-linejoin=\"miter\"/><path d=\"M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5\" fill=\"#fff\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\"/><path d=\"M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z\" fill=\"#fff\"/><path d=\"M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0\"/></g></svg>",
  Q: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 45 45\"><g id=\"white-queen\" class=\"white queen\" fill=\"#fff\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM24.5 7.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0z\"/><path d=\"M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12zM9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z\" stroke-linecap=\"butt\"/><path d=\"M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0\" fill=\"none\"/></g></svg>",
  R: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 45 45\"><g id=\"white-rook\" class=\"white rook\" fill=\"#fff\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5\" stroke-linecap=\"butt\"/><path d=\"M34 14l-3 3H14l-3-3\"/><path d=\"M31 17v12.5H14V17\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\"/><path d=\"M31 29.5l1.5 2.5h-20l1.5-2.5\"/><path d=\"M11 14h23\" fill=\"none\" stroke-linejoin=\"miter\"/></g></svg>",
  B: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 45 45\"><g id=\"white-bishop\" class=\"white bishop\" fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g fill=\"#fff\" stroke-linecap=\"butt\"><path d=\"M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z\"/></g><path d=\"M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5\" stroke-linejoin=\"miter\"/></g></svg>",
  N: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 45 45\"><g id=\"white-knight\" class=\"white knight\" fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18\" style=\"fill:#ffffff; stroke:#000000;\"/><path d=\"M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10\" style=\"fill:#ffffff; stroke:#000000;\"/><path d=\"M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z\" style=\"fill:#000000; stroke:#000000;\"/><path d=\"M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z\" transform=\"matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)\" style=\"fill:#000000; stroke:#000000;\"/></g></svg>",
  P: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 45 45\"><g id=\"white-pawn\" class=\"white pawn\"><path d=\"M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z\" fill=\"#fff\" stroke=\"#000\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></g></svg>",
  k: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 45 45\"><g id=\"black-king\" class=\"black king\" fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M22.5 11.63V6\" stroke-linejoin=\"miter\"/><path d=\"M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5\" fill=\"#000\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\"/><path d=\"M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z\" fill=\"#000\"/><path d=\"M20 8h5\" stroke-linejoin=\"miter\"/><path d=\"M32 29.5s8.5-4 6.03-9.65C34.15 14 25 18 22.5 24.5l.01 2.1-.01-2.1C20 18 9.906 14 6.997 19.85c-2.497 5.65 4.853 9 4.853 9M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0\" stroke=\"#fff\"/></g></svg>",
  q: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 45 45\"><g id=\"black-queen\" class=\"black queen\" fill=\"#000\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g fill=\"#000\" stroke=\"none\"><circle cx=\"6\" cy=\"12\" r=\"2.75\"/><circle cx=\"14\" cy=\"9\" r=\"2.75\"/><circle cx=\"22.5\" cy=\"8\" r=\"2.75\"/><circle cx=\"31\" cy=\"9\" r=\"2.75\"/><circle cx=\"39\" cy=\"12\" r=\"2.75\"/></g><path d=\"M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5 9 26zM9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z\" stroke-linecap=\"butt\"/><path d=\"M11 38.5a35 35 1 0 0 23 0\" fill=\"none\" stroke-linecap=\"butt\"/><path d=\"M11 29a35 35 1 0 1 23 0M12.5 31.5h20M11.5 34.5a35 35 1 0 0 22 0M10.5 37.5a35 35 1 0 0 24 0\" fill=\"none\" stroke=\"#fff\"/></g></svg>",
  r: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 45 45\"><g id=\"black-rook\" class=\"black rook\" fill=\"#000\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 39h27v-3H9v3zM12.5 32l1.5-2.5h17l1.5 2.5h-20zM12 36v-4h21v4H12z\" stroke-linecap=\"butt\"/><path d=\"M14 29.5v-13h17v13H14z\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\"/><path d=\"M14 16.5L11 14h23l-3 2.5H14zM11 14V9h4v2h5V9h5v2h5V9h4v5H11z\" stroke-linecap=\"butt\"/><path d=\"M12 35.5h21M13 31.5h19M14 29.5h17M14 16.5h17M11 14h23\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1\" stroke-linejoin=\"miter\"/></g></svg>",
  b: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 45 45\"><g id=\"black-bishop\" class=\"black bishop\" fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zm6-4c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z\" fill=\"#000\" stroke-linecap=\"butt\"/><path d=\"M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5\" stroke=\"#fff\" stroke-linejoin=\"miter\"/></g></svg>",
  n: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 45 45\"><g id=\"black-knight\" class=\"black knight\" fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18\" style=\"fill:#000000; stroke:#000000;\"/><path d=\"M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10\" style=\"fill:#000000; stroke:#000000;\"/><path d=\"M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z\" style=\"fill:#ececec; stroke:#ececec;\"/><path d=\"M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z\" transform=\"matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)\" style=\"fill:#ececec; stroke:#ececec;\"/><path d=\"M 24.55,10.4 L 24.1,11.85 L 24.6,12 C 27.75,13 30.25,14.49 32.5,18.75 C 34.75,23.01 35.75,29.06 35.25,39 L 35.2,39.5 L 37.45,39.5 L 37.5,39 C 38,28.94 36.62,22.15 34.25,17.66 C 31.88,13.17 28.46,11.02 25.06,10.5 L 24.55,10.4 z \" style=\"fill:#ececec; stroke:none;\"/></g></svg>",
  p: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 45 45\"><g id=\"black-pawn\" class=\"black pawn\"><path d=\"M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z\" fill=\"#000\" stroke=\"#000\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></g></svg>",
};
const START_POSITION = {};
files.forEach((file, i) => {
  START_POSITION[file + '1'] = BACK_RANK_ORDER[i];
  START_POSITION[file + '2'] = 'P';
  START_POSITION[file + '7'] = 'p';
  START_POSITION[file + '8'] = BACK_RANK_ORDER[i].toLowerCase();
});

const boardEl = document.getElementById('board');
const boardCaptionTop = document.getElementById('boardCaptionTop');
const boardCaptionBottom = document.getElementById('boardCaptionBottom');
const answerForm = document.getElementById('answerForm');
const answerInput = document.getElementById('answerInput');
const feedbackEl = document.getElementById('feedback');
const statRight = document.getElementById('statRight');
const statWrong = document.getElementById('statWrong');
const timeLimitInput = document.getElementById('timeLimitInput');
const orientationWhite = document.getElementById('orientationWhite');
const orientationBlack = document.getElementById('orientationBlack');
const sessionBtn = document.getElementById('sessionBtn');
const sessionTimerEl = document.getElementById('sessionTimer');
const summaryOverlayEl = document.getElementById('summaryOverlay');
const summaryHeaderEl = document.getElementById('summaryHeader');
const summaryStatsEl = document.getElementById('summaryStats');
const summaryBodyEl = document.getElementById('summaryBody');
const summaryCloseBtn = document.getElementById('summaryCloseBtn');
const countdownOverlayEl = document.getElementById('countdownOverlay');
const rankLabelsEl = document.getElementById('rankLabels');
const fileLabelsEl = document.getElementById('fileLabels');
const settingsBtn = document.getElementById('settingsBtn');
const settingsOverlayEl = document.getElementById('settingsOverlay');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const showCoordinatesInput = document.getElementById('showCoordinates');

let flipped = false;   // false = White at bottom (standard), true = Black at bottom
let target = null;     // current correct square, e.g. "e4"
let targetShownAt = null;

let session = null;        // { startedAt, endedAt, attempts: [], misses: [] } while running, or after it ends
let timerInterval = null;
let summaryPopupTimeout = null;
let answerTimeout = null;
let timeLimitMs = DEFAULT_TIME_LIMIT_MS;
let lastRanks = null;      // ranks/fileOrder from the most recent buildBoard(), for
let lastFileOrder = null;  // re-rendering coordinate labels without rebuilding the board

function squareColor(file, rank) {
  // a1 is dark. file: 0-7 (a-h), rank: 1-8
  const fileIdx = files.indexOf(file);
  return (fileIdx + rank) % 2 === 0 ? 'dark' : 'light';
}

function updateBoardCaptions() {
  boardCaptionTop.textContent = flipped ? 'White' : 'Black';
  boardCaptionBottom.textContent = flipped ? 'Black' : 'White';
}

function buildBoard() {
  updateBoardCaptions();
  boardEl.innerHTML = '';
  // Determine row/col order based on orientation.
  // Standard (not flipped): rank 8 at top down to rank 1 at bottom, files a-h left to right.
  const ranks = flipped ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1];
  const fileOrder = flipped ? [...files].reverse() : files;

  ranks.forEach(rank => {
    fileOrder.forEach(file => {
      const sq = document.createElement('div');
      const name = file + rank;
      sq.className = 'sq ' + squareColor(file, rank);
      sq.dataset.square = name;

      const pieceCode = START_POSITION[name];
      if (pieceCode) {
        sq.insertAdjacentHTML('beforeend', PIECE_SVG[pieceCode]);
        sq.lastElementChild.classList.add('piece');
      }

      boardEl.appendChild(sq);
    });
  });

  lastRanks = ranks;
  lastFileOrder = fileOrder;
  updateCoordinateLabels(ranks, fileOrder);
}

function updateCoordinateLabels(ranks, fileOrder) {
  if (showCoordinatesInput.checked) {
    rankLabelsEl.innerHTML = ranks.map(r => `<span>${r}</span>`).join('');
    fileLabelsEl.innerHTML = fileOrder.map(f => `<span>${f}</span>`).join('');
  } else {
    rankLabelsEl.innerHTML = '';
    fileLabelsEl.innerHTML = '';
  }
}

function pickTarget() {
  const file = files[Math.floor(Math.random() * 8)];
  const rank = Math.floor(Math.random() * 8) + 1;
  const name = file + '' + rank;
  // avoid repeating the same square twice in a row
  if (name === target) return pickTarget();
  target = name;
  targetShownAt = Date.now();
  highlightTarget();

  clearTimeout(answerTimeout);
  answerTimeout = setTimeout(handleTimeout, timeLimitMs);
}

function handleTimeout() {
  if (!session || session.endedAt || !target) return;
  const elapsedMs = Date.now() - targetShownAt;
  feedbackEl.textContent = `Too slow — that was ${target}`;
  feedbackEl.className = 'wrong';
  registerMiss(target, null, elapsedMs);
}

function highlightTarget() {
  document.querySelectorAll('.sq').forEach(el => {
    el.classList.remove('target', 'flash-correct', 'flash-wrong');
  });
  const el = document.querySelector(`.sq[data-square="${target}"]`);
  if (el) el.classList.add('target');
}

function updateLiveCounts() {
  statRight.textContent = session ? session.attempts.length : 0;
  statWrong.textContent = session ? session.misses.length : 0;
}

function registerMiss(square, guess, elapsedMs) {
  session.misses.push({ square, guess, elapsedMs });
  flashResult(false);
  updateLiveCounts();
  answerInput.value = '';

  setTimeout(() => {
    if (!session || session.endedAt) return;
    if (session.misses.length >= STRIKE_LIMIT) {
      endSession();
    } else {
      pickTarget();
    }
  }, 900);
}

function flashResult(isCorrect) {
  const el = document.querySelector(`.sq[data-square="${target}"]`);
  if (el) {
    el.classList.remove('target');
    el.classList.add(isCorrect ? 'flash-correct' : 'flash-wrong');
  }
}

function beginCountdown() {
  timeLimitMs = parseInt(timeLimitInput.value, 10) || DEFAULT_TIME_LIMIT_MS;
  timeLimitInput.disabled = true;
  sessionBtn.disabled = true;
  answerInput.disabled = true;
  answerInput.value = '';

  feedbackEl.textContent = '';
  feedbackEl.className = '';
  clearTimeout(summaryPopupTimeout);
  summaryOverlayEl.hidden = true;

  buildBoard();
  runCountdownStep(COUNTDOWN_START);
}

function runCountdownStep(n) {
  countdownOverlayEl.innerHTML = `<span class="tick">${n}</span>`;
  countdownOverlayEl.hidden = false;

  setTimeout(() => {
    if (n > 1) {
      runCountdownStep(n - 1);
    } else {
      countdownOverlayEl.hidden = true;
      // Brief pause on the plain board before the first target lights up,
      // so the eye has a moment to settle after the overlay disappears
      // instead of jumping straight from "1" to a highlighted square.
      setTimeout(() => {
        sessionBtn.disabled = false;
        startSession();
      }, POST_COUNTDOWN_DELAY_MS);
    }
  }, COUNTDOWN_STEP_MS);
}

function startSession() {
  session = { startedAt: Date.now(), endedAt: null, attempts: [], misses: [] };
  updateLiveCounts();

  answerInput.disabled = false;
  sessionBtn.textContent = 'Stop';

  pickTarget();
  answerInput.focus();
  startTimer();
}

function endSession() {
  if (!session || session.endedAt) return;
  clearTimeout(answerTimeout);
  session.endedAt = Date.now();
  stopTimer();

  timeLimitInput.disabled = false;
  sessionBtn.textContent = 'Start';

  target = null;
  targetShownAt = null;
  document.querySelectorAll('.sq').forEach(el => {
    el.classList.remove('target', 'flash-correct', 'flash-wrong');
  });
  answerInput.value = '';
  answerInput.focus();

  renderSummary();
  summaryPopupTimeout = setTimeout(() => {
    summaryOverlayEl.hidden = false;
  }, SUMMARY_POPUP_DELAY_MS);
}

function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function updateTimerDisplay() {
  const elapsedSeconds = Math.floor((Date.now() - session.startedAt) / 1000);
  const mm = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const ss = String(elapsedSeconds % 60).padStart(2, '0');
  sessionTimerEl.textContent = `${mm}:${ss}`;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
}

function formatMs(ms) {
  return (ms / 1000).toFixed(1) + 's';
}

function formatSquareList(rows) {
  return rows.map(r => r.square).join(', ');
}

function statRow(label, value) {
  return `<div class="statLabel">${label}</div><div class="statValue">${value}</div>`;
}

function describeMiss(miss) {
  return miss.guess ? `${miss.square} (typed ${miss.guess})` : `${miss.square} (timed out)`;
}

function renderSummary() {
  const attempts = session.attempts;
  const misses = session.misses;
  const duration = session.endedAt - session.startedAt;
  const endedBy = misses.length >= STRIKE_LIMIT ? 'struck out' : 'stopped manually';

  summaryHeaderEl.innerHTML =
    `${formatDuration(duration)} · ${attempts.length} right · ${misses.length} wrong · ${endedBy}` +
    (misses.length ? `<br>${misses.map(describeMiss).join(', ')}` : '');

  const perSquare = {};
  attempts.forEach(a => {
    if (!perSquare[a.square]) {
      perSquare[a.square] = { count: 0, totalMs: 0, maxMs: 0 };
    }
    const s = perSquare[a.square];
    s.count++;
    s.totalMs += a.elapsedMs;
    s.maxMs = Math.max(s.maxMs, a.elapsedMs);
  });

  const rows = Object.keys(perSquare).map(square => {
    const s = perSquare[square];
    return {
      square,
      count: s.count,
      avgMs: s.totalMs / s.count,
      maxMs: s.maxMs,
    };
  });

  rows.sort((a, b) => b.avgMs - a.avgMs);

  const totalAnswered = attempts.length + misses.length;
  const accuracyText = totalAnswered
    ? `${Math.round((attempts.length / totalAnswered) * 100)}%`
    : '—';

  let statsHtml = statRow('Accuracy', accuracyText);

  if (rows.length) {
    const overallAvgMs = rows.reduce((sum, r) => sum + r.avgMs, 0) / rows.length;
    const bySpeed = [...rows].sort((a, b) => a.avgMs - b.avgMs);
    const mostDifficult = rows.slice(0, 3);
    const leastDifficult = bySpeed.slice(0, 3);

    statsHtml += statRow('Average time', formatMs(overallAvgMs));
    statsHtml += statRow('Most difficult', formatSquareList(mostDifficult));
    statsHtml += statRow('Least difficult', formatSquareList(leastDifficult));
  }

  summaryStatsEl.innerHTML = statsHtml;

  summaryBodyEl.innerHTML = '';
  rows.forEach(row => {
    const tr = document.createElement('tr');
    if (row.avgMs > SLOW_THRESHOLD_MS) tr.classList.add('slow');
    tr.innerHTML = `
      <td>${row.square}</td>
      <td>${row.count}</td>
      <td>${formatMs(row.avgMs)}</td>
      <td>${formatMs(row.maxMs)}</td>
    `;
    summaryBodyEl.appendChild(tr);
  });
}

answerForm.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!session || session.endedAt) {
    beginCountdown();
    return;
  }

  const guess = answerInput.value.trim().toLowerCase();
  if (!guess) return;

  if (!SQUARE_NAME_RE.test(guess)) {
    feedbackEl.textContent = `"${guess}" isn't a square name — try again`;
    feedbackEl.className = 'warn';
    answerInput.value = '';
    return;
  }

  clearTimeout(answerTimeout);

  const answeredAt = Date.now();
  const elapsedMs = answeredAt - targetShownAt;
  const isCorrect = guess === target;

  if (isCorrect) {
    session.attempts.push({ square: target, shownAt: targetShownAt, answeredAt, elapsedMs });
    feedbackEl.textContent = 'Correct — ' + target;
    feedbackEl.className = 'correct';
    flashResult(true);
    updateLiveCounts();
    answerInput.value = '';
    setTimeout(() => {
      if (session && !session.endedAt) pickTarget();
    }, 350);
  } else {
    feedbackEl.textContent = `Wrong — that was ${target}, you said ${guess}`;
    feedbackEl.className = 'wrong';
    registerMiss(target, guess, elapsedMs);
  }
});

sessionBtn.addEventListener('click', () => {
  if (!session || session.endedAt) {
    beginCountdown();
  } else {
    endSession();
  }
});

function setOrientation(newFlipped) {
  if (flipped === newFlipped) return;
  flipped = newFlipped;
  buildBoard();
  if (target) highlightTarget();
  answerInput.focus();
}

orientationWhite.addEventListener('change', () => setOrientation(false));
orientationBlack.addEventListener('change', () => setOrientation(true));

showCoordinatesInput.addEventListener('change', () => {
  updateCoordinateLabels(lastRanks, lastFileOrder);
});

summaryCloseBtn.addEventListener('click', () => {
  summaryOverlayEl.hidden = true;
});

summaryOverlayEl.addEventListener('click', (e) => {
  if (e.target === summaryOverlayEl) summaryOverlayEl.hidden = true;
});

settingsBtn.addEventListener('click', () => {
  settingsOverlayEl.hidden = false;
});

settingsCloseBtn.addEventListener('click', () => {
  settingsOverlayEl.hidden = true;
});

settingsOverlayEl.addEventListener('click', (e) => {
  if (e.target === settingsOverlayEl) settingsOverlayEl.hidden = true;
});

// init — idle until Start is pressed
buildBoard();
updateLiveCounts();
answerInput.focus();
