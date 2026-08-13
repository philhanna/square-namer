const files = ['a','b','c','d','e','f','g','h'];
const boardEl = document.getElementById('board');
const answerForm = document.getElementById('answerForm');
const answerInput = document.getElementById('answerInput');
const feedbackEl = document.getElementById('feedback');
const statStreak = document.getElementById('statStreak');
const statAcc = document.getElementById('statAcc');
const statCount = document.getElementById('statCount');
const flipBtn = document.getElementById('flipBtn');
const resetBtn = document.getElementById('resetBtn');

let flipped = false;   // false = White at bottom (standard), true = Black at bottom
let target = null;     // current correct square, e.g. "e4"
let streak = 0;
let correctCount = 0;
let attemptCount = 0;

function squareColor(file, rank) {
  // a1 is dark. file: 0-7 (a-h), rank: 1-8
  const fileIdx = files.indexOf(file);
  return (fileIdx + rank) % 2 === 0 ? 'dark' : 'light';
}

function buildBoard() {
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

answerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const guess = answerInput.value.trim().toLowerCase();
  if (!guess) return;

  attemptCount++;
  const isCorrect = guess === target;

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
    pickTarget();
  }, isCorrect ? 350 : 900);
});

flipBtn.addEventListener('click', () => {
  flipped = !flipped;
  flipBtn.textContent = flipped ? 'Flip board (play as White)' : 'Flip board (play as Black)';
  buildBoard();
  highlightTarget();
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

// init
buildBoard();
pickTarget();
updateStats();
answerInput.focus();
