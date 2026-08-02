const MIN_W = 360;
const MIN_H = 280;
const GAP   = 8;         
let topZ    = 1000;
let winSeq  = 0;

let currentWorkspace = 1;


let wmMode = localStorage.getItem('wmMode') || 'normal';

let focusedId = null;            
const tileOrder = [];        
const niriScroll = {};            

function bringToFront(win) {
  win.style.zIndex = ++topZ;
}

function setFocus(win) {
  if (!win) return;
  focusedId = win.id;
  document.querySelectorAll('.app-window').forEach(w =>
    w.classList.toggle('wm-focused', w === win));
  bringToFront(win);
  if (wmMode === 'niri') relayout(); 
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

  relayout();
}

function getWorkArea() {
  const footer = document.querySelector('.footer');
  const side = document.body.dataset.bar || 'bottom';

  let top = 0;
  let bottom = window.innerHeight;
  let left = 0;
  let right = window.innerWidth;

  // the bar takes space away from whichever edge it sits on
  if (footer) {
    const r = footer.getBoundingClientRect();
    if (side === 'top') top = r.bottom;
    else if (side === 'left') left = r.right;
    else if (side === 'right') right = r.left;
    else bottom = r.top;
  }

  return {
    x: left + GAP,
    y: top + GAP,
    w: right - left - GAP * 2,
    h: bottom - top - GAP * 2,
  };
}

function visibleWins() {
  return tileOrder
    .map(id => document.getElementById(id))
    .filter(w => w
      && parseInt(w.dataset.workspace || '1', 10) === currentWorkspace
      && w.dataset.minimized !== 'true');
}

function placeWin(win, x, y, w, h) {
  win.classList.add('tiled');
  win.style.left = Math.round(x) + 'px';
  win.style.top = Math.round(y) + 'px';
  win.style.width = Math.round(w) + 'px';
  win.style.height = Math.round(h) + 'px';
}

function layoutDwindle(wins, area, vertical) {
  if (!wins.length) return;
  if (wins.length === 1) {
    placeWin(wins[0], area.x, area.y, area.w, area.h);
    return;
  }
  if (!vertical) {
    const w = (area.w - GAP) / 2;
    placeWin(wins[0], area.x, area.y, w, area.h);
    layoutDwindle(wins.slice(1), { x: area.x + w + GAP, y: area.y, w, h: area.h }, true);
  } else {
    const h = (area.h - GAP) / 2;
    placeWin(wins[0], area.x, area.y, area.w, h);
    layoutDwindle(wins.slice(1), { x: area.x, y: area.y + h + GAP, w: area.w, h }, false);
  }
}

function layoutNiri(wins, area) {
  const colW = (area.w - GAP) / 2;
  const step = colW + GAP;

  let focusIdx = wins.findIndex(w => w.id === focusedId);
  if (focusIdx < 0) focusIdx = 0;

  let scroll = niriScroll[currentWorkspace] || 0;
  const colLeft = focusIdx * step;
  if (colLeft < scroll) scroll = colLeft;
  if (colLeft + colW > scroll + area.w) scroll = colLeft + colW - area.w;
  scroll = Math.max(0, Math.min(scroll, Math.max(0, wins.length * step - GAP - area.w)));
  niriScroll[currentWorkspace] = scroll;

  wins.forEach((win, i) => {
    placeWin(win, area.x + i * step - scroll, area.y, colW, area.h);
  });
}

function relayout() {
  const area = getWorkArea();
  const wins = visibleWins();

  const fullscreen = wins.filter(w => w.dataset.fullscreen === 'true');
  const normal     = wins.filter(w => w.dataset.fullscreen !== 'true');

  fullscreen.forEach(w => placeWin(w, area.x - GAP, area.y - GAP, area.w + GAP * 2, area.h + GAP * 2));

  if (wmMode === 'hyprland') {
    layoutDwindle(normal, area, false);
  } else if (wmMode === 'niri') {
    layoutNiri(normal, area);
  }
}

