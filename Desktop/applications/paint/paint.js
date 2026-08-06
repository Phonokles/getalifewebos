document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';

window.addEventListener('message', (e) => {
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
  }
});

const FS = (window.parent && window.parent.WebOSFS) ? window.parent.WebOSFS : null;
const PICTURES = 'Pictures';
const ART_W = 1000;
const ART_H = 700;

const need = (id) => document.getElementById(id);

const galleryEl = need('gallery');
const studioEl = need('studio');
const grid = need('gallery-grid');
const canvas = need('canvas');
const stage = need('stage');
const nameEl = need('filename');

// a stale cached paint.html would leave these missing and the app would just
// go black, so say what is wrong instead
const missing = ['gallery', 'studio', 'gallery-grid', 'canvas', 'stage', 'filename']
  .filter(id => !need(id));

if (missing.length) {
  document.body.innerHTML =
    '<div style="padding:20px;font:0.72rem/1.9 monospace;letter-spacing:1px;color:#ddd">' +
    'paint.html is out of date, missing: ' + missing.join(', ') +
    '<br><br>hard reload the page with ctrl+shift+r</div>';
  throw new Error('[paint] outdated paint.html, missing: ' + missing.join(', '));
}

const ctx = canvas.getContext('2d');

let color = '#141414';
let size = 5;
let alpha = 1;
let erasing = false;
let drawing = false;
let last = null;
let openedFrom = null;

const undoStack = [];
const redoStack = [];
const MAX_STEPS = 14;

function isImageFile(name) {
  return /\.(png|jpe?g|gif|webp)$/i.test(name);
}

function collect() {
  if (!FS) return [];
  const out = [];
  (function walk(path) {
    FS.list(path).forEach(item => {
      const full = path ? path + '/' + item.name : item.name;
      if (item.type === 'folder') return walk(full);
      if (!isImageFile(item.name)) return;
      const content = FS.readFile(full) || '';
      if (content.startsWith('data:image')) out.push({ name: item.name, src: content, path: full });
    });
  })('');
  return out;
}

function renderGallery() {
  const items = collect();

  const cards = [`
    <button class="card new" id="card-new">
      <span class="card-thumb">+</span>
      <span class="card-name">new canvas</span>
    </button>`];

  items.forEach((_, i) => cards.push(`
    <button class="card" data-i="${i}">
      <span class="card-thumb"></span>
      <span class="card-name"></span>
    </button>`));

  grid.innerHTML = cards.join('');

  grid.querySelectorAll('.card[data-i]').forEach(el => {
    const item = items[parseInt(el.dataset.i, 10)];
    el.querySelector('.card-thumb').style.backgroundImage = `url("${item.src}")`;
    el.querySelector('.card-name').textContent = item.name;
    el.addEventListener('click', () => openCanvas(item));
  });

  document.getElementById('card-new').addEventListener('click', () => openCanvas(null));
}

function showGallery() {
  studioEl.classList.add('hidden');
  galleryEl.classList.remove('hidden');
  renderGallery();
}

function openCanvas(item) {
  galleryEl.classList.add('hidden');
  studioEl.classList.remove('hidden');

  openedFrom = item ? item.path : null;
  nameEl.value = item ? item.name : nextName();

  undoStack.length = 0;
  redoStack.length = 0;

  requestAnimationFrame(() => {
    if (item) {
      const img = new Image();
      img.onload = () => {
        newArtboard(img.naturalWidth || ART_W, img.naturalHeight || ART_H);
        ctx.drawImage(img, 0, 0);
        pushUndo();
        updateUndoButtons();
      };
      img.src = item.src;
    } else {
      newArtboard(ART_W, ART_H);
      pushUndo();
    }
    updateUndoButtons();
  });
}

function nextName() {
  const taken = collect().map(i => i.name);
  let n = 1;
  while (taken.includes(`drawing${n}.png`)) n++;
  return `drawing${n}.png`;
}

// the drawing has its own fixed resolution. the window only scales how it is
// shown, so resizing never touches a single pixel
function newArtboard(w, h) {
  canvas.width = w;
  canvas.height = h;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}


function pushUndo() {
  if (!canvas.width) return;
  undoStack.push(canvas.toDataURL());
  if (undoStack.length > MAX_STEPS) undoStack.shift();
  redoStack.length = 0;
  updateUndoButtons();
}

function restore(url) {
  const img = new Image();
  img.onload = () => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };
  img.src = url;
}

function updateUndoButtons() {
  document.getElementById('btn-undo').disabled = undoStack.length < 2;
  document.getElementById('btn-redo').disabled = redoStack.length === 0;
}

document.getElementById('btn-undo').addEventListener('click', () => {
  if (undoStack.length < 2) return;
  redoStack.push(undoStack.pop());
  restore(undoStack[undoStack.length - 1]);
  updateUndoButtons();
});

document.getElementById('btn-redo').addEventListener('click', () => {
  const url = redoStack.pop();
  if (!url) return;
  undoStack.push(url);
  restore(url);
  updateUndoButtons();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  pushUndo();
});

function pos(e) {
  const r = canvas.getBoundingClientRect();
  const sx = r.width ? canvas.width / r.width : 1;
  const sy = r.height ? canvas.height / r.height : 1;
  return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
}

