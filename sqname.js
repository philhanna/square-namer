const SLOW_THRESHOLD_MS = 500;
const SQUARE_NAME_RE = /^[a-h][1-8]$/;
const SUMMARY_POPUP_DELAY_MS = 500;

const files = ['a','b','c','d','e','f','g','h'];
const boardEl = document.getElementById('board');
const boardCaptionTop = document.getElementById('boardCaptionTop');
const boardCaptionBottom = document.getElementById('boardCaptionBottom');
const answerForm = document.getElementById('answerForm');
const answerInput = document.getElementById('answerInput');
const feedbackEl = document.getElementById('feedback');
const statCount = document.getElementById('statCount');
const orientationWhite = document.getElementById('orientationWhite');
const orientationBlack = document.getElementById('orientationBlack');
const sessionBtn = document.getElementById('sessionBtn');
const sessionTimerEl = document.getElementById('sessionTimer');
const summaryOverlayEl = document.getElementById('summaryOverlay');
const summaryHeaderEl = document.getElementById('summaryHeader');
const summaryBodyEl = document.getElementById('summaryBody');
const summaryCloseBtn = document.getElementById('summaryCloseBtn');

let flipped = false;   // false = White at bottom (standard), true = Black at bottom
let target = null;     // current correct square, e.g. "e4"
let targetShownAt = null;

let session = null;        // { startedAt, endedAt, attempts: [], missed } while running, or after it ends
let timerInterval = null;
let summaryPopupTimeout = null;

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
      boardEl.appendChild(sq);
    });
  });
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
}

function highlightTarget() {
  document.querySelectorAll('.sq').forEach(el => {
    el.classList.remove('target', 'flash-correct', 'flash-wrong');
  });
  const el = document.querySelector(`.sq[data-square="${target}"]`);
  if (el) el.classList.add('target');
}

function updateLiveCount() {
  statCount.textContent = session ? session.attempts.length : 0;
}

function flashResult(isCorrect) {
  const el = document.querySelector(`.sq[data-square="${target}"]`);
  if (el) {
    el.classList.remove('target');
    el.classList.add(isCorrect ? 'flash-correct' : 'flash-wrong');
  }
}

function startSession() {
  session = { startedAt: Date.now(), endedAt: null, attempts: [], missed: null };
  feedbackEl.textContent = '';
  feedbackEl.className = '';
  updateLiveCount();

  clearTimeout(summaryPopupTimeout);
  summaryOverlayEl.hidden = true;
  answerInput.disabled = false;
  sessionBtn.textContent = 'Stop session';

  buildBoard();
  pickTarget();
  answerInput.focus();
  startTimer();
}

function endSession() {
  if (!session || session.endedAt) return;
  session.endedAt = Date.now();
  stopTimer();

  answerInput.disabled = true;
  sessionBtn.textContent = 'Start session';

  target = null;
  targetShownAt = null;
  document.querySelectorAll('.sq').forEach(el => {
    el.classList.remove('target', 'flash-correct', 'flash-wrong');
  });

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

function renderSummary() {
  const attempts = session.attempts;
  const duration = session.endedAt - session.startedAt;
  const outcome = session.missed
    ? `missed ${session.missed.square} (typed ${session.missed.guess || '(blank)'})`
    : 'stopped manually';

  summaryHeaderEl.textContent =
    `${formatDuration(duration)} · ${attempts.length} squares · ${outcome}`;

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
  if (!session || session.endedAt) return;

  const guess = answerInput.value.trim().toLowerCase();
  if (!guess) return;

  if (!SQUARE_NAME_RE.test(guess)) {
    feedbackEl.textContent = `"${guess}" isn't a square name — try again`;
    feedbackEl.className = 'warn';
    answerInput.value = '';
    return;
  }

  const answeredAt = Date.now();
  const elapsedMs = answeredAt - targetShownAt;
  const isCorrect = guess === target;

  if (isCorrect) {
    session.attempts.push({ square: target, shownAt: targetShownAt, answeredAt, elapsedMs });
    feedbackEl.textContent = 'Correct — ' + target;
    feedbackEl.className = 'correct';
  } else {
    session.missed = { square: target, guess, elapsedMs };
    feedbackEl.textContent = `Wrong — that was ${target}, you said ${guess}`;
    feedbackEl.className = 'wrong';
  }

  flashResult(isCorrect);
  updateLiveCount();
  answerInput.value = '';

  setTimeout(() => {
    if (isCorrect) {
      if (session && !session.endedAt) pickTarget();
    } else {
      endSession();
    }
  }, isCorrect ? 350 : 900);
});

sessionBtn.addEventListener('click', () => {
  if (!session || session.endedAt) {
    startSession();
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

summaryCloseBtn.addEventListener('click', () => {
  summaryOverlayEl.hidden = true;
});

summaryOverlayEl.addEventListener('click', (e) => {
  if (e.target === summaryOverlayEl) summaryOverlayEl.hidden = true;
});

// init — idle until Start is pressed
buildBoard();
updateLiveCount();
