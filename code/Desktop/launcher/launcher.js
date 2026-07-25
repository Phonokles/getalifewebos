(function () {

  const svg = (inner) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

  const ICON = {
    terminal: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3"/><line x1="12" y1="15" x2="16" y2="15"/>'),
    files:    svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    code:     svg('<polyline points="8 6 2 12 8 18"/><polyline points="16 6 22 12 16 18"/>'),
    calc:     svg('<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="17" x2="16" y2="17"/>'),
    todo:     svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>'),
    snake:    svg('<path d="M4 17V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4"/><circle cx="19" cy="7" r="0.6" fill="currentColor"/>'),
    grid:     svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    lock:     svg('<rect x="5" y="11" width="14" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    theme:    svg('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/>'),
    layout:   svg('<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="14" y="15" width="7" height="5" rx="1"/>'),
    help:     svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3 2.4V14"/><circle cx="12" cy="17.5" r="0.6" fill="currentColor"/>'),
  };

  // laufen über den eigenen message-handler in window.js, damit die logik nur einmal existiert
  const post = (data) => window.postMessage(data, '*');

  const entries = [
    { name: 'terminal',         keys: 'shell console cli bash',   tag: 'app', icon: ICON.terminal, run: () => openTerminal() },
    { name: 'files',            keys: 'explorer ordner fm',       tag: 'app', icon: ICON.files,    run: () => openFiles() },
    { name: 'code',             keys: 'editor text write',        tag: 'app', icon: ICON.code,     run: () => openCode() },
    { name: 'calculator',       keys: 'calc rechner math',        tag: 'app', icon: ICON.calc,     run: () => openCalculator() },
    { name: 'todo',             keys: 'tasks liste',              tag: 'app', icon: ICON.todo,     run: () => openTodo() },
    { name: 'settings',         keys: 'config einstellungen',     tag: 'app', icon: ICON.settings, run: () => openSettings() },
    { name: 'snake',            keys: 'game spiel play',          tag: 'app', icon: ICON.snake,    run: () => openSnake() },

    { name: 'overview',         keys: 'windows expose fenster',   tag: 'sys', icon: ICON.grid,   run: () => toggleOverview() },
    { name: 'keybinds',         keys: 'help hilfe shortcuts',     tag: 'sys', icon: ICON.help,   run: () => toggleCheatsheet() },
    { name: 'lock screen',      keys: 'sperren afk',              tag: 'sys', icon: ICON.lock,   run: () => lockScreen() },
    { name: 'theme: dark',      keys: 'dunkel night',             tag: 'sys', icon: ICON.theme,  run: () => post({ type: 'setTheme', theme: 'dark' }) },
    { name: 'theme: light',     keys: 'hell day',                 tag: 'sys', icon: ICON.theme,  run: () => post({ type: 'setTheme', theme: 'light' }) },
    { name: 'layout: normal',   keys: 'float floating wm',        tag: 'sys', icon: ICON.layout, run: () => post({ type: 'setWmMode', mode: 'normal' }) },
    { name: 'layout: hyprland', keys: 'tiling dwindle wm',        tag: 'sys', icon: ICON.layout, run: () => post({ type: 'setWmMode', mode: 'hyprland' }) },
    { name: 'layout: niri',     keys: 'scroll columns wm',        tag: 'sys', icon: ICON.layout, run: () => post({ type: 'setWmMode', mode: 'niri' }) },
  ];

  const backdrop = document.createElement('div');
  backdrop.className = 'launcher-backdrop';
  document.body.appendChild(backdrop);

  const box = document.createElement('div');
  box.className = 'launcher';
  box.innerHTML = `
    <div class="launcher-row">
      <span class="launcher-prompt">&gt;</span>
      <input type="text" class="launcher-input" placeholder="type to search..." autocomplete="off" spellcheck="false">
    </div>
    <div class="launcher-list"></div>
    <div class="launcher-hint">
      <span>enter · run</span>
      <span>up/down · select</span>
      <span>esc · close</span>
    </div>
  `;
  document.body.appendChild(box);

  const input = box.querySelector('.launcher-input');
  const list  = box.querySelector('.launcher-list');

  let open = false;
  let results = [];
  let sel = 0;

  function score(entry, q) {
    if (!q) return 1;
    const name = entry.name.toLowerCase();
    if (name.startsWith(q)) return 4;
    if (name.includes(q)) return 3;
    if (entry.keys.includes(q)) return 2;

    let i = 0;
    for (const c of name) {
      if (c === q[i]) i++;
      if (i === q.length) return 1;
    }
    return 0;
  }

  function render() {
    const q = input.value.trim().toLowerCase();

    results = entries
      .map(e => ({ e, s: score(e, q) }))
      .filter(r => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map(r => r.e);

    if (sel >= results.length) sel = 0;

    if (!results.length) {
      list.innerHTML = '<div class="launcher-empty">nothing here [-_-]</div>';
      return;
    }

    list.innerHTML = results.map((e, i) => `
      <div class="launcher-item${i === sel ? ' selected' : ''}" data-i="${i}">
        ${e.icon}
        <span>${e.name}</span>
        <span class="launcher-tag">${e.tag}</span>
      </div>
    `).join('');

    list.querySelectorAll('.launcher-item').forEach(el => {
      const i = parseInt(el.dataset.i, 10);
      el.addEventListener('click', () => run(i));
      el.addEventListener('mousemove', () => {
        if (sel === i) return;
        sel = i;
        highlight();
      });
    });
  }

  function highlight() {
    list.querySelectorAll('.launcher-item').forEach((el, i) => {
      el.classList.toggle('selected', i === sel);
    });
    const el = list.children[sel];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function run(i) {
    const entry = results[i];
    if (!entry) return;
    closeLauncher();
    entry.run();
  }

  function openLauncher() {
    open = true;
    sel = 0;
    input.value = '';
    document.body.classList.add('launcher-open');
    render();
    input.focus();
  }

  function closeLauncher() {
    if (!open) return;
    open = false;
    document.body.classList.remove('launcher-open');
    input.blur();
  }

  input.addEventListener('input', () => {
    sel = 0;
    render();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLauncher();
      e.preventDefault();
      return;
    }
    if (!results.length) return;

    if (e.key === 'ArrowDown') {
      sel = (sel + 1) % results.length;
      highlight();
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      sel = (sel - 1 + results.length) % results.length;
      highlight();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      run(sel);
      e.preventDefault();
    }
  });

  backdrop.addEventListener('click', closeLauncher);

  window.toggleLauncher = function () {
    if (open) closeLauncher(); else openLauncher();
  };

  window.closeLauncher = closeLauncher;

  window.isLauncherOpen = function () {
    return open;
  };

})();