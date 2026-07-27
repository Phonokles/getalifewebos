(function () {

  const svg = (inner) =>
    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

  const APPS = {
    'win-terminal': { label: 'terminal', open: 'openTerminal', icon: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3"/><line x1="12" y1="15" x2="16" y2="15"/>') },
    'win-files': { label: 'files', open: 'openFiles', icon: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>') },
    'win-settings': { label: 'settings', open: 'openSettings', icon: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>') },
    'win-code': { label: 'code', open: 'openCode', icon: svg('<polyline points="8 6 2 12 8 18"/><polyline points="16 6 22 12 16 18"/>') },
    'win-paint': { label: 'paint', open: 'openPaint', icon: svg('<path d="M15.5 3.5l5 5L9 20H4v-5z"/><line x1="13" y1="6" x2="18" y2="11"/>') },
    'win-viewer': { label: 'viewer', open: 'openViewer', icon: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-6 6-2-2-5 5"/>') },
    'win-monitor': { label: 'monitor', open: 'openMonitor', icon: svg('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M6 13l3-4 2.5 3L14 9l4 4"/><line x1="9" y1="21" x2="15" y2="21"/>') },
    'win-calculator': { label: 'calculator', open: 'openCalculator', icon: svg('<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="17" x2="16" y2="17"/>') },
    'win-todo': { label: 'todo', open: 'openTodo', icon: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>') },
    'win-snake': { label: 'snake', open: 'openSnake', icon: svg('<path d="M4 17V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4"/><circle cx="19" cy="7" r="0.6" fill="currentColor"/>') },
    'win-welcome': { label: 'welcome', open: 'openWelcome', icon: svg('<circle cx="12" cy="12" r="9"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="10" r="0.6" fill="currentColor"/><circle cx="15" cy="10" r="0.6" fill="currentColor"/>') },
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
    clockPopup.classList.toggle('open');
    if (clockPopup.classList.contains('open')) buildCalendar();
  });

  document.getElementById('power-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    clockPopup.classList.remove('open');
    powerPopup.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    clockPopup.classList.remove('open');
    powerPopup.classList.remove('open');
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