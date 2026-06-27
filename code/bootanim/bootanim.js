const steps = [
  { id: 'check-0', delay: 600,  duration: 900  },
  { id: 'check-1', delay: 1700, duration: 1100 },
  { id: 'check-2', delay: 3000, duration: 800  },
  { id: 'check-3', delay: 4000, duration: 1000 },
  { id: 'check-4', delay: 5200, duration: 700  },
];

// Nächste Seite nach dem letzten Schritt (anpassen sobald du weißt, wo's hingeht)
const NEXT_PAGE = '../Desktop/Desktop.html';

steps.forEach((step, index) => {
  // Schritt aktivieren (leuchtet auf)
  setTimeout(() => {
    const el = document.getElementById(step.id);
    el.classList.add('active');
    el.querySelector('.check-box').textContent = '(/)';
  }, step.delay);

  // Schritt abhaken (fertig)
  setTimeout(() => {
    const el = document.getElementById(step.id);
    el.classList.remove('active');
    el.classList.add('done');
    el.querySelector('.check-box').textContent = '{*}';

    // Nach dem letzten Schritt weiterleiten
    if (index === steps.length - 1) {
      setTimeout(() => {
        window.location.href = NEXT_PAGE;
      }, 800);
    }
  }, step.delay + step.duration);
});