function saveFloatRect(win) {
  win._floatRect = {
    x: win.offsetLeft, y: win.offsetTop,
    w: win.offsetWidth, h: win.offsetHeight,
  };
}

function restoreFloatRect(win) {
  const r = win._floatRect;
  if (!r) return;
  win.classList.remove('tiled');
  win.style.left = r.x + 'px';
  win.style.top = r.y + 'px';
  win.style.width = r.w + 'px';
  win.style.height = r.h + 'px';
}

function setWmMode(mode) {
  if (!['normal', 'hyprland', 'niri'].includes(mode)) return;
  wmMode = mode;
  localStorage.setItem('wmMode', mode);
  document.body.classList.toggle('wm-tiled', mode !== 'normal');

  if (mode === 'normal') {
    document.querySelectorAll('.app-window').forEach(w => {
      if (w.dataset.fullscreen !== 'true') restoreFloatRect(w);
    });
  }
  relayout();
}

const snapPreview = document.createElement('div');
snapPreview.className = 'snap-preview';
document.body.appendChild(snapPreview);

function getSnapZone(x, y) {
  const area = getWorkArea();
  if (y <= area.y) return 'max';                    
  if (x <= 10) return 'left';
  if (x >= window.innerWidth - 10) return 'right';
  return null;
}

function snapRect(zone) {
  const area = getWorkArea();
  const halfW = (area.w - GAP) / 2;
  if (zone === 'left')  return { x: area.x, y: area.y, w: halfW, h: area.h };
  if (zone === 'right') return { x: area.x + halfW + GAP, y: area.y, w: halfW, h: area.h };
  return { x: area.x, y: area.y, w: area.w, h: area.h };
}

function setupDrag(win) {
  const bar = win.querySelector('.window-titlebar');

  bar.addEventListener('mousedown', (e) => {
    if (e.target.closest('.window-btn')) return;
    setFocus(win);

    if (wmMode !== 'normal') return;                
    if (win.dataset.fullscreen === 'true') return;   

    let ox = e.clientX - win.offsetLeft;
    const oy = e.clientY - win.offsetTop;

    if (win.dataset.snapped === 'true') {
      win.dataset.snapped = 'false';
      const r = win._floatRect || { w: 720, h: 520 };
      win.style.width = r.w + 'px';
      win.style.height = r.h + 'px';
      ox = r.w / 2;                               
      win.style.left = (e.clientX - ox) + 'px';
    }

    let zone = null;

    function move(e) {
      win.style.left = Math.max(0, e.clientX - ox) + 'px';
      win.style.top = Math.max(0, e.clientY - oy) + 'px';

      zone = getSnapZone(e.clientX, e.clientY);
      if (zone) {
        const r = snapRect(zone);
        snapPreview.style.cssText =
          `display:block; left:${r.x}px; top:${r.y}px; width:${r.w}px; height:${r.h}px;`;
      } else {
        snapPreview.style.display = 'none';
      }
    }

    function up() {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      snapPreview.style.display = 'none';

      if (zone) {
        saveFloatRect(win);                       
        const r = snapRect(zone);
        win.style.left = r.x + 'px';
        win.style.top = r.y + 'px';
        win.style.width = r.w + 'px';
        win.style.height = r.h + 'px';
        win.dataset.snapped = 'true';
      } else {
        saveFloatRect(win);
      }
    }

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}


function setupResize(win) {
  win.querySelectorAll('.resize-handle').forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      if (wmMode !== 'normal' || win.dataset.fullscreen === 'true') return;
      e.preventDefault();
      e.stopPropagation();
      setFocus(win);

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
          win.style.width = Math.max(MIN_W, startW + dx) + 'px';
        }
        if (dir.includes('s')) {
          win.style.height = Math.max(MIN_H, startH + dy) + 'px';
        }
        if (dir.includes('w')) {
          const newW = Math.max(MIN_W, startW - dx);
          win.style.width = newW + 'px';
          win.style.left = (startL + startW - newW) + 'px';
        }
        if (dir.includes('n')) {
          const newH = Math.max(MIN_H, startH - dy);
          win.style.height = newH + 'px';
          win.style.top = (startT + startH - newH) + 'px';
        }
      }
      function up() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        win.dataset.snapped = 'false';
        saveFloatRect(win);
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  });
}
const BUILTIN_WALLPAPERS = ['Nightforrest.jpg', 'dayforrest.jpg'];

