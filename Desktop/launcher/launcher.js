(function () {

  // same fallback chain as the taskbar: optimised png, then the original jpg
  const ORIGINAL = {
    terminal: 'terminal', files: 'files', code: 'code', paint: 'draw',
    viewer: 'imageviewer', monitor: 'monitor', calculator: 'calc', snake: 'snake',
  };

  const png = (name) => {
    const alt = ORIGINAL[name] ? `../assets/${ORIGINAL[name]}.jpg` : '';
    return `<img class="launcher-icon" src="../assets/icons/${name}.png" data-alt="${alt}" alt="">`;
  };

  const ICONS = {
    terminal: 'terminal', files: 'files', code: 'code', paint: 'paint',
    viewer: 'viewer', monitor: 'monitor', calculator: 'calculator',
    todo: 'todo', snake: 'snake', settings: 'settings', welcome: 'welcome',
    browser: 'browser',
  };

  const APPS = [
    { name: 'terminal', keys: 'shell console cli bash', run: () => openTerminal() },
    { name: 'files', keys: 'explorer folder fm', run: () => openFiles() },
    { name: 'code', keys: 'editor text write', run: () => openCode() },
    { name: 'paint', keys: 'draw canvas art brush', run: () => openPaint() },
    { name: 'viewer', keys: 'image picture photo png', run: () => openViewer() },
    { name: 'browser', keys: 'web internet surf tabs', run: () => openBrowser() },
    { name: 'monitor', keys: 'btop system stats cpu', run: () => openMonitor() },
    { name: 'calculator', keys: 'calc math numbers', run: () => openCalculator() },
    { name: 'todo', keys: 'tasks list', run: () => openTodo() },
    { name: 'snake', keys: 'game play arcade', run: () => openSnake() },
    { name: 'settings', keys: 'config prefs options', run: () => openSettings() },
    { name: 'welcome', keys: 'about help intro', run: () => openWelcome() },
  ];

  // .window files show up next to the built-in apps, keyed by their name
  function userApps() {
    if (!window.UserApps) return [];
    return window.UserApps.listWindows().map(w => ({
      name: w.name,
      keys: w.name.toLowerCase(),
      letter: w.letter,
      run: () => window.UserApps.openWindow(w.path),
    }));
  }

  function allApps() {
    return APPS.concat(userApps());
  }

  const post = (data) => window.postMessage(data, '*');

  const CMDS = [
    { name: 'theme dark', keys: 'night dim', run: () => post({ type: 'setTheme', theme: 'dark' }) },
    { name: 'theme light', keys: 'day bright', run: () => post({ type: 'setTheme', theme: 'light' }) },
    { name: 'layout normal', keys: 'float floating wm', run: () => post({ type: 'setWmMode', mode: 'normal' }) },
    { name: 'layout hyprland', keys: 'tiling dwindle wm', run: () => post({ type: 'setWmMode', mode: 'hyprland' }) },
    { name: 'layout niri', keys: 'scroll columns wm', run: () => post({ type: 'setWmMode', mode: 'niri' }) },
    { name: 'wallpaper night', keys: 'bg forest dark', run: () => post({ type: 'setWallpaper', file: 'Nightforrest.jpg' }) },
    { name: 'wallpaper day', keys: 'bg forest light', run: () => post({ type: 'setWallpaper', file: 'dayforrest.jpg' }) },
    { name: 'keybinds', keys: 'help shortcuts cheatsheet', run: () => toggleCheatsheet() },
    { name: 'overview', keys: 'windows expose grid', run: () => toggleOverview() },
    { name: 'lock', keys: 'afk away screen', run: () => lockScreen() },
    { name: 'shutdown', keys: 'power off exit', run: () => { window.location.href = '../shutdownanim/shutdownanim.html'; } },
    { name: 'reboot', keys: 'restart power', run: () => { window.location.href = '../shutdownanim/shutdownanim.html?reboot=1'; } },
  ];

  const backdrop = document.createElement('div');
  backdrop.className = 'launcher-backdrop';
  document.body.appendChild(backdrop);

  const box = document.createElement('div');
  box.className = 'launcher';
  box.innerHTML = `
    <div class="launcher-row">
      <span class="launcher-prompt">&gt;</span>
      <input type="text" class="launcher-input" placeholder="&gt; for commands" autocomplete="off" spellcheck="false">
    </div>
    <div class="launcher-list"></div>
  `;
  document.body.appendChild(box);

  const input = box.querySelector('.launcher-input');
  const list = box.querySelector('.launcher-list');
  const prompt = box.querySelector('.launcher-prompt');

  let open = false;
  let results = [];
  let sel = 0;

  const isCmdMode = () => input.value.startsWith('>');

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
    const cmd = isCmdMode();
    const q = (cmd ? input.value.slice(1) : input.value).trim().toLowerCase();
    const source = cmd ? CMDS : allApps();

    prompt.textContent = cmd ? '>' : '';
    box.classList.toggle('cmd-mode', cmd);
    box.classList.toggle('grid-mode', !cmd);

    results = source
      .map(e => ({ e, s: score(e, q) }))
      .filter(r => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map(r => r.e);

    if (sel >= results.length) sel = 0;

    if (!results.length) {
      list.innerHTML = '<div class="launcher-empty">nothing [-_-]</div>';
      return;
    }

    if (cmd) {
      list.innerHTML = results
        .map((e, i) => `<button class="launcher-item${i === sel ? ' selected' : ''}" data-i="${i}"></button>`)
        .join('');
    } else {
      list.innerHTML = results
        .map((e, i) => `
          <button class="launcher-tile${i === sel ? ' selected' : ''}" data-i="${i}">
            ${ICONS[e.name]
              ? png(ICONS[e.name])
              : e.letter
                ? `<span class="launcher-tile-letter">${e.letter}</span>`
                : '<span class="launcher-tile-dot"></span>'}
            <span class="launcher-tile-name"></span>
          </button>`)
        .join('');
    }

    list.querySelectorAll('.launcher-tile').forEach((el, i) => {
      el.querySelector('.launcher-tile-name').textContent = results[i].name;
      const img = el.querySelector('img');
      if (img) img.addEventListener('error', () => {
        if (img.dataset.alt) {
          const next = img.dataset.alt;
          img.dataset.alt = '';
          img.src = next;
          return;
        }
        const dot = document.createElement('span');
        dot.className = 'launcher-tile-dot';
        img.replaceWith(dot);
      });
    });

    list.querySelectorAll('.launcher-item, .launcher-tile').forEach((el, i) => {
      if (el.classList.contains('launcher-item')) el.textContent = results[i].name;
      el.addEventListener('click', () => run(i));
      el.addEventListener('mousemove', () => {
        if (sel === i) return;
        sel = i;
        highlight();
      });
    });
  }

  function highlight() {
    list.querySelectorAll('.launcher-item, .launcher-tile').forEach((el, i) => {
      el.classList.toggle('selected', i === sel);
    });
    list.children[sel]?.scrollIntoView?.({ block: 'nearest' });
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
  window.isLauncherOpen = () => open;

})();