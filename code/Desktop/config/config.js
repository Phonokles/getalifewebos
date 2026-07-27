// the fs only lives in RAM, so the conf files get rebuilt from the real state
// on every boot. the values still survive because applying them goes through
// the same channels as the settings app, which store them in localStorage

(function () {

  const FS = window.WebOSFS;
  const SCHEMA = window.ConfigSchema;
  const PARSER = window.ConfigParser;
  const APPLY = window.ConfigApply;

  const missing = [
    !FS && 'WebOSFS (applications/Files/filesystem.js)',
    !SCHEMA && 'ConfigSchema (config/schema.js)',
    !PARSER && 'ConfigParser (config/parser.js)',
    !APPLY && 'ConfigApply (config/apply.js)',
  ].filter(Boolean);

  if (missing.length) {
    console.warn('[config] not starting, missing: ' + missing.join(', '));
    return;
  }

  const DIR = SCHEMA.dir;
  const pathOf = (name) => `${DIR}/${name}`;

  let busy = false;

  function seed() {
    if (!FS.exists(DIR)) FS.createFolder('', DIR);

    SCHEMA.files.forEach(fileDef => {
      if (FS.exists(pathOf(fileDef.name))) return;
      FS.writeFile(DIR, fileDef.name, PARSER.serialize(fileDef, APPLY.readState(fileDef.name)));
    });
  }

  function loadAndApply(fileName) {
    const fileDef = SCHEMA.files.find(f => f.name === fileName);
    if (!fileDef) return;

    const text = FS.readFile(pathOf(fileName));
    if (text === null) return;

    const { values, errors } = PARSER.parse(text, fileName);

    if (errors.length) {
      const first = errors[0];
      const more = errors.length > 1 ? ` (+${errors.length - 1} more)` : '';
      pushNotification(fileName + ' [-_-]', `line ${first.line}: ${first.msg}${more}`, 7000);
    }

    const changed = APPLY.applyValues(fileName, values);

    if (changed.length) {
      pushNotification(fileName + ' [*_*]', changed.join(', ') + ' applied', 3000);
    } else if (!errors.length) {
      pushNotification(fileName, 'nothing changed', 2000);
    }
  }

  function syncFromState() {
    if (busy) return;

    SCHEMA.files.forEach(fileDef => {
      const path = pathOf(fileDef.name);
      if (!FS.exists(path)) return;

      const state = APPLY.readState(fileDef.name);
      const original = FS.readFile(path);
      let text = original;

      fileDef.keys.forEach(def => {
        if (!PARSER.accepts(def, state[def.key])) return;
        if (PARSER.parse(text, fileDef.name).values[def.key] === state[def.key]) return;
        text = PARSER.updateKey(text, def, state[def.key]);
      });

      if (text !== original) {
        busy = true;
        FS.writeFile(DIR, fileDef.name, text);
        busy = false;
      }
    });
  }

  FS.subscribe((changedPath) => {
    if (busy || !changedPath || !changedPath.startsWith(DIR + '/')) return;

    const name = changedPath.slice(DIR.length + 1);
    if (!SCHEMA.files.some(f => f.name === name)) return;

    busy = true;
    try {
      loadAndApply(name);
    } finally {
      busy = false;
    }
  });

  const WATCHED = ['setTheme', 'setWallpaper', 'setWmMode', 'setKeybindMod', 'setPets', 'setWidgetVisible'];

  // postMessage lands in localStorage a tick later, hence the timeout
  window.addEventListener('message', (e) => {
    if (!e.data || !WATCHED.includes(e.data.type)) return;
    clearTimeout(syncFromState._t);
    syncFromState._t = setTimeout(syncFromState, 120);
  });

  seed();

  window.WebOSConfig = { seed, loadAndApply, syncFromState, dir: DIR };

})();

