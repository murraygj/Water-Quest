/* ============================================================
   WATER QUEST — game.js
   Complete game logic with difficulty modes and DOM-based cans
   ============================================================ */

// ---- Difficulty Configuration ----
const DIFFICULTY_SETTINGS = {
  easy: {
    label: 'EASY',
    duration: 75,
    lives: 5,
    canLifespanMin: 1400,
    canLifespanRange: 400,
    redProbStart: 0.10,
    redProbEnd: 0.25,
    spawnRampFactor: 1.2,
    pointsPerCan: 10,
    comboThreshold: 3,
    comboMultiplier: 2,
    description: 'More time, more lives. Perfect for learning the ropes.'
  },
  normal: {
    label: 'NORMAL',
    duration: 60,
    lives: 3,
    canLifespanMin: 900,
    canLifespanRange: 300,
    redProbStart: 0.20,
    redProbEnd: 0.40,
    spawnRampFactor: 1.4,
    pointsPerCan: 10,
    comboThreshold: 3,
    comboMultiplier: 2,
    description: 'The standard challenge. 60 seconds, 3 lives.'
  },
  hard: {
    label: 'HARD',
    duration: 45,
    lives: 2,
    canLifespanMin: 600,
    canLifespanRange: 300,
    redProbStart: 0.35,
    redProbEnd: 0.55,
    spawnRampFactor: 1.7,
    pointsPerCan: 15,
    comboThreshold: 5,
    comboMultiplier: 3,
    description: 'Less time, fewer lives, faster cans. Prove yourself.'
  }
};

let currentDifficulty = 'normal';

