const MIN_W = 360;
const MIN_H = 280;
let topZ   = 1000;

let currentWorkspace = 1;

function bringToFront(win) {
  win.style.zIndex = ++topZ;
}

function updateWindowVisibility(win) {
  const ws = parseInt(win.dataset.workspace || '1', 10);
  const minimized = win.dataset.minimized === 'true';
  win.style.display = (!minimized && ws === currentWorkspace) ? 'flex' : 'none';
}

function switchWorkspace(n) {
  if (n === currentWorkspace) return;
  currentWorkspace = n;

  document.querySelectorAll('.app-window').forEach(updateWindowVisibility);

  document.querySelectorAll('.ws-dot').forEach(dot => {
    dot.classList.toggle('active', parseInt(dot.dataset.ws, 10) === currentWorkspace);
  });
}

function setupDrag(win) {
  const bar = win.querySelector('.window-titlebar');

  bar.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('window-btn')) return;
    bringToFront(win);

    const ox = e.clientX - win.offsetLeft;
    const oy = e.clientY - win.offsetTop;

    function move(e) {
      win.style.left = Math.max(0, e.clientX - ox) + 'px';
      win.style.top  = Math.max(0, e.clientY - oy) + 'px';
    }
    function up() {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup',   up);
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup',   up);
  });
}


function setupResize(win) {
  win.querySelectorAll('.resize-handle').forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      bringToFront(win);

      const dir    = handle.dataset.dir;
      const startX = e.clientX;
      const startY = e.clientY;
      const startL = win.offsetLeft;
      const startT = win.offsetTop;
      const startW = win.offsetWidth;
      const startH = win.offsetHeight;

      function move(e) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (dir.includes('e')) {
          win.style.width  = Math.max(MIN_W, startW + dx) + 'px';
        }
        if (dir.includes('s')) {
          win.style.height = Math.max(MIN_H, startH + dy) + 'px';
        }
        if (dir.includes('w')) {
          const newW = Math.max(MIN_W, startW - dx);
          win.style.width = newW + 'px';
          win.style.left  = (startL + startW - newW) + 'px';
        }
        if (dir.includes('n')) {
          const newH = Math.max(MIN_H, startH - dy);
          win.style.height = newH + 'px';
          win.style.top    = (startT + startH - newH) + 'px';
        }
      }
      function up() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup',   up);
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup',   up);
    });
  });
}

function openWindow(id, title, src, width = 720, height = 520) {
  // Wenn schon vorhanden: wieder anzeigen (ggf. Workspace wechseln)
  const existing = document.getElementById(id);
  if (existing) {
    existing.dataset.minimized = 'false';
    const ws = parseInt(existing.dataset.workspace || '1', 10);
    if (ws !== currentWorkspace) switchWorkspace(ws);
    updateWindowVisibility(existing);
    bringToFront(existing);
    return;
  }

  const startX = Math.max(40, Math.floor((window.innerWidth  - width) / 2));
  const startY = Math.max(40, Math.floor((window.innerHeight - height) / 2));

  const win = document.createElement('div');
  win.className = 'app-window';
  win.id = id;
  win.dataset.workspace = String(currentWorkspace);
  win.dataset.minimized = 'false';
  win.style.cssText = `left:${startX}px; top:${startY}px; width:${width}px; height:${height}px;`;

  win.innerHTML = `
<div class="resize-handle resize-n"  data-dir="n"></div>
    <div class="resize-handle resize-s"  data-dir="s"></div>
    <div class="resize-handle resize-e"  data-dir="e"></div>
    <div class="resize-handle resize-w"  data-dir="w"></div>
    <div class="resize-handle resize-ne" data-dir="ne"></div>
    <div class="resize-handle resize-nw" data-dir="nw"></div>
    <div class="resize-handle resize-se" data-dir="se"></div>
    <div class="resize-handle resize-sw" data-dir="sw"></div>
    <div class="window-titlebar">
      <div class="window-controls">
        <button class="window-btn close" title="Schließen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <button class="window-btn minimize" title="Minimieren">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 18h12"/></svg>
        </button>
      </div>
      <div class="window-title">${title}</div>
    </div>
    <div class="window-content">
      <iframe src="${src}"></iframe>
    </div>
  `;

  document.body.appendChild(win);
  bringToFront(win);
  setupDrag(win);
  setupResize(win);

  win.addEventListener('mousedown', () => bringToFront(win));

  win.querySelector('.window-btn.close').addEventListener('click', () => {
    win.dataset.minimized = 'true';
    win.style.display = 'none';
  });

  win.querySelector('.window-btn.minimize').addEventListener('click', () => {
    win.dataset.minimized = 'true';
    win.style.display = 'none';
  });
}

function openSettings() {
  openWindow('win-settings', 'SETTINGS', 'applications/settings/settings.html');
}

function openCalculator() {
  openWindow('win-calculator', 'CALCULATOR', 'applications/calculator/calculator.html', 300, 440);
}
function openTodo() {
  openWindow('win-todo', 'TODO', 'applications/todo/todo.html', 300, 460);
}
function openCode() {
  openWindow('win-code', 'CODE', 'applications/code/code.html', 560, 460);
}
function openTerminal() {
  openWindow('win-terminal', 'TERMINAL', 'applications/terminal/terminal.html', 480, 360);
}
window.addEventListener('message', (e) => {
  if (e.data?.type === 'setWallpaper') {
    const wallpaper = document.getElementById('wallpaper');
    if (wallpaper) {
      wallpaper.style.backgroundImage = `url(../Wallpapers/${e.data.file})`;
    }
  }
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
    localStorage.setItem('theme', e.data.theme);

    // An alle offenen App-Fenster weiterreichen
    document.querySelectorAll('.app-window iframe').forEach(frame => {
      frame.contentWindow.postMessage({ type: 'setTheme', theme: e.data.theme }, '*');
    });
  }
});