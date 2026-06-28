const MONTHS_DE = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember'
];
const DAYS_MINI = ['M','D','M','D','F','S','S'];

const now = new Date();
let viewYear = now.getFullYear();
let viewMonth = now.getMonth();

function buildMiniCal() {
  const cal = document.getElementById('mini-cal');
  document.getElementById('mini-month-label').textContent = MONTHS_DE[viewMonth].substring(0, 3);
  cal.innerHTML = '';

  DAYS_MINI.forEach(d => {
    const h = document.createElement('div');
    h.className = 'mini-cal-header';
    h.textContent = d;
    cal.appendChild(h);
  });

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevDays = new Date(viewYear, viewMonth, 0).getDate();

  for (let i = 0; i < offset; i++) {
    const d = document.createElement('div');
    d.className = 'mini-cal-day other';
    d.textContent = prevDays - offset + 1 + i;
    cal.appendChild(d);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const d = document.createElement('div');
    const isToday = i === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
    d.className = 'mini-cal-day' + (isToday ? ' today' : '');
    d.textContent = i;
    cal.appendChild(d);
  }
}

function buildMainCal() {
  const grid = document.getElementById('month-grid');
  document.getElementById('main-month-label').textContent = MONTHS_DE[viewMonth];
  document.getElementById('main-year-label').textContent = viewYear;
  grid.innerHTML = '';

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevDays = new Date(viewYear, viewMonth, 0).getDate();

  for (let i = 0; i < offset; i++) {
    const cell = document.createElement('div');
    cell.className = 'month-cell other-month';
    cell.innerHTML = `<div class="cell-day">${prevDays - offset + 1 + i}</div>`;
    grid.appendChild(cell);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const cell = document.createElement('div');
    const isToday = i === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
    cell.className = 'month-cell' + (isToday ? ' today' : '');
    cell.innerHTML = `<div class="cell-day">${i}</div>`;
    grid.appendChild(cell);
  }
}

function render() {
  buildMiniCal();
  buildMainCal();
}

// Navigation
document.getElementById('prev-mini').onclick = () => {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  render();
};
document.getElementById('next-mini').onclick = () => {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  render();
};
document.getElementById('prev-main').onclick = () => {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  render();
};
document.getElementById('next-main').onclick = () => {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  render();
};

// Drag
const win = document.getElementById('app-window');
const bar = document.getElementById('titlebar');
let dragging = false, ox = 0, oy = 0;

bar.addEventListener('mousedown', e => {
  dragging = true;
  ox = e.clientX - win.offsetLeft;
  oy = e.clientY - win.offsetTop;
});
document.addEventListener('mousemove', e => {
  if (!dragging) return;
  win.style.left = (e.clientX - ox) + 'px';
  win.style.top = (e.clientY - oy) + 'px';
});
document.addEventListener('mouseup', () => dragging = false);

// Close
document.getElementById('tb-close').onclick = () => {
  win.style.display = 'none';
};

render();