// ---- DOM References ----
const startScreen    = document.getElementById('start-screen');
const gameplayScreen = document.getElementById('gameplay-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const milestoneModal = document.getElementById('milestone-modal');

const startHighScore = document.getElementById('start-high-score');
const hudScoreValue  = document.getElementById('hud-score-value');
const hudTimeValue   = document.getElementById('hud-time-value');
const hudTimeBox     = document.querySelector('.hud-time');
const livesDisplay   = document.getElementById('lives-display');
const comboBadge     = document.getElementById('combo-badge');
const feedbackToast  = document.getElementById('feedback-toast');
const gameGrid       = document.getElementById('game-grid');

const milestoneThreshold = document.getElementById('milestone-threshold');
const milestoneImpact    = document.getElementById('milestone-impact');
const milestoneResume    = document.getElementById('milestone-resume');

const causeBanner    = document.getElementById('cause-banner');
const finalScoreVal  = document.getElementById('final-score-value');
const bestScoreEl    = document.getElementById('best-score');
const newRecordEl    = document.getElementById('new-record');
const impactCard     = document.getElementById('impact-card');
const difficultyBadge = document.getElementById('difficulty-badge');
const difficultyDesc  = document.getElementById('difficulty-desc');

const btnTapToPlay   = document.getElementById('btn-tap-to-play');
const btnHowToPlay   = document.getElementById('btn-how-to-play');
const btnCloseHow    = document.getElementById('btn-close-how');
const btnPause       = document.getElementById('btn-pause');
const btnResume      = document.getElementById('btn-resume');
const btnPlayAgain   = document.getElementById('btn-play-again');
const btnShare       = document.getElementById('btn-share');

const pauseOverlay   = document.getElementById('pause-overlay');
const howToPlayOverlay = document.getElementById('how-to-play-overlay');

// ---- Game State ----
let score = 0;
let lives = 3;
let timer = 60;
let combo = 0;
let isPaused = false;
let isGameRunning = false;

let timerInterval = null;
let spawnInterval = null;
let currentSpawnRate = null;

let milestonesFired = { 50: false, 100: false, 200: false, 300: false };
let activeCans = [];
let gridSize = 9;
let toastTimeout = null;

// ---- Per-Difficulty High Scores ----
function getHighScore(difficulty) {
  const d = difficulty || currentDifficulty;
  return parseInt(localStorage.getItem('waterquest_highscore_' + d) || '0', 10);
}

function setHighScore(val, difficulty) {
  const d = difficulty || currentDifficulty;
  localStorage.setItem('waterquest_highscore_' + d, val.toString());
}

// ---- Milestone Persistence ----
function getReachedMilestones() {
  try {
    return JSON.parse(localStorage.getItem('waterquest_milestones') || '{}');
  } catch { return {}; }
}

function saveReachedMilestone(threshold) {
  const reached = getReachedMilestones();
  reached[threshold] = true;
  localStorage.setItem('waterquest_milestones', JSON.stringify(reached));
}

// ---- Sidebar References ----
const sidebarStart    = document.getElementById('sidebar-start');
const sidebarGameplay = document.getElementById('sidebar-gameplay');
const sidebarGameover = document.getElementById('sidebar-gameover');
const sidebarImpact   = document.getElementById('sidebar-impact');
const sidebarCombo    = document.getElementById('sidebar-combo');

// ---- Screen Management ----
function showScreen(screen) {
  [startScreen, gameplayScreen, gameoverScreen].forEach(s => s.classList.remove('active'));
  screen.classList.add('active');

  [sidebarStart, sidebarGameplay, sidebarGameover].forEach(p => p.classList.remove('active'));
  if (screen === startScreen) sidebarStart.classList.add('active');
  else if (screen === gameplayScreen) sidebarGameplay.classList.add('active');
  else if (screen === gameoverScreen) sidebarGameover.classList.add('active');
}

// ---- Update Sidebar Stats ----
function updateSidebar() {
  if (sidebarImpact) sidebarImpact.textContent = Math.floor(score / 10) + ' months';
  if (sidebarCombo) sidebarCombo.textContent = combo;
}

// ---- Determine Grid Size ----
function getGridColumns() {
  return window.innerWidth >= 768 ? 4 : 3;
}

// ---- Build Grid ----
function buildGrid() {
  const cols = getGridColumns();
  gridSize = cols * cols;
  gameGrid.innerHTML = '';
  for (let i = 0; i < gridSize; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.dataset.index = i;
    cell.addEventListener('click', () => onCellTap(i));
    cell.addEventListener('touchstart', (e) => {
      e.preventDefault();
      onCellTap(i);
    }, { passive: false });
    gameGrid.appendChild(cell);
  }
}

// ---- Build Lives Display ----
function buildLives() {
  const settings = DIFFICULTY_SETTINGS[currentDifficulty];
  livesDisplay.innerHTML = '';
  for (let i = 0; i < settings.lives; i++) {
    const span = document.createElement('span');
    span.className = 'life active';
    span.innerHTML = '&#x1F4A7;';
    livesDisplay.appendChild(span);
  }
}

// ---- Update HUD ----
function updateHUD() {
  const settings = DIFFICULTY_SETTINGS[currentDifficulty];
  hudScoreValue.textContent = score;
  hudTimeValue.textContent = timer + 's';

  if (timer <= 10) {
    hudTimeBox.classList.add('urgent');
  } else {
    hudTimeBox.classList.remove('urgent');
  }

  const lifeEls = livesDisplay.querySelectorAll('.life');
  lifeEls.forEach((el, i) => {
    el.classList.toggle('depleted', i >= lives);
    el.classList.toggle('active', i < lives);
  });

  if (combo >= settings.comboThreshold) {
    comboBadge.textContent = '\u00d7' + settings.comboMultiplier;
    comboBadge.classList.remove('hidden');
  } else {
    comboBadge.classList.add('hidden');
  }

  updateSidebar();
}

// ---- Feedback Toast ----
function showToast(message, type) {
  if (toastTimeout) clearTimeout(toastTimeout);
  feedbackToast.textContent = message;
  feedbackToast.className = 'feedback-toast ' + type;

  toastTimeout = setTimeout(() => {
    feedbackToast.classList.add('fading');
    setTimeout(() => {
      feedbackToast.className = 'feedback-toast';
    }, 300);
  }, 800);
}

// ---- Floating Score Text ----
function showFloatingScore(cell, points) {
  const floater = document.createElement('div');
  floater.className = 'floating-score';
  floater.textContent = '+' + points;
  cell.appendChild(floater);

  // Remove after animation
  floater.addEventListener('animationend', () => floater.remove());
}

// ---- Milestone Check ----
const milestoneMessages = {
  50:  "That's 6 months of clean water for one person!",
  100: "That's 1 year of clean water for one person! Keep going!",
  200: "That's clean water for an entire family for 6 months!",
  300: "That's clean water for a whole classroom of children!"
};

function checkMilestones() {
  const thresholds = [50, 100, 200, 300];
  const previouslyReached = getReachedMilestones();
  for (const t of thresholds) {
    if (score >= t && !milestonesFired[t]) {
      milestonesFired[t] = true;
      if (!previouslyReached[t]) {
        saveReachedMilestone(t);
        showMilestone(t);
        return;
      }
    }
  }
}

function showMilestone(threshold) {
  pauseGameLoop();
  milestoneThreshold.textContent = 'Reached ' + threshold + ' pts!';
  milestoneImpact.textContent = 'In charity: water terms, ' + milestoneMessages[threshold];
  milestoneResume.textContent = 'Resuming in 2s...';
  milestoneModal.classList.remove('hidden');
  gameGrid.style.opacity = '0.2';

  setTimeout(() => {
    milestoneModal.classList.add('hidden');
    gameGrid.style.opacity = '1';
    if (isGameRunning) resumeGameLoop();
  }, 2000);
}

// ---- Can Spawning (Difficulty-Aware) ----
function getEmptyCells() {
  const occupied = new Set(activeCans.map(c => c.cellIndex));
  const empty = [];
  for (let i = 0; i < gridSize; i++) {
    if (!occupied.has(i)) empty.push(i);
  }
  return empty;
}

function getRedProbability() {
  const settings = DIFFICULTY_SETTINGS[currentDifficulty];
  const elapsed = settings.duration - timer;
  const progress = elapsed / settings.duration;
  return settings.redProbStart + progress * (settings.redProbEnd - settings.redProbStart);
}

function getSpawnCount() {
  const settings = DIFFICULTY_SETTINGS[currentDifficulty];
  const timeLeft = timer;
  const finalPhase = settings.duration * 0.33;

  if (timeLeft <= finalPhase * 0.5) return Math.min(3, Math.floor(gridSize / 3));
  if (timeLeft <= finalPhase) return 2;
  return 1;
}

function getSpawnRate() {
  // Return spawn interval in ms — uses discrete tiers to avoid
  // resetting the interval every tick (which kills the spawn loop)
  const settings = DIFFICULTY_SETTINGS[currentDifficulty];
  const timeLeft = timer;
  const d = settings.duration;

  if (currentDifficulty === 'easy') {
    if (timeLeft <= d * 0.15) return 700;
    if (timeLeft <= d * 0.33) return 900;
    if (timeLeft <= d * 0.66) return 1100;
    return 1300;
  } else if (currentDifficulty === 'hard') {
    if (timeLeft <= d * 0.15) return 400;
    if (timeLeft <= d * 0.33) return 550;
    if (timeLeft <= d * 0.66) return 700;
    return 850;
  } else {
    // normal
    if (timeLeft <= d * 0.15) return 550;
    if (timeLeft <= d * 0.33) return 700;
    if (timeLeft <= d * 0.66) return 900;
    return 1100;
  }
}

function getCanLifespan() {
  const settings = DIFFICULTY_SETTINGS[currentDifficulty];
  return settings.canLifespanMin + Math.random() * settings.canLifespanRange;
}

function spawnCans() {
  if (isPaused || !isGameRunning) return;

  const emptyCells = getEmptyCells();
  if (emptyCells.length === 0) return;

  const count = Math.min(getSpawnCount(), emptyCells.length);
  const redProb = getRedProbability();

  // Shuffle empty cells
  for (let i = emptyCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [emptyCells[i], emptyCells[j]] = [emptyCells[j], emptyCells[i]];
  }

  for (let n = 0; n < count; n++) {
    const cellIndex = emptyCells[n];
    const type = Math.random() < redProb ? 'red' : 'yellow';
    const cell = gameGrid.children[cellIndex];

    // Create can element (DOM insertion)
    const canEl = document.createElement('div');
    canEl.className = 'can-element can-' + type;
    const img = document.createElement('img');
    img.src = type === 'yellow' ? 'Jerry Can - CharityWater.svg' : 'Jerry Can - Red.svg';
    img.alt = type === 'yellow' ? 'Yellow jerry can' : 'Red contaminated jerry can';
    img.draggable = false;
    canEl.appendChild(img);
    cell.appendChild(canEl);

    // Add type class to cell for border glow
    cell.classList.add(type === 'yellow' ? 'yellow-can' : 'red-can');

    // Set expiry timeout
    const lifespan = getCanLifespan();
    const timeoutId = setTimeout(() => expireCan(cellIndex, type), lifespan);
    activeCans.push({ cellIndex, type, timeoutId });
  }
}

function expireCan(cellIndex, type) {
  activeCans = activeCans.filter(c => c.cellIndex !== cellIndex);
  const cell = gameGrid.children[cellIndex];
  if (!cell) return;

  if (type === 'yellow') {
    lives--;
    combo = 0;
    updateHUD();
    showToast('Missed! -1 life', 'penalty');

    // Shake animation then remove
    const canEl = cell.querySelector('.can-element');
    if (canEl) {
      canEl.classList.add('can-expire');
      setTimeout(() => {
        canEl.remove();
        cell.classList.remove('yellow-can', 'red-can');
      }, 300);
    } else {
      cell.classList.remove('yellow-can', 'red-can');
    }

    cell.classList.add('miss-shake');
    setTimeout(() => cell.classList.remove('miss-shake'), 300);

    if (lives <= 0) endGame('lives');
  } else {
    // Red expired — just remove quietly
    const canEl = cell.querySelector('.can-element');
    if (canEl) {
      canEl.classList.add('can-fade');
      setTimeout(() => {
        canEl.remove();
        cell.classList.remove('yellow-can', 'red-can');
      }, 200);
    } else {
      cell.classList.remove('yellow-can', 'red-can');
    }
  }
}

// ---- Cell Tap Handler ----
function onCellTap(index) {
  if (!isGameRunning || isPaused) return;

  const canData = activeCans.find(c => c.cellIndex === index);
  if (!canData) return;

  const cell = gameGrid.children[index];
  const settings = DIFFICULTY_SETTINGS[currentDifficulty];

  clearTimeout(canData.timeoutId);
  activeCans = activeCans.filter(c => c.cellIndex !== index);

  if (canData.type === 'yellow') {
    combo++;
    const multiplier = combo >= settings.comboThreshold ? settings.comboMultiplier : 1;
    const points = settings.pointsPerCan * multiplier;
    score += points;

    const msg = multiplier > 1
      ? '+' + points + ' \u{1F4A7} Combo x' + multiplier + '!'
      : '+' + settings.pointsPerCan + ' \u{1F4A7} Nice Tap!';
    showToast(msg, 'success');

    // Floating score text
    showFloatingScore(cell, points);

    // Collection animation: scale up then shrink
    const canEl = cell.querySelector('.can-element');
    if (canEl) {
      canEl.classList.add('can-collect');
      setTimeout(() => {
        canEl.remove();
        cell.classList.remove('yellow-can', 'red-can');
      }, 350);
    } else {
      cell.classList.remove('yellow-can', 'red-can');
    }

    cell.classList.add('tap-success');
    setTimeout(() => cell.classList.remove('tap-success'), 300);

    updateHUD();
    checkMilestones();

  } else {
    lives--;
    combo = 0;
    showToast('\u274C Wrong can! -1 life', 'penalty');

    // Penalty animation
    const canEl = cell.querySelector('.can-element');
    if (canEl) {
      canEl.classList.add('can-penalty');
      setTimeout(() => {
        canEl.remove();
        cell.classList.remove('yellow-can', 'red-can');
      }, 300);
    } else {
      cell.classList.remove('yellow-can', 'red-can');
    }

    cell.classList.add('tap-penalty');
    setTimeout(() => cell.classList.remove('tap-penalty'), 300);

    updateHUD();

    if (lives <= 0) endGame('lives');
  }
}

// ---- Timer ----
function startTimer() {
  timerInterval = setInterval(() => {
    if (isPaused) return;
    timer--;
    updateHUD();
    updateSpawnInterval();
    if (timer <= 0) endGame('time');
  }, 1000);
}

// ---- Spawn Interval Management ----
function startSpawnLoop() {
  spawnCans();
  currentSpawnRate = getSpawnRate();
  spawnInterval = setInterval(spawnCans, currentSpawnRate);
}

function updateSpawnInterval() {
  const newRate = getSpawnRate();
  if (newRate !== currentSpawnRate) {
    currentSpawnRate = newRate;
    if (spawnInterval) clearInterval(spawnInterval);
    spawnInterval = setInterval(spawnCans, currentSpawnRate);
  }
}

// ---- Pause / Resume ----
function pauseGameLoop() { isPaused = true; }
function resumeGameLoop() { isPaused = false; }

btnPause.addEventListener('click', () => {
  pauseGameLoop();
  pauseOverlay.classList.remove('hidden');
});

btnResume.addEventListener('click', () => {
  pauseOverlay.classList.add('hidden');
  resumeGameLoop();
});

// Pause menu: Return Home (abandon game without updating high score)
const btnPauseHome = document.getElementById('btn-pause-home');
btnPauseHome.addEventListener('click', () => {
  // Stop game without saving score
  isGameRunning = false;
  isPaused = false;
  if (timerInterval) clearInterval(timerInterval);
  if (spawnInterval) clearInterval(spawnInterval);
  activeCans.forEach(c => clearTimeout(c.timeoutId));
  activeCans = [];

  pauseOverlay.classList.add('hidden');
  milestoneModal.classList.add('hidden');

  // Update high score display and go home
  startHighScore.textContent = getHighScore();
  showScreen(startScreen);
});

// ---- Start Game ----
function startGame() {
  const settings = DIFFICULTY_SETTINGS[currentDifficulty];

  score = 0;
  lives = settings.lives;
  timer = settings.duration;
  combo = 0;
  isPaused = false;
  isGameRunning = true;
  milestonesFired = { 50: false, 100: false, 200: false, 300: false };
  activeCans = [];

  buildGrid();
  buildLives();
  updateHUD();
  feedbackToast.className = 'feedback-toast';
  comboBadge.classList.add('hidden');
  hudTimeBox.classList.remove('urgent');
  gameGrid.style.opacity = '1';

  showScreen(gameplayScreen);
  startTimer();
  startSpawnLoop();
}

// ---- End Game ----
function endGame(cause) {
  isGameRunning = false;

  if (timerInterval) clearInterval(timerInterval);
  if (spawnInterval) clearInterval(spawnInterval);

  activeCans.forEach(c => clearTimeout(c.timeoutId));
  activeCans = [];

  milestoneModal.classList.add('hidden');
  pauseOverlay.classList.add('hidden');

  const settings = DIFFICULTY_SETTINGS[currentDifficulty];
  const best = getHighScore();
  const isNewRecord = score > best;
  if (isNewRecord) setHighScore(score);
  const displayBest = isNewRecord ? score : best;

  causeBanner.textContent = cause === 'time' ? "TIME'S UP!" : "OUT OF LIVES!";
  finalScoreVal.textContent = score;
  bestScoreEl.textContent = 'Best: ' + displayBest + ' pts';

  // Difficulty badge
  if (difficultyBadge) {
    difficultyBadge.textContent = settings.label;
    difficultyBadge.className = 'difficulty-badge ' + currentDifficulty;
  }

  if (isNewRecord && score > 0) {
    newRecordEl.classList.remove('hidden');
  } else {
    newRecordEl.classList.add('hidden');
  }

  const months = Math.floor(score / 10);
  impactCard.textContent = 'Your score = ' + months + ' months of clean water for one family in Ethiopia.';

  showScreen(gameoverScreen);
}

// ---- Event Listeners ----
btnTapToPlay.addEventListener('click', startGame);

btnHowToPlay.addEventListener('click', () => {
  howToPlayOverlay.classList.remove('hidden');
});

btnCloseHow.addEventListener('click', () => {
  howToPlayOverlay.classList.add('hidden');
});

btnPlayAgain.addEventListener('click', startGame);

// Return Home
const btnHome = document.getElementById('btn-home');
const headerHome = document.getElementById('header-home');

function goHome() {
  isGameRunning = false;
  isPaused = false;
  if (timerInterval) clearInterval(timerInterval);
  if (spawnInterval) clearInterval(spawnInterval);
  activeCans.forEach(c => clearTimeout(c.timeoutId));
  activeCans = [];

  milestoneModal.classList.add('hidden');
  pauseOverlay.classList.add('hidden');

  startHighScore.textContent = getHighScore();
  showScreen(startScreen);
}

btnHome.addEventListener('click', goHome);
headerHome.addEventListener('click', goHome);

// Share
btnShare.addEventListener('click', () => {
  const months = Math.floor(score / 10);
  const settings = DIFFICULTY_SETTINGS[currentDifficulty];
  const text = 'I scored ' + score + ' pts on ' + settings.label + ' mode in Water Quest! That\'s ' + months +
    ' months of clean water. Play now and help bring clean water to everyone! \u{1F4A7}';

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      btnShare.textContent = 'Copied!';
      setTimeout(() => { btnShare.textContent = 'Share My Score'; }, 2000);
    });
  } else {
    prompt('Copy this message:', text);
  }
});

// ---- Difficulty Selector ----
const diffBtns = document.querySelectorAll('.diff-btn');

diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentDifficulty = btn.dataset.difficulty;

    // Update active state
    diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update description
    if (difficultyDesc) {
      difficultyDesc.textContent = DIFFICULTY_SETTINGS[currentDifficulty].description;
    }

    // Update high score for selected difficulty
    startHighScore.textContent = getHighScore();
  });
});

// ---- Init ----
startHighScore.textContent = getHighScore();
if (difficultyDesc) {
  difficultyDesc.textContent = DIFFICULTY_SETTINGS[currentDifficulty].description;
}
