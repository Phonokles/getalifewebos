
const _notifQueue = [];   // aktuell sichtbare Notifications
const _notifHistory = []; // alle die je erschienen sind (für Clock-Popup)

function pushNotification(title, message, duration = 8000) {
  const id = Date.now() + Math.random(); // unique auch wenn schnell hintereinander
  const time = new Date();
  const entry = { id, title, message, time };

  _notifQueue.push(entry);
  _notifHistory.unshift(entry); // neueste oben

  _renderNotifStack();
  _renderNotifHistory();

  if (duration > 0) {
    setTimeout(() => _dismissNotif(id, 0), duration);
  }
}

function _dismissNotif(id, direction) {
  const card = document.getElementById('notif-' + id);
  if (!card) return;

  card.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
  card.style.transform = `translateX(${direction > 0 ? 320 : -320}px)`;
  card.style.opacity = '0';

  setTimeout(() => {
    card.remove();
    const idx = _notifQueue.findIndex(n => n.id === id);
    if (idx !== -1) _notifQueue.splice(idx, 1);
  }, 260);
}

function _renderNotifStack() {
  let container = document.getElementById('notif-container');
  if (!container) return;

  _notifQueue.forEach(notif => {
    if (document.getElementById('notif-' + notif.id)) return;

    const card = document.createElement('div');
    card.className = 'notif-card';
    card.id = 'notif-' + notif.id;

    const h = String(notif.time.getHours()).padStart(2, '0');
    const m = String(notif.time.getMinutes()).padStart(2, '0');

    card.innerHTML = `
      <div class="notif-card-title">${notif.title}</div>
      <div class="notif-card-msg">${notif.message}</div>
      <div class="notif-card-time">${h}:${m}</div>
    `;

    _setupSwipe(card, notif.id);
    container.appendChild(card);
  });
}

function _setupSwipe(card, id) {
  let startX = 0;

  // ── Maus ──
  function onMouseMove(e) {
    const dx = e.clientX - startX;
    card.style.transform = `translateX(${dx}px)`;
    card.style.opacity = String(Math.max(0, 1 - Math.abs(dx) / 180));
  }

  function onMouseUp(e) {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    card.style.transition = '';

    const dx = e.clientX - startX;
    if (Math.abs(dx) > 80) {
      _dismissNotif(id, dx);
    } else {
      card.style.transform = '';
      card.style.opacity = '';
    }
  }

  card.addEventListener('mousedown', e => {
    e.preventDefault();
    startX = e.clientX;
    card.style.transition = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  let touchStartX = 0;
  card.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    card.style.transition = 'none';
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - touchStartX;
    card.style.transform = `translateX(${dx}px)`;
    card.style.opacity = String(Math.max(0, 1 - Math.abs(dx) / 180));
  }, { passive: true });

  card.addEventListener('touchend', e => {
    card.style.transition = '';
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 80) {
      _dismissNotif(id, dx);
    } else {
      card.style.transform = '';
      card.style.opacity = '';
    }
  });
}

function _renderNotifHistory() {
  const popupLeft = document.querySelector('.popup-left');
  if (!popupLeft) return;

  // Bestehende History-Elemente löschen und neu aufbauen
  popupLeft.querySelectorAll(
    '.notif-history-header, .notif-history-list, .popup-no-notif'
  ).forEach(el => el.remove());

  const header = document.createElement('div');
  header.className = 'notif-history-header';
  header.textContent = 'Notifications';
  popupLeft.insertBefore(header, popupLeft.firstChild);

  const list = document.createElement('div');
  list.className = 'notif-history-list';

  if (_notifHistory.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'notif-history-empty';
    empty.textContent = 'nichts hier';
    list.appendChild(empty);
  } else {
    _notifHistory.forEach(notif => {
      const item = document.createElement('div');
      item.className = 'notif-history-item';
      const h = String(notif.time.getHours()).padStart(2, '0');
      const m = String(notif.time.getMinutes()).padStart(2, '0');
      item.innerHTML = `
        <div class="notif-history-title">${notif.title}</div>
        <div class="notif-history-msg">${notif.message}</div>
        <div class="notif-history-time">${h}:${m}</div>
      `;
      list.appendChild(item);
    });
  }

  popupLeft.insertBefore(list, popupLeft.children[1]);
}

// Erstmalig History rendern (zeigt "nichts hier" bis erste Notification)
document.addEventListener('DOMContentLoaded', _renderNotifHistory);