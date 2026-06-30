const wallpapers = [
    'Nightforrest.jpg',
    'dayforrest.jpg'
];

const THUMB_PATH = '../../../Wallpapers';

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
 