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


const popup = document.getElementById('clock-popup');
document.querySelector('.topbar-center').addEventListener('click', (e) => {
  e.stopPropagation();
  popup.classList.toggle('open');
  if (popup.classList.contains('open')) buildCalendar();
});

document.addEventListener('click', () => {
    popup.classList.remove('open');
    powerPopup.classList.remove('open');
});
popup.addEventListener('click', (e) => e.stopPropagation());

document.getElementById('dnd-toggle').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('dnd-toggle').classList.toggle('active');
});

function buildCalendar() {
  const cal = document.getElementById('popup-calendar');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const DAYS = ['M','T','W','Th','F','S','S'];
  const MONTHS_DE = ['January','February','March','April','May','June','July','August','September','Oktober','November','Dezember'];
  const DAYS_DE = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  document.getElementById('popup-date-big').textContent =
    `${DAYS_DE[now.getDay()]}\n${now.getDate()}. ${MONTHS_DE[month]} ${year}`;

  cal.innerHTML = '';

  DAYS.forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-header';
    h.textContent = d;
    cal.appendChild(h);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  for (let i = 0; i < offset; i++) {
    const d = document.createElement('div');
    d.className = 'cal-day other-month';
    d.textContent = prevDays - offset + 1 + i;
    cal.appendChild(d);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const d = document.createElement('div');
    d.className = 'cal-day' + (i === now.getDate() ? ' today' : '');
    d.textContent = i;
    cal.appendChild(d);
  }
}
const powerBtn = document.getElementById('power-btn');
const powerPopup = document.getElementById('power-popup');

powerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  powerPopup.classList.toggle('open');
  popup.classList.remove('open');
});

powerPopup.addEventListener('click', (e) => e.stopPropagation());

document.getElementById('opt-shutdown').addEventListener('click', () => {
  window.location.href = '../shutdownanim/shutdownanim.html';
});

document.getElementById('opt-lock').addEventListener('click', () => {
  lockScreen();
  powerPopup.classList.remove('open');
});

document.getElementById('opt-reboot').addEventListener('click', () => {
    window.location.href = '../shutdownanim/shutdownanim.html?reboot=1';
});