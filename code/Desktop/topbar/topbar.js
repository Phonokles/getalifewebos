const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function update() {
  const now = new Date();
  const day = now.getDate();
  const month = MONTHS[now.getMonth()];
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');

  document.getElementById('topbar-date').textContent = `${day}.${month}`;
  document.getElementById('topbar-time').textContent = `${h}:${m}:${s}`;
}

update();
setInterval(update, 1000);