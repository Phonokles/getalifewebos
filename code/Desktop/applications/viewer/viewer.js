document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';

const FS = (window.parent && window.parent.WebOSFS) ? window.parent.WebOSFS : null;

const WALLPAPERS = ['Nightforrest.jpg', 'dayforrest.jpg'];
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;

const imageEl = document.getElementById('image');
const emptyEl = document.getElementById('empty');
const stageEl = document.getElementById('stage');
const stripEl = document.getElementById('strip');

let items = [];
let index = -1;

function collect() {
  const found = WALLPAPERS.map(f => ({
    name: f,
    src: '../../../Wallpapers/' + f,
    from: 'wallpaper',
  }));

  if (FS) {
    (function walk(path) {
      FS.list(path).forEach(item => {
        const full = path ? path + '/' + item.name : item.name;
        if (item.type === 'folder') {
          walk(full);
          return;
        }
        if (!IMAGE_EXT.test(item.name)) return;

        const content = FS.readFile(full) || '';
        if (!content.startsWith('data:image')) return;

        found.push({ name: item.name, src: content, from: full });
      });
    })('');
  }

  return found;
}

function refresh(keepPath) {
  items = collect();

  const wanted = keepPath || (items[index] && items[index].from);
  const found = items.findIndex(i => i.from === wanted);
  index = found >= 0 ? found : (items.length ? 0 : -1);

  renderStrip();
  show();
}

function renderStrip() {
  stripEl.innerHTML = items.map((it, i) =>
    `<div class="viewer-thumb${i === index ? ' active' : ''}" data-i="${i}"></div>`
  ).join('');

  stripEl.querySelectorAll('.viewer-thumb').forEach((el, i) => {
    el.style.backgroundImage = `url("${items[i].src}")`;
    el.title = items[i].name;
    el.addEventListener('click', () => {
      index = i;
      renderStrip();
      show();
    });
  });
}

function show() {
  const item = items[index];

  document.getElementById('btn-prev').disabled = items.length < 2;
  document.getElementById('btn-next').disabled = items.length < 2;
  document.getElementById('btn-wall').disabled = !item;

  if (!item) {
    imageEl.style.display = 'none';
    emptyEl.style.display = 'block';
    document.getElementById('title').textContent = 'nothing open';
    document.getElementById('meta').textContent = '';
    return;
  }

  emptyEl.style.display = 'none';
  imageEl.style.display = 'block';
  imageEl.src = item.src;
  document.getElementById('title').textContent = item.name;

  imageEl.onload = () => {
    document.getElementById('meta').textContent =
      imageEl.naturalWidth + 'x' + imageEl.naturalHeight;
  };
}

function step(dir) {
  if (!items.length) return;
  index = (index + dir + items.length) % items.length;
  renderStrip();
  show();
}

document.getElementById('btn-prev').addEventListener('click', () => step(-1));
document.getElementById('btn-next').addEventListener('click', () => step(1));

document.getElementById('btn-zoom').addEventListener('click', (e) => {
  const full = stageEl.classList.toggle('full');
  e.currentTarget.textContent = full ? 'full' : 'fit';
});

document.getElementById('btn-wall').addEventListener('click', (e) => {
  const item = items[index];
  if (!item) return;

  // wallpapers go by filename, drawings go as the data url itself
  const file = item.from === 'wallpaper' ? item.name : item.src;
  window.parent.postMessage({ type: 'setWallpaper', file }, '*');

  const btn = e.currentTarget;
  btn.textContent = 'done';
  clearTimeout(btn._t);
  btn._t = setTimeout(() => { btn.textContent = 'set bg'; }, 1400);
});

window.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});

window.addEventListener('message', (e) => {
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
  }
  if (e.data?.type === 'openImage') {
    refresh(e.data.path);
  }
});

if (FS) {
  FS.subscribe(() => refresh());
  const pending = FS.consumePendingImage ? FS.consumePendingImage() : null;
  refresh(pending);
} else {
  refresh();
}