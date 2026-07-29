document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';

window.addEventListener('message', (e) => {
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
  }
});

// optimised png first, the original jpg as a fallback
const ORIGINAL = {
  terminal: 'terminal', files: 'files', code: 'code', paint: 'draw',
  viewer: 'imageviewer', monitor: 'monitor', calculator: 'calc', snake: 'snake',
};

const png = (name) => {
  const alt = ORIGINAL[name] ? `../../../assets/${ORIGINAL[name]}.jpg` : '';
  return `<img class="wel-icon" src="../../../assets/icons/${name}.png" data-alt="${alt}" alt="">`;
};

const APPS = [
  ['terminal', 'openTerminal', png('terminal')],
  ['files', 'openFiles', png('files')],
  ['code', 'openCode', png('code')],
  ['paint', 'openPaint', png('paint')],
  ['viewer', 'openViewer', png('viewer')],
  ['browser', 'openBrowser', png('browser')],
  ['monitor', 'openMonitor', png('monitor')],
  ['calc', 'openCalculator', png('calculator')],
  ['snake', 'openSnake', png('snake')],
  ['todo', 'openTodo', png('todo')],
  ['settings', 'openSettings', png('settings')],
];

const grid = document.getElementById('app-grid');

grid.innerHTML = APPS.map(([name, , icon]) =>
  `<button class="wel-app">${icon}<span>${name}</span></button>`
).join('');

grid.querySelectorAll('.wel-icon').forEach(img => {
  img.addEventListener('error', () => {
    if (img.dataset.alt) {
      const next = img.dataset.alt;
      img.dataset.alt = '';
      img.src = next;
      return;
    }
    const span = document.createElement('span');
    span.className = 'wel-icon-missing';
    span.textContent = (img.closest('.wel-app')?.querySelector('span')?.textContent || '?')[0].toUpperCase();
    img.replaceWith(span);
  });
});

grid.querySelectorAll('.wel-app').forEach((el, i) => {
  el.addEventListener('click', () => {
    const fn = window.parent[APPS[i][1]];
    if (typeof fn === 'function') fn();
  });
});

const box = document.getElementById('show-again');
box.checked = localStorage.getItem('skipWelcome') !== '1';

box.addEventListener('change', () => {
  localStorage.setItem('skipWelcome', box.checked ? '0' : '1');
});

const ageEl = document.getElementById('age-counter');
const BIRTH = new Date(2011, 4, 20, 10, 22, 0);
const MS_PER_YEAR = 31536000 * 1000;

function updateAge() {
  ageEl.textContent = ((Date.now() - BIRTH) / MS_PER_YEAR).toFixed(8);
  requestAnimationFrame(updateAge);
}

updateAge();