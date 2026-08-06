document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';

window.addEventListener('message', (e) => {
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
  }
});

const parentWin = window.parent;
const FS = parentWin && parentWin.WebOSFS ? parentWin.WebOSFS : null;

const HISTORY = 70;
const loadHist = new Array(HISTORY).fill(0);
const fpsHist = new Array(HISTORY).fill(0);

const startedAt = Date.now();

let frames = 0;
let fps = 0;

function countFrame() {
  frames++;
  requestAnimationFrame(countFrame);
}
requestAnimationFrame(countFrame);

// timer drift is a decent stand-in for load: a busy main thread makes
// the interval fire late, and that lateness is what gets measured
let lastTick = performance.now();
let lag = 0;

setInterval(() => {
  const now = performance.now();
  const drift = Math.max(0, now - lastTick - 100);
  lastTick = now;
  lag = lag * 0.6 + drift * 0.4;
}, 100);

setInterval(() => {
  fps = frames;
  frames = 0;

  const load = Math.min(100, Math.round(lag * 2));
  loadHist.push(load);
  loadHist.shift();
  fpsHist.push(fps);
  fpsHist.shift();

  document.getElementById('load-val').textContent = load + '%';
  document.getElementById('fps-val').textContent = fps;

  drawGraph('load-canvas', loadHist, 100);
  drawGraph('fps-canvas', fpsHist, 70);
  updateMemory();
  updateSystem();
  updateWindows();
}, 1000);

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawGraph(id, data, max) {
  const canvas = document.getElementById(id);
  const ratio = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  if (!w || !h) return;

  if (canvas.width !== w * ratio || canvas.height !== h * ratio) {
    canvas.width = w * ratio;
    canvas.height = h * ratio;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const fg = css('--fg-rgb') || '255, 255, 255';
  const step = w / (data.length - 1);

  ctx.beginPath();
  ctx.moveTo(0, h);
  data.forEach((v, i) => {
    const y = h - Math.min(1, v / max) * (h - 2) - 1;
    ctx.lineTo(i * step, y);
  });
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = `rgba(${fg}, 0.08)`;
  ctx.fill();

  ctx.beginPath();
  data.forEach((v, i) => {
    const y = h - Math.min(1, v / max) * (h - 2) - 1;
    if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i * step, y);
  });
  ctx.strokeStyle = `rgba(${fg}, 0.6)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function mb(bytes) {
  return (bytes / 1048576).toFixed(1) + ' mb';
}

function updateMemory() {
  const mem = performance.memory;
  const bar = document.getElementById('mem-bar');

  if (!mem) {
    document.getElementById('mem-val').textContent = 'n/a';
    bar.style.width = '0%';
    return;
  }

  const used = mem.usedJSHeapSize;
  const limit = mem.jsHeapSizeLimit;
  const pct = Math.round((used / limit) * 100);

  document.getElementById('mem-val').textContent = pct + '%';
  document.getElementById('mem-sub').textContent = mb(used) + ' of ' + mb(limit);
  bar.style.width = pct + '%';
}

function fsStats() {
  if (!FS) return { files: 0, folders: 0, bytes: 0 };

  const stats = { files: 0, folders: 0, bytes: 0 };

  (function walk(path) {
    FS.list(path).forEach(item => {
      const full = path ? path + '/' + item.name : item.name;
      if (item.type === 'folder') {
        stats.folders++;
        walk(full);
      } else {
        stats.files++;
        stats.bytes += (FS.readFile(full) || '').length;
      }
    });
  })('');

  return stats;
}

function updateSystem() {
  const secs = Math.floor((Date.now() - startedAt) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;

  document.getElementById('uptime-val').textContent =
    (h ? h + 'h ' : '') + (h || m ? m + 'm ' : '') + s + 's';

  const fs = fsStats();
  const doc = parentWin.document;
  const workspace = doc.querySelector('.ws-dot.active')?.dataset.ws || '1';
  const layout = parentWin.localStorage.getItem('wmMode') || 'normal';

  const rows = [
    ['layout', layout],
    ['workspace', workspace],
    ['fs files', fs.files + ' in ' + fs.folders + ' folders'],
    ['fs size', (fs.bytes / 1024).toFixed(1) + ' kb'],
    ['screen', window.screen.width + 'x' + window.screen.height],
    ['cores', navigator.hardwareConcurrency || '?'],
  ];

  document.getElementById('sys-rows').innerHTML = rows
    .map(([k, v]) => `<div class="mon-row">${k}<b></b></div>`)
    .join('');

  document.querySelectorAll('#sys-rows .mon-row b').forEach((el, i) => {
    el.textContent = rows[i][1];
  });
}

function updateWindows() {
  const wins = [...parentWin.document.querySelectorAll('.app-window')];
  document.getElementById('win-count').textContent = wins.length;

  const list = document.getElementById('proc-list');

  if (!wins.length) {
    list.innerHTML = '<div class="mon-empty">no windows open [-_-]</div>';
    return;
  }

  list.innerHTML = wins.map((w, i) => `
    <div class="mon-proc">
      <span class="mon-proc-pid">${String(1000 + i * 7)}</span>
      <span class="mon-proc-name"></span>
      <span class="mon-proc-tag">ws ${w.dataset.workspace || '1'}${w.dataset.minimized === 'true' ? ' / hidden' : ''}</span>
    </div>
  `).join('');

  list.querySelectorAll('.mon-proc-name').forEach((el, i) => {
    el.textContent = (wins[i].dataset.app || 'window').replace('win-', '');
  });
}

updateSystem();
updateWindows();