function stroke(from, to) {
  ctx.globalAlpha = erasing ? 1 : alpha;
  ctx.strokeStyle = erasing ? '#ffffff' : color;
  ctx.lineWidth = erasing ? size * 2.2 : size;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

canvas.addEventListener('pointerdown', (e) => {
  drawing = true;
  last = pos(e);
  stroke(last, { x: last.x + 0.01, y: last.y });
  canvas.setPointerCapture?.(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const p = pos(e);
  stroke(last, p);
  last = p;
});

function endStroke() {
  if (!drawing) return;
  drawing = false;
  pushUndo();
}

canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);

function setupSlider(el, min, max, initial, onChange) {
  const fill = el.querySelector('.slider-fill');
  let value = initial;

  const apply = () => {
    fill.style.height = ((value - min) / (max - min)) * 100 + '%';
    onChange(value);
  };

  const fromEvent = (e) => {
    const r = el.getBoundingClientRect();
    const t = 1 - (e.clientY - r.top) / r.height;
    value = Math.round((min + Math.max(0, Math.min(1, t)) * (max - min)) * 100) / 100;
    apply();
  };

  let dragging = false;

  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    el.setPointerCapture?.(e.pointerId);
    fromEvent(e);
  });
  el.addEventListener('pointermove', (e) => {
    if (dragging) fromEvent(e);
  });
  el.addEventListener('pointerup', () => { dragging = false; });
  el.addEventListener('pointercancel', () => { dragging = false; });

  apply();
}

setupSlider(document.getElementById('slider-size'), 1, 60, 5, (v) => {
  size = v;
  document.getElementById('size-label').textContent = Math.round(v);
});

setupSlider(document.getElementById('slider-alpha'), 0.05, 1, 1, (v) => {
  alpha = v;
  document.getElementById('alpha-label').textContent = Math.round(v * 100);
});

const palette = document.getElementById('palette');
const svArea = document.getElementById('pick-sv');
const svDot = document.getElementById('sv-dot');
const hueBar = document.getElementById('pick-hue');
const hueMark = document.getElementById('hue-bar');
const preview = document.getElementById('pick-preview');
const hexInput = document.getElementById('pick-hex');

let hue = 0, sat = 0, val = 0.08;

function hsvToHex(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return '#' + f(5) + f(3) + f(1);
}

function hexToHsv(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: (h + 360) % 360, s: max ? d / max : 0, v: max };
}

function paintPicker() {
  color = hsvToHex(hue, sat, val);
  svArea.style.background =
    `linear-gradient(to top, #000, rgba(0,0,0,0)), ` +
    `linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`;
  svDot.style.left = sat * 100 + '%';
  svDot.style.top = (1 - val) * 100 + '%';
  hueMark.style.left = (hue / 360) * 100 + '%';
  preview.style.background = color;
  document.getElementById('swatch-dot').style.background = color;
  if (document.activeElement !== hexInput) hexInput.value = color;
}

function dragArea(el, onMove) {
  let dragging = false;
  const handle = (e) => {
    const r = el.getBoundingClientRect();
    onMove(
      r.width ? Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) : 0,
      r.height ? Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) : 0
    );
  };
  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    el.setPointerCapture?.(e.pointerId);
    handle(e);
  });
  el.addEventListener('pointermove', (e) => { if (dragging) handle(e); });
  el.addEventListener('pointerup', () => { dragging = false; });
  el.addEventListener('pointercancel', () => { dragging = false; });
}

dragArea(svArea, (x, y) => {
  sat = x;
  val = 1 - y;
  paintPicker();
  setTool(false);
});

dragArea(hueBar, (x) => {
  hue = x * 360;
  paintPicker();
  setTool(false);
});

hexInput.addEventListener('input', () => {
  const hsv = hexToHsv(hexInput.value);
  if (!hsv) return;
  hue = hsv.h; sat = hsv.s; val = hsv.v;
  paintPicker();
});

function setTool(eraser) {
  erasing = eraser;
  document.getElementById('tool-brush').classList.toggle('active', !eraser);
  document.getElementById('tool-eraser').classList.toggle('active', eraser);
}

document.getElementById('tool-brush').addEventListener('click', () => setTool(false));
document.getElementById('tool-eraser').addEventListener('click', () => setTool(true));

document.getElementById('tool-color').addEventListener('click', () => {
  palette.classList.toggle('open');
});

document.getElementById('to-gallery').addEventListener('click', () => {
  save();
  showGallery();
});

function fileName() {
  let name = nameEl.value.trim() || 'drawing.png';
  if (!/\.png$/i.test(name)) name += '.png';
  return name;
}

function save() {
  if (!FS || !canvas.width) return;

  if (!FS.exists(PICTURES)) FS.createFolder('', PICTURES);

  const name = fileName();
  const path = PICTURES + '/' + name;
  if (openedFrom && openedFrom !== path) FS.remove(openedFrom);
  FS.writeFile(PICTURES, name, canvas.toDataURL('image/png'));
  openedFrom = path;
}

document.getElementById('tool-save').addEventListener('click', (e) => {
  save();
  const btn = e.currentTarget;
  btn.classList.add('active');
  setTimeout(() => btn.classList.remove('active'), 700);
});

paintPicker();
setTool(false);
showGallery();