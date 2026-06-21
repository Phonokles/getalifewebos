document.addEventListener('DOMContentLoaded', () => {
  const foxwrapper = document.getElementById('fox-wrapper');
  const indicator = document.getElementById('footer-indicator');
  const footerBar = document.querySelector('.footer');

  let mouseX = window.innerWidth / 2;
  let foxCurrentX = 0;
  let foxTargetX = 0;
  let foxState = 'idle';
  let indicatorCurrentX = 0;
  let facingRight = true;

  const speed = 5;
  const idleThreshold = 2;

  function setWalkingState(walking) {
    foxwrapper.classList.toggle('walking', walking);
  }

  // Gibt zurück, wo der Glow GERADE JETZT steht (nicht wo er theoretisch hinkönnte)
  function getCurrentGlowFootprint() {
    const indicatorWidth = indicator.offsetWidth;
    return {
      left: indicatorCurrentX,
      right: indicatorCurrentX + indicatorWidth,
      width: indicatorWidth
    };
  }

  function evaluateZone() {
    const foxWidth = foxwrapper.offsetWidth;
    const glow = getCurrentGlowFootprint();

    const leftEdgeBoundary = glow.left + glow.width / 3;
    const rightEdgeBoundary = glow.left + (glow.width * 2) / 3;

    const inOuterZone = mouseX < leftEdgeBoundary || mouseX > rightEdgeBoundary;

    if (inOuterZone) {
      const newTarget = Math.max(glow.left, Math.min(mouseX - foxWidth / 2, glow.right - foxWidth));
      if (Math.abs(newTarget - foxTargetX) > idleThreshold) {
        foxTargetX = newTarget;
        foxState = 'following';
      }
    } else {
      foxState = 'idle';
    }
  }

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    evaluateZone();
  });

  function animateFox() {
    // Fuchs immer innerhalb der AKTUELLEN Glow-Fläche festhalten
    const glow = getCurrentGlowFootprint();
    const foxWidth = foxwrapper.offsetWidth;
    const clampedTarget = Math.max(glow.left, Math.min(foxTargetX, glow.right - foxWidth));

    if (foxState === 'following') {
      const diff = clampedTarget - foxCurrentX;
      const distance = Math.abs(diff);

      if (distance > idleThreshold) {
        const movingRight = diff > 0;
        if (movingRight !== facingRight) {
          facingRight = movingRight;
          foxwrapper.style.transform = `scaleX(${facingRight ? 1 : -1})`;
        }
        foxCurrentX += Math.sign(diff) * Math.min(speed, distance);
        setWalkingState(true);
      } else {
        foxState = 'idle';
        setWalkingState(false);
      }
    } else {
      setWalkingState(false);
    }

    // Fuchs sanft mitziehen, falls die Glow-Fläche unter ihm wegwandert
    foxCurrentX = Math.max(glow.left, Math.min(foxCurrentX, glow.right - foxWidth));

    foxwrapper.style.left = `${foxCurrentX}px`;
    requestAnimationFrame(animateFox);
  }

  function animateIndicator() {
    const barWidth = footerBar.offsetWidth;
    const lineWidth = indicator.offsetWidth;
    const maxX = barWidth - lineWidth;

    const fraction = mouseX / window.innerWidth;
    const targetX = fraction * maxX;

    const diff = targetX - indicatorCurrentX;
    if (Math.abs(diff) > speed) {
      indicatorCurrentX += Math.sign(diff) * speed;
    } else {
      indicatorCurrentX = targetX;
    }

    indicator.style.transform = `translateX(${indicatorCurrentX}px)`;
    requestAnimationFrame(animateIndicator);
  }

  animateIndicator();
  animateFox();
});