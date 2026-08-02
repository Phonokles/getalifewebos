document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';

window.addEventListener('message', (e) => {
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
  }
});


const GRID = 21;                       // 21x21 cells
const canvas = document.getElementById('snake-canvas');
const ctx = canvas.getContext('2d');
const CELL = canvas.width / GRID;

const scoreEl = document.getElementById('snake-score');
const bestEl = document.getElementById('snake-best');
const overlay = document.getElementById('snake-overlay');
const overlayTitle = document.getElementById('snake-overlay-title');
const overlayText = document.getElementById('snake-overlay-text');

function color(alpha) {
  const fg = getComputedStyle(document.documentElement).getPropertyValue('--fg-rgb').trim();
  return `rgba(${fg}, ${alpha})`;
}

let snake, dir, nextDir, food, score, best, alive, paused, timer;

best = parseInt(localStorage.getItem('snakeBest') || '0', 10);
bestEl.textContent = best;

function reset() {
  const mid = Math.floor(GRID / 2);
  snake = [ { x: mid - 1, y: mid }, { x: mid, y: mid }, { x: mid + 1, y: mid } ];
  dir = { x: 1, y: 0 };          
  nextDir = dir;
  score = 0;
  scoreEl.textContent = 0;
  alive = true;
  paused = false;
  placeFood();
}

function placeFood() {
  do {
    food = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (snake.some(s => s.x === food.x && s.y === food.y));
}

function stepDelay() {
  return Math.max(70, 150 - score * 4);
}

function step() {
  dir = nextDir;
  const head = snake[snake.length - 1];
  const nx = head.x + dir.x;
  const ny = head.y + dir.y;

  // walls and self end the run
  if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID
      || snake.some(s => s.x === nx && s.y === ny)) {
    gameOver();
    return;
  }

  snake.push({ x: nx, y: ny });

  if (nx === food.x && ny === food.y) {
    score++;
    scoreEl.textContent = score;
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      localStorage.setItem('snakeBest', String(best));
    }
    placeFood();
  } else {
    snake.shift();               
  }

  draw();
  timer = setTimeout(step, stepDelay());
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = color(0.06);
  for (let x = 1; x < GRID; x++) {
    for (let y = 1; y < GRID; y++) {
      ctx.fillRect(x * CELL - 1, y * CELL - 1, 2, 2);
    }
  }

  // round apple instead of a square
  ctx.save();
  ctx.shadowColor = color(0.8);
  ctx.shadowBlur = 10;
  ctx.fillStyle = color(0.95);
  ctx.beginPath();
  ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, (CELL - 10) / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // same blocks as before, only with rounded corners
  snake.forEach((s, i) => {
    const t = (i + 1) / snake.length;
    ctx.fillStyle = color(0.25 + t * 0.7);
    roundRect(s.x * CELL + 2, s.y * CELL + 2, CELL - 4, CELL - 4, 4);
    ctx.fill();
  });
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function gameOver() {
  alive = false;
  clearTimeout(timer);
  overlayTitle.textContent = 'ded [x_x]';
  overlayText.innerHTML = `score ${score}${score >= best && score > 0 ? ' &middot; new best!' : ''}<br>press any key to try again`;
  overlay.classList.remove('hidden');
}

function start() {
  clearTimeout(timer);
  reset();
  overlay.classList.add('hidden');
  draw();
  timer = setTimeout(step, stepDelay());
}

function togglePause() {
  if (!alive) return;
  paused = !paused;
  if (paused) {
    clearTimeout(timer);
    overlayTitle.textContent = 'paused [-_-]';
    overlayText.textContent = 'space to continue';
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
    timer = setTimeout(step, stepDelay());
  }
}

const KEYS = {
  ArrowUp:    { x: 0, y: -1 }, w: { x: 0, y: -1 },
  ArrowDown:  { x: 0, y: 1 },  s: { x: 0, y: 1 },
  ArrowLeft:  { x: -1, y: 0 }, a: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },  d: { x: 1, y: 0 },
};

window.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault();
    if (alive) togglePause();
    else start();
    return;
  }

  if (!alive) {
    start();
    return;
  }

  const d = KEYS[e.key];
  if (!d) return;
  e.preventDefault();
  if (paused) togglePause();

  if (d.x === -dir.x && d.y === -dir.y) return;
  nextDir = d;
});

window.addEventListener('blur', () => {
  if (alive && !paused) togglePause();
});

reset();
alive = false;                     
draw();