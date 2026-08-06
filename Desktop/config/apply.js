// everything goes through the same postMessages the settings app sends,
// so there is only one path a setting can be changed by

window.ConfigApply = (function () {

  const post = (data) => window.postMessage(data, '*');

  function readJSON(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return (v && typeof v === 'object') ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }

  const PET_KEY = { fox: 'red', black: 'black', akita: 'akita' };

  function readState(fileName) {
    if (fileName === 'os.conf') {
      return {
        theme: localStorage.getItem('theme') || 'dark',
        wallpaper: localStorage.getItem('wallpaper') || 'Nightforrest.jpg',
      };
    }

    if (fileName === 'windows.conf') {
      return { layout: localStorage.getItem('wmMode') || 'normal' };
    }

    if (fileName === 'input.conf') {
      return { modifier: localStorage.getItem('keybindMod') || 'ctrl-alt' };
    }

    if (fileName === 'widgets.conf') {
      const vis = readJSON('widgetPrefs', { visible: {} }).visible || {};
      return {
        clock: vis.clock !== false,
        todo: vis.todo !== false,
      };
    }

    if (fileName === 'pets.conf') {
      const pets = readJSON('petCounts', { red: 1, black: 0, akita: 0 });
      return {
        fox: pets.red || 0,
        black: pets.black || 0,
        akita: pets.akita || 0,
      };
    }

    return {};
  }

  function applyValues(fileName, values) {
    const changed = [];
    const before = readState(fileName);

    const set = (key, fn) => {
      if (values[key] === undefined || values[key] === before[key]) return;
      fn(values[key]);
      changed.push(key);
    };

    if (fileName === 'os.conf') {
      set('theme', v => post({ type: 'setTheme', theme: v }));
      set('wallpaper', v => post({ type: 'setWallpaper', file: v }));
    }

    if (fileName === 'windows.conf') {
      set('layout', v => post({ type: 'setWmMode', mode: v }));
    }

    if (fileName === 'input.conf') {
      set('modifier', v => post({ type: 'setKeybindMod', mod: v }));
    }

    if (fileName === 'widgets.conf') {
      set('clock', v => post({ type: 'setWidgetVisible', widget: 'clock', visible: v }));
      set('todo', v => post({ type: 'setWidgetVisible', widget: 'todo', visible: v }));
    }

    if (fileName === 'pets.conf') {
      const petsChanged = ['fox', 'black', 'akita']
        .some(k => values[k] !== undefined && values[k] !== before[k]);

      if (petsChanged) {
        const merged = Object.assign({}, before, values);
        const capped = merged.fox + merged.black + merged.akita > 6;

        if (capped) {
          let left = 6;
          ['fox', 'black', 'akita'].forEach(k => {
            const take = Math.min(merged[k], left);
            merged[k] = take;
            left -= take;
          });
        }

        const pets = {};
        Object.keys(PET_KEY).forEach(k => { pets[PET_KEY[k]] = merged[k]; });

        post({ type: 'setPets', pets });
        changed.push(capped ? 'pets (capped at 6)' : 'pets');
      }
    }

    return changed;
  }

  return { readState, applyValues };

})();