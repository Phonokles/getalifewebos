function lockScreen() {
  document.getElementById('lock-screen').classList.add('active');
}

function unlockScreen() {
  document.getElementById('lock-screen').classList.remove('active');
}

document.getElementById('unlock-btn').addEventListener('click', unlockScreen);