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

  function barSide() {
    return document.body.dataset.bar || 'bottom';
  }

  function reparentPets() {
    const host = barSide() === 'bottom' ? footerBar : document.body;
    pets.forEach(p => {
      if (p.wrapper && p.wrapper.parentElement !== host) host.appendChild(p.wrapper);
    });
  }

  // the bar can move at any time, so the pets have to follow
  new MutationObserver(() => {
    if (!document.body) return;
    reparentPets();
  }).observe(document.body, { attributes: true, attributeFilter: ['data-bar'] });

  function getCurrentGlowFootprint() {
    // with the bar on a side or on top there is no glow line to walk along,
    // so the pets use the full screen floor instead
    const side = barSide();

    if (side !== 'bottom') {
      // the bar takes a strip away on the side it sits on
      const left = side === 'left' ? 56 : 0;
      const right = window.innerWidth - (side === 'right' ? 56 : 0);
      return { left, right, width: Math.max(64, right - left) };
    }

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

  function spawnHearts(wrapper) {
    const count = 5 + Math.floor(Math.random() * 3);

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const rect = wrapper.getBoundingClientRect();
        if (!rect.width) return;

        const heart = document.createElement('div');
        heart.className = 'pet-heart';
        heart.textContent = '\u2665';

        // alternating sides, so they rise left and right of the animal
        const side = i % 2 === 0 ? -1 : 1;
        const spread = 6 + Math.random() * 14;
        heart.style.left = (rect.left + rect.width / 2 + side * spread) + 'px';
        heart.style.top = (rect.top + rect.height * 0.35) + 'px';
        heart.style.setProperty('--drift', (side * (10 + Math.random() * 18)) + 'px');
        heart.style.fontSize = (10 + Math.random() * 7) + 'px';
        heart.style.animationDuration = (1100 + Math.random() * 700) + 'ms';

        document.body.appendChild(heart);
        setTimeout(() => heart.remove(), 2000);
      }, i * 120);
    }
  }

  function createPet(species) {
    const wrapper = document.createElement('div');
    wrapper.className = 'fox-wrapper';
    wrapper.innerHTML = `
      <img src="../assets/${species}_idle_8fps.gif" class="fox-frame fox-idle" alt="${species} idle">
      <img src="../assets/${species}_lie_8fps.gif" class="fox-frame fox-lie" alt="${species} lie">
      <img src="../assets/${species}_walk_8fps.gif" class="fox-frame fox-walk" alt="${species} walk">
    `;
    // inside the bar they would be trapped in its box, which breaks as soon as
    // the bar is narrow or on top, so anywhere but bottom they live on the body
    (barSide() === 'bottom' ? footerBar : document.body).appendChild(wrapper);

    const state = {
      wrapper,
      species,
      foxCurrentX: 0,
      foxTargetX: 0,
      facingRight: true,
      isLying: false,
      running: true,

      // every pet gets its own character, otherwise they all do the same thing
      pace: 0.6 + Math.random() * 0.9,
      curiosity: 0.25 + Math.random() * 0.6,
      laziness: Math.random(),
      mood: 'wander',
      moodUntil: 0,
      wanderTargetX: null,
      petUntil: 0,
    };

    const glowInit = getCurrentGlowFootprint();
    const foxWidth = wrapper.offsetWidth || 64;
    state.foxCurrentX = glowInit.left + Math.random() * Math.max(0, glowInit.width - foxWidth);

    function lieDown(ms) {
      state.isLying = true;
      wrapper.classList.remove('walking');
      wrapper.classList.add('lying');
      clearTimeout(state._lieTimer);
      state._lieTimer = setTimeout(() => {
        wrapper.classList.remove('lying');
        state.isLying = false;
      }, ms);
    }

    function setWalkingState(walking) {
      if (state.isLying) return;
      wrapper.classList.toggle('walking', walking);
    }

    const MIN_GAP = 1.05;
    const WALK_START = 7;
    const WALK_STOP = 2;
    const SWITCH_DELAY = 220;

    function crowded(x, width) {
      return pets.some(other =>
        other !== state && other.wrapper &&
        Math.abs(x - other.foxCurrentX) < width * MIN_GAP);
    }

    // keeps pets from standing inside each other
    function separation(x, width) {
      let push = 0;
      pets.forEach(other => {
        if (other === state || !other.wrapper) return;
        const gap = x - other.foxCurrentX;
        const min = width * MIN_GAP;
        if (Math.abs(gap) < min) {
          const dir = gap === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(gap);
          push += dir * (min - Math.abs(gap)) * 0.9;
        }
      });
      return push;
    }

    function pickMood(now, glow, width) {
      const mouseFresh = now - lastMouseMoveTime < inactivityDelay;
      const roll = Math.random();

      if (mouseFresh && roll < state.curiosity) {
        state.mood = 'follow';
        state.moodUntil = now + 1500 + Math.random() * 2500;
        return;
      }

      if (roll < 0.25 + state.laziness * 0.35) {
        state.mood = 'rest';
        state.moodUntil = now + 2000 + Math.random() * 5000;
        if (Math.random() < 0.45 && !crowded(state.foxCurrentX, width)) lieDown(4000 + Math.random() * 7000);
        return;
      }

      state.mood = 'wander';
      state.moodUntil = now + 2500 + Math.random() * 4000;
      state.wanderTargetX = glow.left + Math.random() * Math.max(1, glow.width - width);
    }

    state.evaluateZone = function () {};

    function animateFox() {
      if (!state.running) return;

      const now = performance.now();
      // scale by real time, so a slow frame rate does not slow the animals down
      const dt = Math.min(4, Math.max(0.5, (now - (state.lastFrame || now - 16)) / 16.7));
      state.lastFrame = now;

      const glow = getCurrentGlowFootprint();
      const width = wrapper.offsetWidth || 64;

      if (now < state.petUntil) {
        wrapper.style.left = `${state.foxCurrentX}px`;
        requestAnimationFrame(animateFox);
        return;
      }

      if (now > state.moodUntil) pickMood(now, glow, width);

      let desiredTarget = state.foxCurrentX;

      if (state.mood === 'follow') {
        // followers line up side by side instead of fighting over one spot
        const followers = pets.filter(p => p.mood === 'follow');
        const slot = Math.max(0, followers.indexOf(state));
        const offset = (slot - (followers.length - 1) / 2) * width * MIN_GAP;
        desiredTarget = mouseX - width / 2 + offset;
      } else if (state.mood === 'wander' && state.wanderTargetX !== null) {
        desiredTarget = state.wanderTargetX;
      }

      const resting = state.mood === 'rest' || state.isLying;

      if (resting) {
        // a resting animal must not slide around, so if someone crowds it,
        // it gets up and walks off properly instead
        if (crowded(state.foxCurrentX, width) && now > (state.shooUntil || 0)) {
          state.shooUntil = now + 1200;
          if (state.isLying) {
            clearTimeout(state._lieTimer);
            wrapper.classList.remove('lying');
            state.isLying = false;
          }
          state.mood = 'wander';
          state.moodUntil = now + 2500 + Math.random() * 2500;
          state.wanderTargetX = Math.max(glow.left, Math.min(
            state.foxCurrentX + (Math.random() < 0.5 ? -1 : 1) * width * 2,
            glow.right - width));
        }
      } else {
        desiredTarget += separation(state.foxCurrentX, width);
      }

      desiredTarget = Math.max(glow.left, Math.min(desiredTarget, glow.right - width));

      const diff = desiredTarget - state.foxCurrentX;
      const distance = Math.abs(diff);

      // two thresholds plus a dwell time, otherwise the walk animation
      // flickers on and off while the target wobbles by a pixel
      if (!state.moving && distance > WALK_START) {
        if (now - (state.lastSwitch || 0) > SWITCH_DELAY) {
          state.moving = true;
          state.lastSwitch = now;
        }
      } else if (state.moving && distance < WALK_STOP) {
        if (now - (state.lastSwitch || 0) > SWITCH_DELAY) {
          state.moving = false;
          state.lastSwitch = now;
        }
      }

      if (state.moving && !state.isLying) {
        const movingRight = diff > 0;
        if (movingRight !== state.facingRight && distance > WALK_START) {
          state.facingRight = movingRight;
          wrapper.style.transform = `scaleX(${state.facingRight ? 1 : -1})`;
        }
        state.foxCurrentX += Math.sign(diff) * Math.min(speed * state.pace * dt, distance);
        setWalkingState(true);
      } else {
        setWalkingState(false);
      }

      wrapper.style.left = `${state.foxCurrentX}px`;
      requestAnimationFrame(animateFox);
    }

    wrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      state.petUntil = performance.now() + 3200;
      state.mood = 'rest';
      state.moodUntil = state.petUntil + 1200;
      lieDown(3600);
      spawnHearts(wrapper);
    });

    animateFox();
    return state;
  }


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