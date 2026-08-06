// runs inside every app iframe. keypresses there never reach the desktop,
// so mod combos and alt taps get posted up. plain ctrl+key stays in the app
// so nano keeps ^S, and AltGr stays so it can still type @ { } [ ]
(function () {
  const MOD_KEYS = ['Alt', 'Control', 'Meta', 'Shift', 'AltGraph'];
  let altArmed = false;

  window.addEventListener('keydown', (e) => {
    altArmed = e.key === 'Alt' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.repeat;

    const altGraph = typeof e.getModifierState === 'function' && e.getModifierState('AltGraph');

    if (!MOD_KEYS.includes(e.key) && (e.altKey || e.metaKey) && !altGraph) {
      window.parent.postMessage({
        type: 'keybind',
        key: e.key,
        code: e.code,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        altGraph: altGraph,
      }, '*');
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt' && altArmed) {
      altArmed = false;
      e.preventDefault();
      window.parent.postMessage({ type: 'altTap' }, '*');
    }
  });

  window.addEventListener('blur', () => { altArmed = false; });
})();

// the desktop pushes the window transparency here, because css variables do
// not cross an iframe boundary
window.addEventListener('message', (e) => {
  if (e.data?.type !== 'setWinAlpha') return;
  document.documentElement.style.setProperty('--win-alpha', String(e.data.alpha));
});