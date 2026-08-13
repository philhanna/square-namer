const files = ['a','b','c','d','e','f','g','h'];
const boardEl = document.getElementById('board');
const boardCaptionTop = document.getElementById('boardCaptionTop');
const boardCaptionBottom = document.getElementById('boardCaptionBottom');
const answerForm = document.getElementById('answerForm');
const answerInput = document.getElementById('answerInput');
const feedbackEl = document.getElementById('feedback');
const statStreak = document.getElementById('statStreak');
const statAcc = document.getElementById('statAcc');
const statCount = document.getElementById('statCount');
const flipBtn = document.getElementById('flipBtn');
const resetBtn = document.getElementById('resetBtn');
const sessionBtn = document.getElementById('sessionBtn');
const sessionTimerEl = document.getElementById('sessionTimer');
const slowThresholdInput = document.getElementById('slowThresholdInput');
const sessionSummaryEl = document.getElementById('sessionSummary');
const summaryHeaderEl = document.getElementById('summaryHeader');
const summaryBodyEl = document.getElementById('summaryBody');

let flipped = false;   // false = White at bottom (standard), true = Black at bottom
let target = null;     // current correct square, e.g. "e4"
let targetShownAt = null;
let streak = 0;
let correctCount = 0;
let attemptCount = 0;

let session = null;        // { startedAt, endedAt, attempts: [] } while running, or after Stop
let slowThresholdMs = 600;
let timerInterval = null;

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

function updateStats() {
  statStreak.textContent = streak;
  statCount.textContent = attemptCount;
  statAcc.textContent = attemptCount === 0 ? '—' : Math.round((correctCount / attemptCount) * 100) + '%';
}

function flashResult(isCorrect) {
  const el = document.querySelector(`.sq[data-square="${target}"]`);
  if (el) {
    el.classList.remove('target');
    el.classList.add(isCorrect ? 'flash-correct' : 'flash-wrong');
  }
}

function startSession() {
  slowThresholdMs = parseInt(slowThresholdInput.value, 10) || 0;
  session = { startedAt: Date.now(), endedAt: null, attempts: [] };
  streak = 0;
  correctCount = 0;
  attemptCount = 0;
  feedbackEl.textContent = '';
  feedbackEl.className = '';
  updateStats();

  sessionSummaryEl.hidden = true;
  answerInput.disabled = false;
  slowThresholdInput.disabled = true;
  sessionBtn.textContent = 'Stop session';

  buildBoard();
  pickTarget();
  answerInput.focus();
  startTimer();
}

function stopSession() {
  if (!session || session.endedAt) return;
  session.endedAt = Date.now();
  stopTimer();

  answerInput.disabled = true;
  slowThresholdInput.disabled = false;
  sessionBtn.textContent = 'Start session';

  target = null;
  targetShownAt = null;
  document.querySelectorAll('.sq').forEach(el => {
    el.classList.remove('target', 'flash-correct', 'flash-wrong');
  });

  renderSummary();
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
  const totalAttempts = attempts.length;
  const totalCorrect = attempts.filter(a => a.correct).length;
  const overallAccuracy = totalAttempts === 0 ? null : totalCorrect / totalAttempts;
  const duration = session.endedAt - session.startedAt;

  summaryHeaderEl.textContent =
    `${formatDuration(duration)} · ${totalAttempts} attempts · ` +
    (overallAccuracy === null ? '—' : Math.round(overallAccuracy * 100) + '%') + ' accuracy';

  const perSquare = {};
  attempts.forEach(a => {
    if (!perSquare[a.square]) {
      perSquare[a.square] = { count: 0, correctCount: 0, totalMs: 0, maxMs: 0 };
    }
    const s = perSquare[a.square];
    s.count++;
    if (a.correct) s.correctCount++;
    s.totalMs += a.elapsedMs;
    s.maxMs = Math.max(s.maxMs, a.elapsedMs);
  });

  const rows = Object.keys(perSquare).map(square => {
    const s = perSquare[square];
    const accuracy = s.correctCount / s.count;
    const avgMs = s.totalMs / s.count;
    return {
      square,
      count: s.count,
      accuracy,
      avgMs,
      maxMs: s.maxMs,
      difficultyScore: avgMs / accuracy,
    };
  });

  rows.sort((a, b) => {
    if (a.difficultyScore === b.difficultyScore) return 0;
    return a.difficultyScore > b.difficultyScore ? -1 : 1;
  });

  summaryBodyEl.innerHTML = '';
  rows.forEach(row => {
    const tr = document.createElement('tr');
    if (row.avgMs > slowThresholdMs) tr.classList.add('slow');
    tr.innerHTML = `
      <td>${row.square}</td>
      <td>${row.count}</td>
      <td>${Math.round(row.accuracy * 100)}%</td>
      <td>${formatMs(row.avgMs)}</td>
      <td>${formatMs(row.maxMs)}</td>
    `;
    summaryBodyEl.appendChild(tr);
  });

  sessionSummaryEl.hidden = false;
}

answerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!session || session.endedAt) return;

  const guess = answerInput.value.trim().toLowerCase();
  if (!guess) return;

  const answeredAt = Date.now();
  const elapsedMs = answeredAt - targetShownAt;
  attemptCount++;
  const isCorrect = guess === target;

  session.attempts.push({
    square: target,
    shownAt: targetShownAt,
    answeredAt,
    elapsedMs,
    correct: isCorrect,
    guess,
  });

  if (isCorrect) {
    correctCount++;
    streak++;
    feedbackEl.textContent = 'Correct — ' + target;
    feedbackEl.className = 'correct';
  } else {
    streak = 0;
    feedbackEl.textContent = `Wrong — that was ${target}, you said ${guess || '(blank)'}`;
    feedbackEl.className = 'wrong';
  }

  flashResult(isCorrect);
  updateStats();
  answerInput.value = '';

  setTimeout(() => {
    if (session && !session.endedAt) pickTarget();
  }, isCorrect ? 350 : 900);
});

sessionBtn.addEventListener('click', () => {
  if (!session || session.endedAt) {
    startSession();
  } else {
    stopSession();
  }
});

flipBtn.addEventListener('click', () => {
  flipped = !flipped;
  flipBtn.textContent = flipped ? 'Flip board (play as White)' : 'Flip board (play as Black)';
  buildBoard();
  if (target) highlightTarget();
  answerInput.focus();
});

resetBtn.addEventListener('click', () => {
  streak = 0;
  correctCount = 0;
  attemptCount = 0;
  feedbackEl.textContent = '';
  feedbackEl.className = '';
  updateStats();
});

// init — idle until Start is pressed
buildBoard();
updateStats();
