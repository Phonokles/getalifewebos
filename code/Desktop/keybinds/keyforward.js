// laeuft in jedem app-iframe. tastendruecke im iframe erreichen den desktop
// nicht von selbst, also werden hier zwei dinge nach oben geschickt:
//   1. alt antippen  -> launcher
//   2. alt/meta-kombis -> keybind (der desktop entscheidet ob es passt)
// bewusst NICHT weitergeleitet: reines strg+taste (z.B. ^S/^X in nano) und
// AltGr (schreibt @ { } [ ] €) - die bleiben in der app.
(function () {
  const MOD_KEYS = ['Alt', 'Control', 'Meta', 'Shift', 'AltGraph'];
  let altArmed = false;

  window.addEventListener('keydown', (e) => {
    // alt-tap scharf machen / entschaerfen
    if (e.key === 'Alt' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.repeat) {
      altArmed = true;
    } else {
      altArmed = false;
    }

    const altGraph = typeof e.getModifierState === 'function' && e.getModifierState('AltGraph');
    const isModKey = MOD_KEYS.includes(e.key);

    // nur alt/meta-kombis (decken strg+alt, alt und super ab), kein AltGr
    if (!isModKey && (e.altKey || e.metaKey) && !altGraph) {
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