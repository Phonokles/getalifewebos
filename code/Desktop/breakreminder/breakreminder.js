const BREAK_INTERVAL = 5 * 60 * 1000; // alle 5 Minuten
const BREAK_DURATION = 15;            // Sekunden

function showBreakReminder() {
  const overlay = document.getElementById('break-overlay');
  const countdownEl = document.getElementById('break-countdown');
  if (!overlay || !countdownEl) return;

  let secondsLeft = BREAK_DURATION;
  countdownEl.textContent = secondsLeft;
  overlay.classList.add('active');

  const tick = setInterval(() => {
    secondsLeft--;
    countdownEl.textContent = secondsLeft;

    if (secondsLeft <= 0) {
      clearInterval(tick);
      overlay.classList.remove('active');
    }
  }, 1000);
}

setInterval(showBreakReminder, BREAK_INTERVAL);