function wallpaperUrl(value) {
  if (!value) return null;
  if (value.startsWith('data:')) return value;
  if (BUILTIN_WALLPAPERS.includes(value)) return '../Wallpapers/' + value;

  const data = window.WebOSFS ? window.WebOSFS.readFile(value) : null;
  return (data && data.startsWith('data:image')) ? data : null;
}

function applyWallpaper(value) {
  const el = document.getElementById('wallpaper');
  if (!el) return false;

  const url = wallpaperUrl(value);
  if (!url) return false;

  el.style.backgroundImage = `url("${url}")`;
  return true;
}

// a picture from the filesystem is gone after a reload, so fall back quietly
if (!applyWallpaper(localStorage.getItem('wallpaper'))) {
  localStorage.setItem('wallpaper', BUILTIN_WALLPAPERS[0]);
  applyWallpaper(BUILTIN_WALLPAPERS[0]);
}

// css variables do not cross into an iframe, so the value is pushed to each app
function applyWinAlpha(alpha) {
  document.documentElement.style.setProperty('--win-alpha', String(alpha));
  localStorage.setItem('winAlpha', String(alpha));

  document.querySelectorAll('.app-window iframe').forEach(frame => {
    try {
      frame.contentWindow.postMessage({ type: 'setWinAlpha', alpha }, '*');
    } catch (e) {
      // frame not ready yet, it picks the value up on load
    }
  });
}

function applyBar(side, alpha) {
  if (side) {
    document.body.dataset.bar = side;
    localStorage.setItem('barSide', side);
  }
  if (alpha !== undefined && alpha !== null) {
    document.documentElement.style.setProperty('--bar-alpha', String(alpha));
    localStorage.setItem('barAlpha', String(alpha));
  }
}

applyBar(
  localStorage.getItem('barSide') || 'bottom',
  parseFloat(localStorage.getItem('barAlpha')) || 0.82
);

const savedWinAlpha = parseFloat(localStorage.getItem('winAlpha'));
applyWinAlpha(isNaN(savedWinAlpha) ? 0.88 : savedWinAlpha);

// the x lifts off the titlebar, grows to the window's smaller side and centers
// itself, then the window goes, then the x goes
function flyingCross(win) {
  const btn = win.querySelector('.window-btn.close');
  const svg = btn && btn.querySelector('svg');
  if (!svg) return null;

  const from = svg.getBoundingClientRect();
  const box = win.getBoundingClientRect();
  if (!from.width || !box.width) return null;

  const size = Math.min(box.width, box.height);

  const ghost = document.createElement('div');
  ghost.className = 'win-cross';
  ghost.innerHTML = svg.outerHTML;
  ghost.style.left = from.left + 'px';
  ghost.style.top = from.top + 'px';
  ghost.style.width = from.width + 'px';
  ghost.style.height = from.height + 'px';
  document.body.appendChild(ghost);

  btn.style.visibility = 'hidden';

  // width/height instead of scale, so the svg is redrawn sharp at every size
  requestAnimationFrame(() => {
    ghost.style.left = (box.left + box.width / 2 - size / 2) + 'px';
    ghost.style.top = (box.top + box.height / 2 - size / 2) + 'px';
    ghost.style.width = size + 'px';
    ghost.style.height = size + 'px';
    ghost.style.opacity = '1';
    ghost.classList.add('grown');
  });

  return ghost;
}

