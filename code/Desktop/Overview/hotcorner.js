// top left corner toggles the overview. armed again only after the pointer
// leaves the corner, otherwise sitting there would flip it on every move
(function () {
  const SIZE = 8;
  let armed = true;

  function inCorner(e) {
    return e.clientX <= SIZE && e.clientY <= SIZE;
  }

  window.addEventListener('mousemove', (e) => {
    if (!inCorner(e)) {
      armed = true;
      return;
    }

    if (!armed) return;
    if (document.body.classList.contains('keys-open')) return;
    if (document.body.classList.contains('launcher-open')) return;
    if (document.getElementById('lock-screen')?.classList.contains('active')) return;

    armed = false;
    toggleOverview();
  });

  window.addEventListener('blur', () => { armed = true; });
})();