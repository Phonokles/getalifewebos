(function () {

  // optimised png first, the original jpg as a fallback, so it works whether
  // or not assets/icons has been set up
  const ORIGINAL = {
    terminal: 'terminal', files: 'files', code: 'code', paint: 'draw',
    viewer: 'imageviewer', monitor: 'monitor', calculator: 'calc', snake: 'snake',
  };

  const png = (name) => {
    const alt = ORIGINAL[name] ? `../assets/${ORIGINAL[name]}.jpg` : '';
    return `<img class="tb-icon" src="../assets/icons/${name}.png" data-alt="${alt}" alt="">`;
  };

  const APPS = {
    'win-terminal': { label: 'terminal', open: 'openTerminal', icon: png('terminal') },
    'win-files': { label: 'files', open: 'openFiles', icon: png('files') },
    'win-settings': { label: 'settings', open: 'openSettings', icon: png('settings') },
    'win-code': { label: 'code', open: 'openCode', icon: png('code') },
    'win-paint': { label: 'paint', open: 'openPaint', icon: png('paint') },
    'win-viewer': { label: 'viewer', open: 'openViewer', icon: png('viewer') },
    'win-browser': { label: 'browser', open: 'openBrowser', icon: png('browser') },
    'win-monitor': { label: 'monitor', open: 'openMonitor', icon: png('monitor') },
    'win-calculator': { label: 'calculator', open: 'openCalculator', icon: png('calculator') },
    'win-todo': { label: 'todo', open: 'openTodo', icon: png('todo') },
    'win-snake': { label: 'snake', open: 'openSnake', icon: png('snake') },
    'win-welcome': { label: 'welcome', open: 'openWelcome', icon: png('welcome') },
  };

  const PINNED = ['win-terminal', 'win-files', 'win-settings'];

  const bar = document.getElementById('taskbar-apps');
  const preview = document.getElementById('tb-preview');

  const winsOf = (app) => [...document.querySelectorAll(`.app-window[data-app="${app}"]`)];

  function render() {
    const running = [...new Set(
      [...document.querySelectorAll('.app-window[data-app]')].map(w => w.dataset.app)
    )].filter(a => !PINNED.includes(a) && APPS[a]);

    const parts = PINNED.map(a => btn(a));
    if (running.length) parts.push('<div class="taskbar-sep"></div>');
    running.forEach(a => parts.push(btn(a)));

    bar.innerHTML = parts.join('');

    bar.querySelectorAll('.tb-icon').forEach(img => {
      img.addEventListener('error', () => {
        const fallback = img.dataset.alt;
        if (fallback) {
          img.dataset.alt = '';
          img.src = fallback;
          return;
        }
        const btn = img.closest('.taskbar-app-btn');
        if (!btn) return;
        btn.classList.add('no-icon');
        btn.textContent = (APPS[btn.dataset.app]?.label || '?')[0].toUpperCase();
      });
    });

    bar.querySelectorAll('.taskbar-app-btn').forEach(el => {
      const app = el.dataset.app;
      el.addEventListener('click', () => activate(app));
      el.addEventListener('mouseenter', () => showPreview(app, el));
      el.addEventListener('mouseleave', hidePreviewSoon);
    });
  }

  function btn(app) {
    const wins = winsOf(app);
    const focused = wins.some(w => w.id === window.focusedId);
    const cls = 'taskbar-app-btn' + (wins.length ? ' running' : '') + (focused ? ' focused' : '');
    return `<button class="${cls}" data-app="${app}" title="">${APPS[app].icon}</button>`;
  }

  function activate(app) {
    const wins = winsOf(app);
    if (!wins.length) {
      const fn = window[APPS[app].open];
      if (typeof fn === 'function') fn();
      return;
    }

    const win = wins.find(w => w.id === focusedId) || wins[0];

    if (win.id === focusedId && win.dataset.minimized !== 'true') {
      win.dataset.minimized = 'true';
      win.style.display = 'none';
      relayout();
    } else {
      win.dataset.minimized = 'false';
      win.style.display = '';
      const ws = parseInt(win.dataset.workspace || '1', 10);
      if (ws !== currentWorkspace) switchWorkspace(ws);
      setFocus(win);
      relayout();
    }
    hidePreview();
  }

  let hideTimer = null;

  function showPreview(app, el) {
    clearTimeout(hideTimer);

    const wins = winsOf(app);
    const rows = wins.map(w => {
      const title = w.querySelector('.window-title')?.textContent || APPS[app].label;
      const ws = w.dataset.workspace || '1';
      const hidden = w.dataset.minimized === 'true';
      return `
        <button class="tb-shot" data-id="${w.id}">
          <span class="tb-shot-thumb">
            <span class="tb-shot-bar"></span>
            <span class="tb-shot-lines"><i></i><i></i><i></i></span>
          </span>
          <span class="tb-shot-text">
            <span class="tb-shot-name"></span>
            <span class="tb-shot-meta">workspace ${ws}${hidden ? ' / hidden' : ''}</span>
          </span>
        </button>`;
    }).join('');

    preview.innerHTML = `
      <div class="tb-preview-title">${APPS[app].label}</div>
      ${wins.length ? `<div class="tb-preview-list">${rows}</div>` : ''}
    `;

    preview.querySelectorAll('.tb-shot').forEach((row, i) => {
      row.querySelector('.tb-shot-name').textContent =
        wins[i].querySelector('.window-title')?.textContent || APPS[app].label;

      row.addEventListener('click', () => {
        const win = document.getElementById(row.dataset.id);
        if (!win) return;
        win.dataset.minimized = 'false';
        win.style.display = '';
        const ws = parseInt(win.dataset.workspace || '1', 10);
        if (ws !== currentWorkspace) switchWorkspace(ws);
        setFocus(win);
        relayout();
        hidePreview();
      });
    });

    preview.classList.add('open');

    const r = el.getBoundingClientRect();
    const w = preview.offsetWidth;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(6, Math.min(left, window.innerWidth - w - 6));
    preview.style.left = left + 'px';
  }

  function hidePreview() {
    preview.classList.remove('open');
  }

  function hidePreviewSoon() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hidePreview, 220);
  }

  preview.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  preview.addEventListener('mouseleave', hidePreviewSoon);

  new MutationObserver(() => {
    if (typeof document === 'undefined' || !document.body) return;
    render();
    if (preview.classList.contains('open')) hidePreview();
  }).observe(document.body, {
    childList: true,
    subtree: false,
    attributes: true,
    attributeFilter: ['data-minimized', 'class'],
  });

  render();
  setInterval(render, 900);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function tick() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('footer-date').textContent = `${now.getDate()}.${MONTHS[now.getMonth()]}`;
    document.getElementById('footer-time').textContent = `${h}:${m}:${s}`;
  }

  tick();
  setInterval(tick, 1000);

  const clockPopup = document.getElementById('clock-popup');
  const powerPopup = document.getElementById('power-popup');

  document.getElementById('launcher-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    clockPopup.classList.remove('open');
    powerPopup.classList.remove('open');
    toggleLauncher();
  });

  document.getElementById('footer-clock').addEventListener('click', (e) => {
    e.stopPropagation();
    powerPopup.classList.remove('open');
    volPopup.classList.remove('open');
    clockPopup.classList.toggle('open');
    if (clockPopup.classList.contains('open')) buildCalendar();
  });

  const volPopup = document.getElementById('vol-popup');
  const volSlider = document.getElementById('vol-slider');
  const volFill = document.getElementById('vol-fill');
  const volThumb = document.getElementById('vol-thumb');
  const volValue = document.getElementById('vol-value');
  const volBtn = document.getElementById('vol-btn');

  function paintVolume(v) {
    const pct = Math.round(v * 100);
    volFill.style.width = pct + '%';
    volThumb.style.left = pct + '%';
    volValue.textContent = pct;
    volBtn.classList.toggle('muted', v <= 0);
    volBtn.classList.toggle('quiet', v > 0 && v < 0.4);
  }

  paintVolume(window.WebOSSound ? window.WebOSSound.getVolume() : 0.5);

  let volDragging = false;

  function volFromEvent(e) {
    const r = volSlider.getBoundingClientRect();
    if (!r.width) return;
    const v = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    window.WebOSSound?.setVolume(v);
    paintVolume(v);
  }

  volSlider.addEventListener('pointerdown', (e) => {
    volDragging = true;
    volSlider.setPointerCapture?.(e.pointerId);
    volFromEvent(e);
  });
  volSlider.addEventListener('pointermove', (e) => { if (volDragging) volFromEvent(e); });
  volSlider.addEventListener('pointerup', () => {
    volDragging = false;
    window.WebOSSound?.blip();
  });
  volSlider.addEventListener('pointercancel', () => { volDragging = false; });

  volBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clockPopup.classList.remove('open');
    powerPopup.classList.remove('open');
    volPopup.classList.toggle('open');
  });

  volPopup.addEventListener('click', (e) => e.stopPropagation());

  document.getElementById('power-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    clockPopup.classList.remove('open');
    volPopup.classList.remove('open');
    powerPopup.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    clockPopup.classList.remove('open');
    powerPopup.classList.remove('open');
    volPopup.classList.remove('open');
  });

  clockPopup.addEventListener('click', (e) => e.stopPropagation());
  powerPopup.addEventListener('click', (e) => e.stopPropagation());

  document.getElementById('dnd-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    e.currentTarget.classList.toggle('active');
  });

  document.getElementById('opt-shutdown').addEventListener('click', () => {
    window.location.href = '../shutdownanim/shutdownanim.html';
  });

  document.getElementById('opt-reboot').addEventListener('click', () => {
    window.location.href = '../shutdownanim/shutdownanim.html?reboot=1';
  });

  document.getElementById('opt-lock').addEventListener('click', () => {
    lockScreen();
    powerPopup.classList.remove('open');
  });

  function buildCalendar() {
    const cal = document.getElementById('popup-calendar');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const DAYS = ['M', 'T', 'W', 'Th', 'F', 'S', 'S'];
    const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    document.getElementById('popup-date-big').textContent =
      `${DAY_NAMES[now.getDay()]}\n${now.getDate()}. ${MONTH_NAMES[month]} ${year}`;

    cal.innerHTML = '';

    DAYS.forEach(d => {
      const h = document.createElement('div');
      h.className = 'cal-header';
      h.textContent = d;
      cal.appendChild(h);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();

    for (let i = 0; i < offset; i++) {
      const d = document.createElement('div');
      d.className = 'cal-day other-month';
      d.textContent = prevDays - offset + 1 + i;
      cal.appendChild(d);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const d = document.createElement('div');
      d.className = 'cal-day' + (i === now.getDate() ? ' today' : '');
      d.textContent = i;
      cal.appendChild(d);
    }
  }

})();