// the bar grows to the window's width, then the window rides up into it.
// the clip line moves down inside the window exactly as fast as the window
// moves up, so the cut stays glued to the bar and nothing pokes out on top
function minimizeWindow(win) {
  if (win.dataset.closing === 'true' || win.dataset.shredding === 'true') return;

  const btn = win.querySelector('.window-btn.minimize');
  const svg = btn && btn.querySelector('svg');
  const box = win.getBoundingClientRect();

  const finish = () => {
    win.dataset.shredding = '';
    win.style.transition = '';
    win.style.transform = '';
    win.style.clipPath = '';
    win.style.display = 'none';
    if (btn) btn.style.visibility = '';
  };

  if (!svg || !box.width) {
    win.dataset.minimized = 'true';
    finish();
    relayout();
    return;
  }

  window.WebOSSound?.minimize();
  win.dataset.shredding = 'true';
  win.dataset.minimized = 'true';
  relayout();

  const icon = svg.getBoundingClientRect();

  const bar = document.createElement('div');
  bar.className = 'win-bar';
  bar.style.left = (icon.left + icon.width * 0.25) + 'px';
  bar.style.top = (icon.top + icon.height * 0.75) + 'px';
  bar.style.width = (icon.width * 0.5) + 'px';
  document.body.appendChild(bar);

  btn.style.visibility = 'hidden';

  // clip-path only animates between two inset() values, never from none
  win.style.transform = 'translateY(0px)';
  win.style.clipPath = 'inset(0px 0 0 0)';

  requestAnimationFrame(() => {
    bar.style.left = box.left + 'px';
    bar.style.top = box.top + 'px';
    bar.style.width = box.width + 'px';
    bar.style.opacity = '1';
  });

  setTimeout(() => {
    win.style.transition = 'transform 0.34s cubic-bezier(.5, 0, .75, 0), clip-path 0.34s cubic-bezier(.5, 0, .75, 0)';
    win.style.transform = `translateY(${-box.height}px)`;
    win.style.clipPath = `inset(${box.height}px 0 0 0)`;
  }, 270);

  setTimeout(() => {
    finish();
    bar.classList.add('gone');
    setTimeout(() => bar.remove(), 220);
  }, 640);
}

function destroyWindow(win) {
  if (win.dataset.closing === 'true') return;
  window.WebOSSound?.close();
  win.dataset.closing = 'true';

  const idx = tileOrder.indexOf(win.id);
  if (idx >= 0) tileOrder.splice(idx, 1);

  if (focusedId === win.id) {
    focusedId = null;
    const rest = visibleWins();
    if (rest.length) setFocus(rest[rest.length - 1]);
  }
  relayout();

  const ghost = flyingCross(win);

  if (!ghost) {
    win.classList.add('win-closing');
    setTimeout(() => win.remove(), 160);
    return;
  }

  setTimeout(() => {
    win.classList.add('win-closing');
    setTimeout(() => win.remove(), 170);
  }, 260);

  setTimeout(() => {
    ghost.classList.add('gone');
    setTimeout(() => ghost.remove(), 220);
  }, 470);
}

// the icon flies to the middle of the window, splits into four brackets that
// shoot into the screen corners and grow, and the window follows them out
function fullscreenPull(win, done) {
  const btn = win.querySelector('.window-btn.fullscreen');
  const svg = btn && btn.querySelector('svg');
  const box = win.getBoundingClientRect();

  if (!svg || !box.width) {
    done();
    return;
  }

  const icon = svg.getBoundingClientRect();

  const frame = document.createElement('div');
  frame.className = 'win-corners';
  frame.innerHTML = '<span class="c tl"></span><span class="c tr"></span>' +
                    '<span class="c bl"></span><span class="c br"></span>';
  frame.style.left = icon.left + 'px';
  frame.style.top = icon.top + 'px';
  frame.style.width = icon.width + 'px';
  frame.style.height = icon.height + 'px';
  document.body.appendChild(frame);

  btn.style.visibility = 'hidden';

  const midW = Math.min(96, box.width * 0.3);
  const midH = Math.min(70, box.height * 0.3);

  requestAnimationFrame(() => {
    frame.style.opacity = '1';
    frame.style.left = (box.left + box.width / 2 - midW / 2) + 'px';
    frame.style.top = (box.top + box.height / 2 - midH / 2) + 'px';
    frame.style.width = midW + 'px';
    frame.style.height = midH + 'px';
  });

  setTimeout(() => {
    frame.classList.add('spread');
    frame.style.left = '0px';
    frame.style.top = '0px';
    frame.style.width = window.innerWidth + 'px';
    frame.style.height = window.innerHeight + 'px';
  }, 260);

  setTimeout(() => {
    done();
    if (btn) btn.style.visibility = '';
  }, 430);

  setTimeout(() => {
    frame.classList.add('gone');
    setTimeout(() => frame.remove(), 240);
  }, 560);
}

