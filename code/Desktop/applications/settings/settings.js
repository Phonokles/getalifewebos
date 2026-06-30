const wallpapers = [
    'Nightforrest.jpg',
    'dayforrest.jpg'
];

const THUMB_PATH = '../../../Wallpapers/';

function renderWallpapers() {
  const grid = document.getElementById('wallpaper-grid');
 
  wallpapers.forEach(file => {
    const card = document.createElement('button');
    card.className = 'wallpaper-card';
    card.dataset.file = file;
 
    const img = document.createElement('img');
    img.src  = THUMB_PATH + file;
    img.alt  = file;
 
    const label = document.createElement('span');
    label.textContent = file.replace(/\.[^.]+$/, '');
 
    card.appendChild(img);
    card.appendChild(label);
    card.addEventListener('click', () => applyWallpaper(file, card));
 
    grid.appendChild(card);
  });
}

function applyWallpaper(file, card) {
  document.querySelectorAll('.wallpaper-card').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  window.parent.postMessage({ type: 'setWallpaper', file }, '*');
}

function applyTheme(theme, card) {
  document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
  card.classList.add('active');

  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
  window.parent.postMessage({ type: 'setTheme', theme }, '*');
}

function setupThemeCards() {
  const current = localStorage.getItem('theme') || 'dark';
  document.documentElement.dataset.theme = current;

  document.querySelectorAll('.theme-card').forEach(card => {
    if (card.dataset.theme === current) card.classList.add('active');
    card.addEventListener('click', () => applyTheme(card.dataset.theme, card));
  });
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
 
    const panelId = 'panel-' + btn.dataset.panel;
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(panelId)?.classList.add('active');
  });
});
 
renderWallpapers();
setupThemeCards();