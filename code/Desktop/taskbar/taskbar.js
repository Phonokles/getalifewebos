document.addEventListener('DOMContentLoaded', () => {
  const indicator = document.getElementById('footer-indicator');
  const footerBar = document.querySelector('.footer');

  const speed = 5;
  const idleThreshold = 2;
  const inactivityDelay = 5000;
  const MAX_PETS_TOTAL = 6;

  let mouseX = window.innerWidth / 2;
  let lastMouseMoveTime = performance.now();
  let indicatorCurrentX = 0;

  const pets = [];
  let crashoutTriggered = false;

  function getCurrentGlowFootprint() {
    const indicatorWidth = indicator.offsetWidth;
    return {
      left: indicatorCurrentX,
      right: indicatorCurrentX + indicatorWidth,
      width: indicatorWidth
    };
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

  // ── Einzelnes Tier ────────────────────────────────────────────
  function createPet(species) {
    const wrapper = document.createElement('div');
    wrapper.className = 'fox-wrapper';
    wrapper.innerHTML = `
      <img src="../assets/${species}_idle_8fps.gif" class="fox-frame fox-idle" alt="${species} idle">
      <img src="../assets/${species}_lie_8fps.gif" class="fox-frame fox-lie" alt="${species} lie">
      <img src="../assets/${species}_walk_8fps.gif" class="fox-frame fox-walk" alt="${species} walk">
    `;
    footerBar.appendChild(wrapper);

    const state = {
      wrapper,
      species,
      foxCurrentX: 0,
      foxTargetX: 0,
      foxState: 'idle',
      facingRight: true,
      wanderPauseUntil: 0,
      wanderTargetX: null,
      isLying: false,
      running: true
    };

    const glowInit = getCurrentGlowFootprint();
    const foxWidth = wrapper.offsetWidth || 64;
    state.foxCurrentX = glowInit.left + Math.random() * Math.max(0, glowInit.width - foxWidth);
    state.offsetX = (Math.random() - 0.5) * 70; // persönlicher Versatz, damit Tiere nicht alle exakt übereinander landen

    function setWalkingState(walking) {
      if (walking) {
        wrapper.classList.remove('lying');
        wrapper.classList.add('walking');
      } else {
        wrapper.classList.remove('walking');
        if (!wrapper.classList.contains('lying')) {
          const isInactive = performance.now() - lastMouseMoveTime > inactivityDelay;
          if (isInactive && !state.isLying && Math.random() < 0.15) {
            state.isLying = true;
            wrapper.classList.add('lying');
            setTimeout(() => {
              wrapper.classList.remove('lying');
              state.isLying = false;
            }, 15000 + Math.random() * 5000);
          }
        }
      }
    }

    state.evaluateZone = function evaluateZone() {
      const foxWidth = wrapper.offsetWidth;
      const glow = getCurrentGlowFootprint();
      const leftEdgeBoundary = glow.left + glow.width / 3;
      const rightEdgeBoundary = glow.left + (glow.width * 2) / 3;
      const inOuterZone = mouseX < leftEdgeBoundary || mouseX > rightEdgeBoundary;
      if (inOuterZone) {
        const newTarget = Math.max(glow.left, Math.min(mouseX - foxWidth / 2 + state.offsetX, glow.right - foxWidth));
        if (Math.abs(newTarget - state.foxTargetX) > idleThreshold) {
          state.foxTargetX = newTarget;
          state.foxState = 'following';
        }
      } else {
        state.foxState = 'idle';
      }
    };

    function animateFox() {
      if (!state.running) return;

      const glow = getCurrentGlowFootprint();
      const foxWidth = wrapper.offsetWidth;
      let desiredTarget;
      const inactiveForAWhile = performance.now() - lastMouseMoveTime > inactivityDelay;

      if (state.foxState === 'following') {
        desiredTarget = state.foxTargetX;
      } else if (inactiveForAWhile) {
        if (state.wanderTargetX === null || (Math.abs(state.wanderTargetX - state.foxCurrentX) <= idleThreshold && performance.now() > state.wanderPauseUntil)) {
          state.wanderPauseUntil = performance.now() + 2500 + Math.random() * 2000;
          state.wanderTargetX = glow.left + Math.random() * (glow.width - foxWidth);
        }
        desiredTarget = state.wanderTargetX;
      } else {
        desiredTarget = state.foxCurrentX;
      }

      desiredTarget = Math.max(glow.left, Math.min(desiredTarget, glow.right - foxWidth));
      const diff = desiredTarget - state.foxCurrentX;
      const distance = Math.abs(diff);

      if (distance > idleThreshold) {
        const movingRight = diff > 0;
        if (movingRight !== state.facingRight) {
          state.facingRight = movingRight;
          wrapper.style.transform = `scaleX(${state.facingRight ? 1 : -1})`;
        }
        state.foxCurrentX += Math.sign(diff) * Math.min(speed, distance);
        setWalkingState(true);
      } else {
        state.foxCurrentX = desiredTarget;
        if (state.foxState === 'following') state.foxState = 'idle';
        setWalkingState(false);
      }

      wrapper.style.left = `${state.foxCurrentX}px`;
      requestAnimationFrame(animateFox);
    }

    animateFox();
    return state;
  }

  // ── Tier-Bestand pro Spezies verwalten ──────────────────────────
  function addPet(species) {
    pets.push(createPet(species));
  }

  function removePet(species) {
    const idx = pets.map(p => p.species).lastIndexOf(species);
    if (idx === -1) return;
    const removed = pets.splice(idx, 1)[0];
    removed.running = false;
    removed.wrapper.remove();
  }

  function loadPetCounts() {
    try {
      const stored = JSON.parse(localStorage.getItem('petCounts'));
      if (stored && typeof stored === 'object') return stored;
    } catch (e) {}
    return { red: 1, black: 0, akita: 0 };
  }

  function setPetsConfig(config) {
    Object.keys(config).forEach(species => {
      const desired = Math.max(0, Math.min(MAX_PETS_TOTAL, config[species] || 0));
      let current = pets.filter(p => p.species === species).length;
      while (current < desired) { addPet(species); current++; }
      while (current > desired) { removePet(species); current--; }
    });

    if (pets.length > 4) {
      triggerCrashout();
    }
  }

  // ── Crashout ───────────────────────────────────────────────
  function spawnSplat(x, y, scale) {
    const splat = document.createElement('div');
    splat.className = 'crash-splat';
    splat.style.left = x + 'px';
    splat.style.top = y + 'px';
    splat.style.setProperty('--splat-scale', scale);
    document.body.appendChild(splat);
  }

  function triggerCrashout() {
    if (crashoutTriggered) return;
    crashoutTriggered = true;

    // Verhindert, dass beim nächsten Start sofort wieder gecrasht wird
    localStorage.setItem('petCounts', JSON.stringify({ red: 1, black: 0, akita: 0 }));

    pets.forEach(p => {
      p.running = false;
      p.wrapper.classList.add('crashing');
    });

    setTimeout(() => {
      pets.forEach(p => {
        const rect = p.wrapper.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        spawnSplat(cx, cy, 1);
        spawnSplat(cx + (Math.random() * 60 - 30), cy + (Math.random() * 40 - 20), 0.5 + Math.random() * 0.4);
        spawnSplat(cx + (Math.random() * 60 - 30), cy + (Math.random() * 40 - 20), 0.4 + Math.random() * 0.3);

        p.wrapper.classList.add('exploding');
      });
    }, 550);

    setTimeout(() => {
      window.location.href = 'crashout/crashout.html';
    }, 5000);
  }

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    lastMouseMoveTime = performance.now();
    pets.forEach(p => {
      p.wanderTargetX = null;
      p.evaluateZone();
    });
  });

  window.addEventListener('message', (e) => {
    if (e.data?.type === 'setPets' && e.data.pets) {
      localStorage.setItem('petCounts', JSON.stringify(e.data.pets));
      setPetsConfig(e.data.pets);
    }
  });

  setPetsConfig(loadPetCounts());
  animateIndicator();
});