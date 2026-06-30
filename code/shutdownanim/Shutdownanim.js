const steps = [
  { id: 'check-0', delay: 300,  duration: 380 },
  { id: 'check-1', delay: 780,  duration: 360 },
  { id: 'check-2', delay: 1230, duration: 340 },
  { id: 'check-3', delay: 1660, duration: 300 },
  { id: 'check-4', delay: 2050, duration: 270 },
];

steps.forEach((step, index) => {

  // Schritt aktivieren
  setTimeout(() => {
    const el = document.getElementById(step.id);
    el.classList.add('active');
    el.querySelector('.check-box').textContent = '(/)';
  }, step.delay);

  // Schritt abhaken
  setTimeout(() => {
    const el = document.getElementById(step.id);
    el.classList.remove('active');
    el.classList.add('done');
    el.querySelector('.check-box').textContent = '{*}';

 if (index === steps.length - 1) {
  const isReboot = new URLSearchParams(window.location.search).has('reboot');
  setTimeout(() => {
    document.getElementById('blackout').classList.add('active');
    setTimeout(() => {
      if (isReboot) {
        window.location.href = '../bootanim/bootanim.html';
      } else {
        document.getElementById('boot-btn-wrapper').classList.add('visible');
      }
    }, 800);
  }, 400);
}
  }, step.delay + step.duration);
});