
(function () {

  const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const MONTHS   = ['january', 'february', 'march', 'april', 'may', 'june',
                    'july', 'august', 'september', 'october', 'november', 'december'];

  const timeEl    = document.getElementById('clock-widget-time');
  const secondsEl = document.getElementById('clock-widget-seconds');
  const dateEl    = document.getElementById('clock-widget-date');

  function updateClockWidget() {
    const now = new Date();

    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');

    timeEl.textContent = `${h}:${m}`;    const s = String(now.getSeconds()).padStart(2, '0');

    secondsEl.textContent = s;
    dateEl.textContent =
      `${WEEKDAYS[now.getDay()]}, ${now.getDate()}. ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  }

  updateClockWidget();
  setInterval(updateClockWidget, 1000);

})();