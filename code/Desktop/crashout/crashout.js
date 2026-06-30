document.addEventListener('DOMContentLoaded', () => {
  for (let i = 0; i < 6; i++) {
    const splat = document.createElement('div');
    splat.className = 'bg-splat';
    splat.style.left = Math.random() * 100 + 'vw';
    splat.style.top = Math.random() * 100 + 'vh';
    splat.style.setProperty('--s', (0.4 + Math.random() * 0.8).toFixed(2));
    splat.style.animationDelay = (Math.random() * 0.6).toFixed(2) + 's';
    document.body.appendChild(splat);
  }

  const messages = [
    {
      title: 'WHY WOULD YOU DO THIS',
      sub: 'they trusted you. they just wanted to wander around the taskbar.'
    },
    {
      title: 'YOU MONSTER',
      sub: 'five foxes. FIVE. the system simply could not forgive you.'
    }
  ];

  const glitchEl = document.querySelector('.crash-glitch');
  const subEl = document.querySelector('.crash-sub');

  function showMessage(i) {
    glitchEl.textContent = messages[i].title;
    glitchEl.setAttribute('data-text', messages[i].title);
    subEl.textContent = messages[i].sub;
  }

  showMessage(0);
  setTimeout(() => showMessage(1), 2200);
  setTimeout(() => {
    document.getElementById('dead-overlay').classList.add('visible');
  }, 4400);
});