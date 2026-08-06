(function () {

  // ── verfuegbare modifier ────────────────────────────────────────────────
  // test bekommt einen normalisierten state {ctrlKey, altKey, metaKey, altGraph},
  // damit echte events und aus iframes weitergeleitete events gleich behandelt werden.
  const MODS = {
    'ctrl-alt': {
      label: 'strg+alt',
      hint:  'AltGr bleibt frei fuer @ { } [ ] |',
      test:  s => s.ctrlKey && s.altKey && !s.altGraph,
    },
    'alt': {
      label: 'alt',
      hint:  'nur die linke alt-taste',
      test:  s => s.altKey && !s.ctrlKey && !s.altGraph,
    },
    'super': {
      label: 'super',
      hint:  'windows-taste - manche kombis frisst windows selbst',
      test:  s => s.metaKey && !s.ctrlKey && !s.altKey,
    },
  };

  let activeMod = localStorage.getItem('keybindMod');
  if (!MODS[activeMod]) activeMod = 'ctrl-alt';

  const stateOf = (e) => ({
    ctrlKey: !!e.ctrlKey,
    altKey:  !!e.altKey,
    metaKey: !!e.metaKey,
    altGraph: typeof e.getModifierState === 'function'
      ? e.getModifierState('AltGraph')
      : !!e.altGraph,
  });

  const modActive = (state) => MODS[activeMod].test(state);

  // ── bind-liste ──────────────────────────────────────────────────────────
  const binds = [];

  function bind(key, desc, run, opts = {}) {
    binds.push({ key, shift: !!opts.shift, desc, run });
  }

  function focusedWin() {
    return focusedId ? document.getElementById(focusedId) : null;
  }

  function cycleFocus(dir) {
    const wins = visibleWins().filter(w => w.dataset.fullscreen !== 'true');
    if (!wins.length) return;
    let idx = wins.findIndex(w => w.id === focusedId);
    if (idx < 0) idx = 0;
    setFocus(wins[(idx + dir + wins.length) % wins.length]);
  }

  function moveFocusedTo(n) {
    const win = focusedWin();
    if (!win) return;
    if (parseInt(win.dataset.workspace || '1', 10) === n) return;

    win.dataset.workspace = String(n);
    updateWindowVisibility(win);
    relayout();
    pushNotification('window moved', 'workspace ' + n, 2000);
  }

  function closeFocused() {
    const win = focusedWin();
    if (!win) return;
    // gleicher weg wie der x-button (zerstoert das fenster jetzt wirklich)
    win.querySelector('.window-btn.close').click();
  }

  function toggleFocusedFullscreen() {
    const win = focusedWin();
    if (win) toggleFullscreen(win);
  }

  function cycleWmMode() {
    const modes = ['normal', 'hyprland', 'niri'];
    const next = modes[(modes.indexOf(wmMode) + 1) % modes.length];
    setWmMode(next);
    pushNotification('layout', next, 1800);
  }

  for (let n = 1; n <= 4; n++) {
    bind(String(n), 'workspace ' + n, () => switchWorkspace(n));
    bind(String(n), 'move window to ws ' + n, () => moveFocusedTo(n), { shift: true });
  }

  bind('enter', 'terminal',      () => openTerminal());
  bind('e',     'files',         () => openFiles());
  bind('c',     'code',          () => openCode());
  bind('q',     'close window',  closeFocused);
  bind('f',     'fullscreen',    toggleFocusedFullscreen);
  bind('h',     'focus left',    () => cycleFocus(-1));
  bind('l',     'focus right',   () => cycleFocus(1));
  bind('w',     'cycle layout',  cycleWmMode);
  bind('o',     'overview',      () => toggleOverview());
  bind('x',     'lock screen',   () => lockScreen());
  bind('k',     'this list',     () => toggleCheatsheet());

  function keyOf(e) {
    const code = e.code || '';
    if (/^Digit[1-9]$/.test(code)) return code.slice(5);
    if (/^Key[A-Z]$/.test(code))   return code.slice(3).toLowerCase();
    if (code === 'Enter' || code === 'NumpadEnter') return 'enter';
    if (code === 'Space') return 'space';
    return (e.key || '').toLowerCase();
  }

  function dispatch(key, shift) {
    const b = binds.find(b => b.key === key && b.shift === shift);
    if (!b) return false;
    b.run();
    return true;
  }

  // tastendruecke im top-dokument
  window.addEventListener('keydown', (e) => {
    if (!modActive(stateOf(e))) return;
    if (dispatch(keyOf(e), e.shiftKey)) e.preventDefault();
  });

  // ── launcher: alt antippen (druecken + loslassen ohne andere taste) ──────
  let altArmed = false;

  function armFromKeydown(e) {
    if (e.key === 'Alt' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.repeat) {
      altArmed = true;          // alt allein gedrueckt
    } else {
      altArmed = false;         // irgendeine andere taste -> kein sauberer tap
    }
  }

  window.addEventListener('keydown', armFromKeydown);

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt' && altArmed) {
      altArmed = false;
      e.preventDefault();
      toggleLauncher();
    }
  });

  window.addEventListener('blur', () => { altArmed = false; });

  // ── events aus den app-iframes (siehe keyforward.js) ─────────────────────
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d) return;

    if (d.type === 'altTap') {
      toggleLauncher();
      return;
    }

    if (d.type === 'keybind') {
      if (modActive(stateOf(d))) dispatch(keyOf(d), !!d.shiftKey);
      return;
    }

    if (d.type === 'setKeybindMod' && MODS[d.mod]) {
      activeMod = d.mod;
      localStorage.setItem('keybindMod', activeMod);
      if (sheetOpen) renderSheet();
      pushNotification('keybinds', 'modifier: ' + MODS[activeMod].label, 2200);
      return;
    }
  });

  // ── cheatsheet ───────────────────────────────────────────────────────────
  const sheet = document.createElement('div');
  sheet.className = 'keys-sheet';
  document.body.appendChild(sheet);

  let sheetOpen = false;

  function renderSheet() {
    const mod = MODS[activeMod];
    const rows = binds.map(b => `
      <div class="keys-row">
        <span class="keys-combo">${mod.label}${b.shift ? ' + shift' : ''} + ${b.key}</span>
        <span class="keys-desc">${b.desc}</span>
      </div>
    `).join('');

    sheet.innerHTML = `
      <div class="keys-panel">
        <div class="keys-title">keybinds <span>[*_*]</span></div>
        <div class="keys-pin">alt antippen<span class="keys-pin-desc">launcher</span></div>
        <div class="keys-grid">${rows}</div>
        <div class="keys-foot">${mod.label} &middot; ${mod.hint} &middot; esc schliesst</div>
      </div>
    `;
  }

  window.toggleCheatsheet = function () {
    sheetOpen = !sheetOpen;
    document.body.classList.toggle('keys-open', sheetOpen);
    if (sheetOpen) renderSheet();
  };

  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) toggleCheatsheet();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetOpen) toggleCheatsheet();
  });

  if (!localStorage.getItem('keybindHintSeen')) {
    localStorage.setItem('keybindHintSeen', '1');
    setTimeout(() => pushNotification('keybinds', 'alt antippen oeffnet den launcher', 9000), 3000);
  }

})();