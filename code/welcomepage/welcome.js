document.addEventListener('DOMContentLoaded', () => {
  const indicator = document.getElementById('footer-indicator');
  const footerBar = document.querySelector('.footer');
  
  let mouseX = window.innerWidth / 2;
  let currentX = 0;
  const speed = 5;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
  });

  function animateIndicator() {
    const barWidth = footerBar.offsetWidth;
    const lineWidth = indicator.offsetWidth;
    const maxX = barWidth - lineWidth;

    const fraction = mouseX / window.innerWidth;
    const targetX = fraction * maxX;

    const diff = targetX - currentX;
    if (Math.abs(diff) > speed) {
      currentX += Math.sign(diff) * speed;
    } else {
      currentX = targetX;
    }

    indicator.style.transform = `translateX(${currentX}px)`;
    requestAnimationFrame(animateIndicator);
  }

  animateIndicator();
});

