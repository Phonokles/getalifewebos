const wallpapers = [
  'Nightforrest.jpg',
  'dayforrest.jpg',
];

const THUMB_PATH = '../../../Wallpapers/';

function renderWallpapers() {
  const grid = document.getElementById('wallpaper-grid');

  wallpapers.forEach(file => {
    const card = document.createElement('button');
    card.className = 'wallpaper-card';
    card.dataset.file = file;

    const img = document.createElement('img');
    img.src = THUMB_PATH + file;
    img.alt = file;

    const label = document.createElement('span');
    label.textContent = file.replace(/\.[^.]+$/, '');

    const check = document.createElement('span');
    check.className = 'wallpaper-check';
    check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

    card.appendChild(img);
    card.appendChild(check);
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

function setupThemeSwitch() {
  const btn = document.getElementById('theme-switch');
  const label = document.getElementById('theme-switch-label');
  const current = localStorage.getItem('theme') || 'dark';

  document.documentElement.dataset.theme = current;
  updateSwitch(current);

  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
    window.parent.postMessage({ type: 'setTheme', theme: next }, '*');
    updateSwitch(next);
  });

  function updateSwitch(theme) {
    btn.classList.toggle('light', theme === 'light');
    label.textContent = theme === 'light' ? 'Light' : 'Dark';
  }
}

function setupSidebarNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const panelId = 'panel-' + btn.dataset.panel;
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.getElementById(panelId)?.classList.add('active');
    });
  });
}

const PET_TYPES = [
  { id: 'red', label: 'Fox' },
  { id: 'black', label: 'Black' },
  { id: 'akita', label: 'Akita' },
];

const PETS_PATH = '../../../assets/';
const MAX_PETS_TOTAL = 6;

function loadPetCounts() {
  try {
    const stored = JSON.parse(localStorage.getItem('petCounts'));
    if (stored && typeof stored === 'object') return stored;
  } catch (e) {}
  return { red: 1, black: 0, akita: 0 };
}

function setupPetsPanel() {
  const list = document.getElementById('pets-list');
  const counts = loadPetCounts();

  function total() {
    return PET_TYPES.reduce((sum, t) => sum + (counts[t.id] || 0), 0);
  }

  function persist() {
    localStorage.setItem('petCounts', JSON.stringify(counts));
    window.parent.postMessage({ type: 'setPets', pets: counts }, '*');
  }

  function render() {
    PET_TYPES.forEach(type => {
      const c = counts[type.id] || 0;
      const isLastOverall = c === 1 && total() === 1;
      document.getElementById(`pets-count-${type.id}`).textContent = c;
      document.getElementById(`pets-dec-${type.id}`).disabled = c <= 0 || isLastOverall;
      document.getElementById(`pets-inc-${type.id}`).disabled = total() >= MAX_PETS_TOTAL;
    });
  }

  function setCount(id, next) {
    const otherTotal = total() - (counts[id] || 0);
    const clamped = Math.max(0, Math.min(next, MAX_PETS_TOTAL - otherTotal));
    if (otherTotal + clamped < 1) return; // mindestens 1 Tier insgesamt
    counts[id] = clamped;
    persist();
    render();
  }

  list.innerHTML = '';
  PET_TYPES.forEach(type => {
    const row = document.createElement('div');
    row.className = 'setting-row';
    row.innerHTML = `
      <div class="pets-info">
        <div class="pets-preview">
          <img src="${PETS_PATH}${type.id}_lie_8fps.gif" alt="${type.label} schläft" class="pets-fox-img">
        </div>
        <div class="setting-row-text">
          <span class="setting-row-label">${type.label}</span>
          <span class="setting-row-value">In der Taskbar</span>
        </div>
      </div>
      <div class="stepper">
        <button class="stepper-btn" id="pets-dec-${type.id}" type="button" aria-label="Weniger ${type.label}">−</button>
        <span class="stepper-value" id="pets-count-${type.id}">0</span>
        <button class="stepper-btn" id="pets-inc-${type.id}" type="button" aria-label="Mehr ${type.label}">+</button>
      </div>
    `;
    list.appendChild(row);
  });

  PET_TYPES.forEach(type => {
    document.getElementById(`pets-dec-${type.id}`).addEventListener('click', () => setCount(type.id, (counts[type.id] || 0) - 1));
    document.getElementById(`pets-inc-${type.id}`).addEventListener('click', () => setCount(type.id, (counts[type.id] || 0) + 1));
  });

  render();
}

renderWallpapers();
setupThemeSwitch();
setupSidebarNav();
setupPetsPanel();