function toggleFullscreen(win) {
  const on = win.dataset.fullscreen === 'true';

  const apply = () => {
    if (!on) {
      if (wmMode === 'normal') saveFloatRect(win);
      win.dataset.fullscreen = 'true';
      setFocus(win);
    } else {
      win.dataset.fullscreen = 'false';
      if (wmMode === 'normal') restoreFloatRect(win);
    }
    win.classList.toggle('is-fullscreen', !on);
    relayout();
  };

  if (on || win.dataset.pulling === 'true') {
    apply();
    return;
  }

  window.WebOSSound?.fullscreen();
  win.dataset.pulling = 'true';
  fullscreenPull(win, () => {
    win.dataset.pulling = '';
    apply();
  });
}


function openWindow(baseId, title, src, width = 720, height = 520, opts = {}) {
  if (opts.singleton) {
    // alle vorhandenen instanzen einsammeln (data-app UND alte exakte id)
    const dupes = [...document.querySelectorAll(`.app-window[data-app="${baseId}"]`)];
    const legacy = document.getElementById(baseId);
    if (legacy && legacy.classList.contains('app-window') && !dupes.includes(legacy)) {
      dupes.push(legacy);
    }

    if (dupes.length) {
      const keep = dupes[0];
      for (let i = 1; i < dupes.length; i++) destroyWindow(dupes[i]);  // ueberzaehlige zusammenfuehren

      keep.dataset.minimized = 'false';
      const ws = parseInt(keep.dataset.workspace || '1', 10);
      if (ws !== currentWorkspace) switchWorkspace(ws);
      updateWindowVisibility(keep);
      setFocus(keep);
      relayout();
      return keep;
    }
  }

  const id = `${baseId}__${++winSeq}`;

  // offset each new window so it does not sit exactly on the last one
  const cascade = ((winSeq - 1) % 6) * 26;
  const startX = Math.max(40, Math.floor((window.innerWidth - width) / 2)) + cascade;
  const startY = Math.max(40, Math.floor((window.innerHeight - height) / 2)) + cascade;

  const win = document.createElement('div');
  win.className = 'app-window';
  win.id = id;
  win.dataset.app = baseId;
  win.dataset.workspace = String(currentWorkspace);
  win.dataset.minimized = 'false';
  win.dataset.fullscreen = 'false';
  win.dataset.snapped = 'false';
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
        <button class="window-btn fullscreen" title="Vollbild">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4"/></svg>
        </button>
      </div>
      <div class="window-title">${title}</div>
    </div>
    <div class="window-content">
      <iframe src="${src}"></iframe>
    </div>
  `;

  document.body.appendChild(win);
  tileOrder.push(id);
  saveFloatRect(win);
  setupDrag(win);
  setupResize(win);
  setFocus(win);

  win.addEventListener('mousedown', () => setFocus(win));

  win.querySelector('.window-btn.close').addEventListener('click', () => {
    destroyWindow(win);
  });

  win.querySelector('.window-btn.minimize').addEventListener('click', () => {
    minimizeWindow(win);
  });

  win.querySelector('.window-btn.fullscreen').addEventListener('click', () => {
    toggleFullscreen(win);
  });

  // a fresh window has to be told the current transparency
  setTimeout(() => {
    const frame = win.querySelector('iframe');
    const a = parseFloat(localStorage.getItem('winAlpha'));
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: 'setWinAlpha', alpha: isNaN(a) ? 0.88 : a }, '*');
    }
  }, 120);

  window.WebOSSound?.open();
  win.classList.add('win-open-anim');
  setTimeout(() => win.classList.remove('win-open-anim'), 200);

  relayout();
  return win;
}

window.addEventListener('keydown', (e) => {
  if (wmMode === 'normal') return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

  if (document.body.classList.contains('overview-active')) return;


  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'
        || t.tagName === 'SELECT' || t.isContentEditable)) return;

  const wins = visibleWins().filter(w => w.dataset.fullscreen !== 'true');
  if (wins.length < 2) return;

  let idx = wins.findIndex(w => w.id === focusedId);
  if (idx < 0) idx = 0;
  idx = e.key === 'ArrowRight'
    ? (idx + 1) % wins.length
    : (idx - 1 + wins.length) % wins.length;

  setFocus(wins[idx]);
  e.preventDefault();
});

window.addEventListener('resize', relayout);


function openSettings() {
  return openWindow('win-settings', 'SETTINGS', 'applications/settings/settings.html', 720, 520, { singleton: true });
}

function openCalculator() {
  return openWindow('win-calculator', 'CALCULATOR', 'applications/calculator/calculator.html', 300, 440);
}
function openTodo() {
  return openWindow('win-todo', 'TODO', 'applications/todo/todo.html', 300, 460);
}
function openCode() {
  return openWindow('win-code', 'CODE', 'applications/code/code.html', 560, 460);
}
function openTerminal() {
  return openWindow('win-terminal', 'TERMINAL', 'applications/terminal/terminal.html', 480, 360);
}
function openFiles() {
  return openWindow('win-files', 'FILES', 'applications/Files/files.html', 520, 420);
}
function openSnake() {
  return openWindow('win-snake', 'SNAKE', 'applications/snake/snake.html', 470, 540);
}
function openWelcome() {
  return openWindow('win-welcome', 'WELCOME', 'applications/welcome/welcome.html', 600, 560, { singleton: true });
}
function openBrowser() {
  return openWindow('win-browser', 'BROWSER', 'applications/browser/browser.html', 860, 600);
}
function openMonitor() {
  return openWindow('win-monitor', 'MONITOR', 'applications/monitor/monitor.html', 560, 470);
}
function openPaint() {
  return openWindow('win-paint', 'PAINT', 'applications/paint/paint.html', 700, 540);
}
function openViewer() {
  return openWindow('win-viewer', 'VIEWER', 'applications/viewer/viewer.html', 600, 470);
}



window.addEventListener('message', (e) => {
  if (e.data?.type === 'setWinAlpha') {
    applyWinAlpha(e.data.alpha);
  }

  if (e.data?.type === 'setBarSide') {
    applyBar(e.data.side);
    if (typeof relayout === 'function') relayout();
  }

  if (e.data?.type === 'setBarAlpha') {
    applyBar(null, e.data.alpha);
  }

  if (e.data?.type === 'setWallpaper') {
    if (applyWallpaper(e.data.file)) {
      try {
        localStorage.setItem('wallpaper', e.data.file);
      } catch (err) {
        pushNotification('wallpaper', 'set, but too big to remember after a reload', 5000);
      }
    } else {
      pushNotification('wallpaper [-_-]', 'could not find ' + e.data.file, 4000);
    }
  }
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
    localStorage.setItem('theme', e.data.theme);

    document.querySelectorAll('.app-window iframe').forEach(frame => {
      frame.contentWindow.postMessage({ type: 'setTheme', theme: e.data.theme }, '*');
    });
  }
  if (e.data?.type === 'setWmMode') {
    setWmMode(e.data.mode);
  }
});

document.body.classList.toggle('wm-tiled', wmMode !== 'normal');



function autostartWelcome() {
  let skip = '0';
  try {
    skip = localStorage.getItem('skipWelcome');
  } catch (e) {
    skip = '0';
  }
  if (skip !== '1') openWelcome();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autostartWelcome);
} else {
  autostartWelcome();
}