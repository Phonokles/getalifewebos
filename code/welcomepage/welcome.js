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
  let wanderPauseUntil = 0;
  let wanderTargetX = null;
  let lastMouseMoveTime = performance.now();
  const inactivityDelay = 5000;
  const speed = 5;
  const idleThreshold = 2;

  function setWalkingState(walking) {
    if (walking ) {
      foxwrapper.classList.remove('lying');
      foxwrapper.classList.add('walking');
    } else {
      foxwrapper.classList.remove('walking');
      if (!foxwrapper.classList.contains('lying')) {
        const isInactive = performance.now() - lastMouseMoveTime > inactivityDelay;
        if (isInactive && Math.random() < 0.1){
          foxwrapper.classList.remove('walking')
          foxwrapper.classList.add('lying');
          setTimeout(() => foxwrapper.classList.remove('lying'), 5000 + Math.random() * 5000);
        }
      }
    }
  }

  // Gibt zurück, wo der Glow gerade jetzt steht (nicht wo er theoretisch hinkönnte)
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
    lastMouseMoveTime = performance.now();
    wanderTargetX = null
    evaluateZone();
  });

  function animateFox() {
    // Fuchs immer innerhalb der AKTUELLEN Glow-Fläche festhalten
    const glow = getCurrentGlowFootprint();
    const foxWidth = foxwrapper.offsetWidth;
    
    let desiredTarget;
    const inactiveForAWhile = performance.now() -lastMouseMoveTime > inactivityDelay


    if (foxState === 'following') {
      desiredTarget = foxTargetX
    }else if(inactiveForAWhile) {
    if (wanderTargetX === null || (Math.abs(wanderTargetX - foxCurrentX) <= idleThreshold && performance.now() > wanderPauseUntil)) {
      wanderPauseUntil = performance.now() + 2500 + Math.random() * 2000
      wanderTargetX= glow.left +Math.random() * (glow.width - foxWidth)
    }
    desiredTarget = wanderTargetX;

     }else {
      desiredTarget= foxCurrentX;
    }
    desiredTarget = Math.max(glow.left, Math.min(desiredTarget, glow.right - foxWidth));
    
    const diff = desiredTarget - foxCurrentX;
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
        foxCurrentX = desiredTarget;
        if (foxState === 'following') foxState = 'idle';
        setWalkingState(false);
      }
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