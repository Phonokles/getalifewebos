(function () {

  const WS_COUNT = document.querySelectorAll('.ws-dot').length || 4;

  const STRIP_TOP = 26;
  const THUMB_H = 104;
  const LABEL_H = 24;

  let overviewOpen = false;


  const hotCorner = document.createElement('div');
  hotCorner.className = 'ov-hotcorner';
  document.body.appendChild(hotCorner);

  const backdrop = document.createElement('div');
  backdrop.className = 'ov-backdrop';
  document.body.appendChild(backdrop);

  const topStrip = document.createElement('div');      
  topStrip.className = 'ov-topstrip';
  document.body.appendChild(topStrip);

  const labelLayer = document.createElement('div');    
  labelLayer.className = 'ov-labels';
  document.body.appendChild(labelLayer);

  const niriLayer = document.createElement('div');     
  niriLayer.className = 'ov-niri-layer';
  document.body.appendChild(niriLayer);

  hotCorner.addEventListener('mouseenter', (e) => {
    if (e.buttons !== 0) return;                       
    if (document.body.classList.contains('widget-editing')) return;
    if (!overviewOpen) openOverview();
  });

  window.toggleOverview = function () {
    if (document.body.classList.contains('widget-editing')) return;
    if (overviewOpen) {
      closeOverview();
    } else {
      openOverview();
    }
  };

  backdrop.addEventListener('click', closeOverview);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overviewOpen) closeOverview();
  });

  window.addEventListener('keydown', (e) => {
    if (!overviewOpen) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    if (wmMode !== 'niri') return;

    const wins = winsOfWs(currentWorkspace);
    if (wins.length < 2) return;

    let idx = wins.findIndex(w => w.id === focusedId);
    if (idx < 0) idx = 0;
    idx = e.key === 'ArrowRight'
      ? (idx + 1) % wins.length
      : (idx - 1 + wins.length) % wins.length;
    focusedId = wins[idx].id;

    const area = getWorkArea();
    const colW = (area.w - GAP) / 2;
    const step = colW + GAP;
    let scroll = niriScroll[currentWorkspace] || 0;
    const colLeft = idx * step;
    if (colLeft < scroll) scroll = colLeft;
    if (colLeft + colW > scroll + area.w) scroll = colLeft + colW - area.w;
    scroll = Math.max(0, Math.min(scroll, Math.max(0, wins.length * step - GAP - area.w)));
    niriScroll[currentWorkspace] = scroll;

    renderNiri();
  });

  document.querySelectorAll('.ws-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      if (!overviewOpen) return;
      render();
    });
  });
  function allWins() {
    return tileOrder
      .map(id => document.getElementById(id))
      .filter(w => w && w.dataset.minimized !== 'true');
  }

  function winsOfWs(ws) {
    return allWins().filter(w => parseInt(w.dataset.workspace || '1', 10) === ws);
  }

  function winRect(win) {
    return {
      x: parseFloat(win.style.left) || 0,
      y: parseFloat(win.style.top) || 0,
      w: parseFloat(win.style.width) || 400,
      h: parseFloat(win.style.height) || 300,
    };
  }

  function project(win, x, y, s) {
    const r = winRect(win);
    win.style.transformOrigin = '0 0';
    win.style.transform =
      `translate(${Math.round(x - r.x)}px, ${Math.round(y - r.y)}px) scale(${s})`;
  }

  function clearProjection(win) {
    win.style.transform = '';
  }

  function wallpaperImage() {
    const wp = document.getElementById('wallpaper');
    return wp ? getComputedStyle(wp).backgroundImage : 'none';
  }

  function render() {
    if (wmMode === 'niri') {
      renderNiri();
    } else {
      renderSpread();
    }
  }
  function renderThumbs() {
    topStrip.innerHTML = '';
    const wallpaper = wallpaperImage();
    const thumbW = Math.round(THUMB_H * (window.innerWidth / window.innerHeight));

    for (let n = 1; n <= WS_COUNT; n++) {
      const card = document.createElement('button');
      card.className = 'ov-desk' + (n === currentWorkspace ? ' active' : '');

      const label = document.createElement('span');
      label.className = 'ov-desk-label';
      label.textContent = 'Desktop ' + n;


      const preview = document.createElement('span');
      preview.className = 'ov-desk-preview';
      preview.style.width = thumbW + 'px';
      preview.style.height = THUMB_H + 'px';
      preview.style.backgroundImage = wallpaper;

      const sx = thumbW / window.innerWidth;
      const sy = THUMB_H / window.innerHeight;
      winsOfWs(n).forEach(win => {
        const r = winRect(win);
        const box = document.createElement('span');
        box.className = 'ov-desk-win';
        box.style.cssText =
          `left:${r.x * sx}px; top:${r.y * sy}px; width:${r.w * sx}px; height:${r.h * sy}px;`;
        preview.appendChild(box);
      });

      card.appendChild(label);
      card.appendChild(preview);
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        switchWorkspace(n);                          
        renderSpread();
      });
      topStrip.appendChild(card);
    }
  }


  function renderSpread() {
    renderThumbs();
    labelLayer.innerHTML = '';

    const area = getWorkArea();
    const stripBottom = STRIP_TOP + LABEL_H + THUMB_H + 30;
    const top = Math.max(area.y, stripBottom);
    const availH = area.h - (top - area.y);
    const wins = winsOfWs(currentWorkspace);
    if (!wins.length) return;

    const cols = Math.ceil(Math.sqrt(wins.length));
    const rows = Math.ceil(wins.length / cols);
    const cellW = area.w / cols;
    const cellH = availH / rows;
    const PAD = 30;

    wins.forEach((win, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const r = winRect(win);

      const s = Math.min(
        (cellW - PAD * 2) / r.w,
        (cellH - PAD * 2 - LABEL_H) / r.h,
        0.9
      );
      const w = r.w * s;
      const h = r.h * s;
      const x = area.x + col * cellW + (cellW - w) / 2;
      const y = top + row * cellH + LABEL_H + (cellH - LABEL_H - h) / 2;

      project(win, x, y, s);

      const title = win.querySelector('.window-title')?.textContent || win.id;
      const label = document.createElement('span');
      label.className = 'ov-win-label';
      label.textContent = title;
      label.style.cssText = `left:${Math.round(x)}px; top:${Math.round(y - LABEL_H)}px; max-width:${Math.round(w)}px;`;
      labelLayer.appendChild(label);
    });
  }


  function renderNiri() {
    niriLayer.innerHTML = '';
    labelLayer.innerHTML = '';

    const M = 30;                                     
    const slotGap = 22;
    const slotH = (window.innerHeight - M * 2 - slotGap * (WS_COUNT - 1)) / WS_COUNT;
    const area = getWorkArea();
    const s = slotH / area.h;                        
    const slotW = window.innerWidth * s;
    const slotX = (window.innerWidth - slotW) / 2;    
    const colW = (area.w - GAP) / 2;
    const step = colW + GAP;

    for (let ws = 1; ws <= WS_COUNT; ws++) {
      const slotY = M + (ws - 1) * (slotH + slotGap);
      const scroll = niriScroll[ws] || 0;

      winsOfWs(ws).forEach((win, i) => {
        win.style.display = 'flex';                 
        win.style.width = colW + 'px';
        win.style.height = area.h + 'px';
        win.classList.add('tiled');
        win.classList.toggle('wm-focused', win.id === focusedId);
        const vx = area.x + i * step - scroll;
        project(win, slotX + vx * s, slotY, s);
      });

      const slot = document.createElement('button');
      slot.className = 'ov-ws-slot' + (ws === currentWorkspace ? ' active' : '');
      slot.style.cssText = `left:${slotX}px; top:${slotY}px; width:${slotW}px; height:${slotH}px;`;
      slot.innerHTML = `<span>${ws}</span>`;
      slot.addEventListener('click', (e) => {
        e.stopPropagation();
        closeOverview();
        switchWorkspace(ws);
      });
      niriLayer.appendChild(slot);
    }
  }

  function onWinClick(e) {
    e.stopPropagation();
    const win = e.currentTarget;
    const ws = parseInt(win.dataset.workspace || '1', 10);
    closeOverview();
    if (ws !== currentWorkspace) switchWorkspace(ws);
    setFocus(win);
  }

  function openOverview() {
    overviewOpen = true;
    document.body.classList.add('overview-active');
    allWins().forEach(w => w.addEventListener('click', onWinClick));
    render();
  }

  function closeOverview() {
    if (!overviewOpen) return;
    overviewOpen = false;
    document.body.classList.remove('overview-active');
    topStrip.innerHTML = '';
    niriLayer.innerHTML = '';
    labelLayer.innerHTML = '';

    allWins().forEach(w => {
      w.removeEventListener('click', onWinClick);
      clearProjection(w);
      updateWindowVisibility(w);                   
    });
    relayout();
  }

})();