document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';

window.addEventListener('message', (e) => {
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
  }
});

const svg = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const APPS = [
  ['terminal', 'openTerminal', svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3"/><line x1="12" y1="15" x2="16" y2="15"/>')],
  ['files', 'openFiles', svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>')],
  ['code', 'openCode', svg('<polyline points="8 6 2 12 8 18"/><polyline points="16 6 22 12 16 18"/>')],
  ['paint', 'openPaint', svg('<path d="M15.5 3.5l5 5L9 20H4v-5z"/><line x1="13" y1="6" x2="18" y2="11"/>')],
  ['viewer', 'openViewer', svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-6 6-2-2-5 5"/>')],
  ['monitor', 'openMonitor', svg('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M6 13l3-4 2.5 3L14 9l4 4"/><line x1="9" y1="21" x2="15" y2="21"/>')],
  ['calc', 'openCalculator', svg('<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="17" x2="16" y2="17"/>')],
  ['todo', 'openTodo', svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>')],
  ['snake', 'openSnake', svg('<path d="M4 17V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4"/><circle cx="19" cy="7" r="0.6" fill="currentColor"/>')],
  ['settings', 'openSettings', svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>')],
];

const grid = document.getElementById('app-grid');

grid.innerHTML = APPS.map(([name, , icon]) =>
  `<button class="wel-app">${icon}<span>${name}</span></button>`
).join('');

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

//------------------------------gngznvskderitgoqcnuzuiyjnmyyjczydvrljonvzcncmhl