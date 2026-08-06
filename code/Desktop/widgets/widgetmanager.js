(function () {

  const WIDGETS = [
    { key: 'clock', id: 'clock-widget' },
    { key: 'todo',  id: 'todo-widget'  },
  ];

  const MIN_SIZE = {
    clock: { w: 150, h: 80  },
    todo:  { w: 200, h: 220 },
  };

  function loadPrefs() {
    try {
      const stored = JSON.parse(localStorage.getItem('widgetPrefs'));
      if (stored && typeof stored === 'object') {
        return { visible: stored.visible || {}, layout: stored.layout || {} };
      }
    } catch (e) {}
    return { visible: {}, layout: {} };
  }

  const prefs = loadPrefs();

  function persist() {
    localStorage.setItem('widgetPrefs', JSON.stringify(prefs));
  }

  function el(key) {
    const w = WIDGETS.find(w => w.key === key);
    return w ? document.getElementById(w.id) : null;
  }

  /* the clock is content-sized by default; once the user resizes it,
     the font scales with the box so it doesn't just float in space */
  function scaleClock(widget, width) {
    const time = widget.querySelector('.clock-time');
    const secs = widget.querySelector('.clock-seconds');
    const date = widget.querySelector('.clock-date');
    if (!time) return;
    time.style.fontSize = Math.max(20, width * 0.19) + 'px';
    if (secs) secs.style.fontSize = Math.max(11, width * 0.08) + 'px';
    if (date) date.style.fontSize = Math.max(8,  width * 0.045) + 'px';
  }

  // the bar can sit on any edge, and a widget must not end up underneath it
  function freeArea() {
    const bar = document.querySelector('.footer');
    const side = document.body.dataset.bar || 'bottom';

    const area = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    if (!bar) return area;

    const r = bar.getBoundingClientRect();
    if (!r.width || !r.height) return area;

    if (side === 'top') area.top = r.bottom;
    else if (side === 'left') area.left = r.right;
    else if (side === 'right') area.right = r.left;
    else area.bottom = r.top;

    return area;
  }

  function clampToFree(x, y, w, h) {
    const a = freeArea();
    const pad = 8;

    return {
      x: Math.max(a.left + pad, Math.min(x, a.right - w - pad)),
      y: Math.max(a.top + pad, Math.min(y, a.bottom - h - pad)),
    };
  }

  function applyLayout(key) {
    const widget = el(key);
    const l = prefs.layout[key];
    if (!widget || !l) return;

    const fit = clampToFree(l.x, l.y, l.w, l.h);
    widget.style.left = fit.x + 'px';
    widget.style.top = fit.y + 'px';
    widget.style.right = 'auto';          // todo widget is right-anchored by default
    widget.style.width = l.w + 'px';
    widget.style.height = l.h + 'px';
    widget.style.maxHeight = 'none';      // todo widget has a max-height in its css
    if (key === 'clock') scaleClock(widget, l.w);
  }

  function applyVisibility(key) {
    const widget = el(key);
    if (!widget) return;
    const visible = prefs.visible[key] !== false; // default: visible
    widget.style.display = visible ? '' : 'none';
  }

  WIDGETS.forEach(w => { applyVisibility(w.key); applyLayout(w.key); });

  let editing = false;

  const doneBtn = document.createElement('button');
  doneBtn.className = 'widget-edit-done';
  doneBtn.textContent = 'Done';
  doneBtn.addEventListener('click', () => setEditMode(false));
  document.body.appendChild(doneBtn);

  function setEditMode(on) {
    if (editing === on) return;
    editing = on;
    document.body.classList.toggle('widget-editing', on);

    WIDGETS.forEach(w => {
      const widget = el(w.key);
      if (!widget) return;

      if (on) {
        // hidden widgets show up faded so they can still be arranged
        widget.style.display = '';
        widget.classList.toggle('widget-ghost', prefs.visible[w.key] === false);

        const handle = document.createElement('div');
        handle.className = 'widget-resize-handle';
        widget.appendChild(handle);

        widget.addEventListener('pointerdown', onPointerDown);
      } else {
        widget.classList.remove('widget-ghost');
        widget.querySelector('.widget-resize-handle')?.remove();
        widget.removeEventListener('pointerdown', onPointerDown);
        applyVisibility(w.key);
      }
    });

    if (!on) persist();
  }

  let drag = null; // { widget, key, mode:'move'|'resize', startX, startY, x, y, w, h }

  function onPointerDown(e) {
    const widget = e.currentTarget;
    const key = WIDGETS.find(w => w.id === widget.id)?.key;
    const rect = widget.getBoundingClientRect();

    drag = {
      widget, key,
      mode: e.target.classList.contains('widget-resize-handle') ? 'resize' : 'move',
      startX: e.clientX, startY: e.clientY,
      x: rect.left, y: rect.top, w: rect.width, h: rect.height,
    };

    widget.setPointerCapture(e.pointerId);
    widget.addEventListener('pointermove', onPointerMove);
    widget.addEventListener('pointerup', onPointerUp);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const min = MIN_SIZE[drag.key];

    let { x, y, w, h } = drag;

    if (drag.mode === 'move') {
      x = Math.min(Math.max(0, x + dx), window.innerWidth - w);
      y = Math.min(Math.max(0, y + dy), window.innerHeight - h);
    } else {
      w = Math.min(Math.max(min.w, w + dx), window.innerWidth - x);
      h = Math.min(Math.max(min.h, h + dy), window.innerHeight - y);
    }

    prefs.layout[drag.key] = {
      x: Math.round(x), y: Math.round(y),
      w: Math.round(w), h: Math.round(h),
    };
    applyLayout(drag.key);
  }

  function onPointerUp() {
    if (!drag) return;
    drag.widget.removeEventListener('pointermove', onPointerMove);
    drag.widget.removeEventListener('pointerup', onPointerUp);
    drag = null;
  }

  // when the bar moves, every widget has to be pushed clear of it again
  function refitAll() {
    Object.keys(prefs.layout).forEach(applyLayout);
  }

  new MutationObserver(() => {
    if (!document.body) return;
    setTimeout(refitAll, 60);
  }).observe(document.body, { attributes: true, attributeFilter: ['data-bar'] });

  window.addEventListener('resize', refitAll);

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg?.type === 'setWidgetVisible') {
      prefs.visible[msg.widget] = !!msg.visible;
      persist();
      if (editing) {
        el(msg.widget)?.classList.toggle('widget-ghost', !msg.visible);
      } else {
        applyVisibility(msg.widget);
      }
    }
    if (msg?.type === 'widgetEditMode') {
      const settingsWin = document.querySelector('.app-window[data-app="win-settings"]')
                       || document.getElementById('win-settings');
      if (settingsWin) {
        settingsWin.dataset.minimized = 'true';
        settingsWin.style.display = 'none';
      }
      setEditMode(true);
    }
  });

  // widgets built from .widget files register themselves through here, so they
  // get the same visibility, drag and resize handling as the built-in ones
  function register(opts) {
    if (!opts || WIDGETS.some(w => w.key === opts.key)) return;

    WIDGETS.push({ key: opts.key, id: opts.id });
    MIN_SIZE[opts.key] = opts.min || { w: 140, h: 100 };

    if (prefs.visible[opts.key] === undefined && opts.defaultVisible !== undefined) {
      prefs.visible[opts.key] = opts.defaultVisible;
    }
    if (!prefs.layout[opts.key] && opts.defaultLayout) {
      prefs.layout[opts.key] = { ...opts.defaultLayout };
    }

    applyVisibility(opts.key);
    applyLayout(opts.key);

    // if the user is already arranging widgets, wire the new one up live
    if (editing) {
      const widget = el(opts.key);
      if (widget) {
        widget.style.display = '';
        widget.classList.toggle('widget-ghost', prefs.visible[opts.key] === false);
        const handle = document.createElement('div');
        handle.className = 'widget-resize-handle';
        widget.appendChild(handle);
        widget.addEventListener('pointerdown', onPointerDown);
      }
    }
  }

  function unregister(key) {
    const i = WIDGETS.findIndex(w => w.key === key);
    if (i < 0) return;
    WIDGETS.splice(i, 1);
    delete MIN_SIZE[key];
  }

  function isVisible(key) {
    return prefs.visible[key] !== false;
  }

  window.WidgetManager = { register, unregister, isVisible };

})();