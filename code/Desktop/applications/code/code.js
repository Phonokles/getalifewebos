document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';

window.addEventListener('message', (e) => {
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
  }
});

const LANG_EXT = {
  c: 'c',
  cpp: 'cpp',
  rust: 'rs',
  go: 'go',
  zig: 'zig',
  java: 'java',
  csharp: 'cs',
  kotlin: 'kt',
  swift: 'swift',
  python: 'py',
  js: 'js',
  ts: 'ts',
  ruby: 'rb',
  php: 'php',
  lua: 'lua',
  bash: 'sh',
  html: 'html',
  css: 'css',
  txt: 'txt',
};

const langPicker = document.getElementById('lang-picker');
const editorView = document.getElementById('editor-view');
const filenameInput = document.getElementById('editor-filename');
const textarea = document.getElementById('editor-textarea');

let currentLang = null;

function selectLang(lang) {
  const prevName = filenameInput.value || `untitled.${LANG_EXT[currentLang] || 'txt'}`;
  const base = prevName.includes('.') ? prevName.slice(0, prevName.lastIndexOf('.')) : (prevName || 'untitled');

  currentLang = lang;
  filenameInput.value = `${base || 'untitled'}.${LANG_EXT[lang]}`;
  if (typeof paintRun === 'function') paintRun();

  langPicker.classList.add('hidden');
  editorView.classList.add('active');
  textarea.focus();
}

document.querySelectorAll('.lang-card').forEach(card => {
  card.addEventListener('click', () => selectLang(card.dataset.lang));
});

document.getElementById('btn-change-type').addEventListener('click', () => {
  editorView.classList.remove('active');
  langPicker.classList.remove('hidden');
});


const FS = (window.parent && window.parent.WebOSFS) ? window.parent.WebOSFS : null;

let currentFolder = '';

function currentFilename() {
  return filenameInput.value.trim() || `untitled.${LANG_EXT[currentLang] || 'txt'}`;
}

document.getElementById('btn-add-local').addEventListener('click', () => {
  const blob = new Blob([textarea.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = currentFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

const addDataBtn = document.getElementById('btn-add-data');

addDataBtn.addEventListener('click', () => {
  if (!FS) {
    flashBtn(addDataBtn, 'no FS');
    return;
  }
  const err = FS.writeFile(currentFolder, currentFilename(), textarea.value);
  flashBtn(addDataBtn, err ? err : 'Saved');
});

const runBtn = document.getElementById('btn-run');

function canRun() {
  const name = currentFilename();
  if (!FS) return false;
  return FS.isPage(name) || (FS.isRunnable && FS.isRunnable(name));
}

// a page opens in the browser, code goes to the terminal, anything else hides
function paintRun() {
  runBtn.style.display = canRun() ? '' : 'none';
}

runBtn.addEventListener('click', () => {
  if (!FS) return;

  // save first, otherwise you would run the version from before your last edit
  const err = FS.writeFile(currentFolder, currentFilename(), textarea.value);
  if (err) {
    runBtn.textContent = err;
    clearTimeout(runBtn._t);
    runBtn._t = setTimeout(() => { runBtn.innerHTML = 'Run &#9654;'; }, 1600);
    return;
  }

  const path = currentFolder ? currentFolder + '/' + currentFilename() : currentFilename();

  if (FS.isPage(currentFilename())) FS.requestOpenInBrowser(path);
  else FS.requestRun(path);
});

filenameInput.addEventListener('input', paintRun);
paintRun();

function flashBtn(btn, text) {
  const original = 'Add in Data';
  btn.textContent = text;
  clearTimeout(btn._flashTimer);
  btn._flashTimer = setTimeout(() => { btn.textContent = original; }, 1400);
}


const EXT_LANG = {};
Object.entries(LANG_EXT).forEach(([lang, ext]) => { EXT_LANG[ext] = lang; });

function openFromFS(path) {
  if (!FS) return;
  const content = FS.readFile(path);
  if (content === null) return;

  const parts = path.split('/');
  const name = parts.pop();
  currentFolder = parts.join('/');

  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : 'txt';
  currentLang = EXT_LANG[ext] || 'txt';

  filenameInput.value = name;
  if (typeof paintRun === 'function') paintRun();
  textarea.value = content;

  langPicker.classList.add('hidden');
  editorView.classList.add('active');
  textarea.focus();
}


window.addEventListener('message', (e) => {
  if (e.data?.type === 'openFile') {
    if (FS) FS.consumePendingOpen(); 
    openFromFS(e.data.path);
  }
});

if (FS) {
  const pending = FS.consumePendingOpen();
  if (pending) openFromFS(pending);
}



textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.slice(0, start) + '  ' + textarea.value.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + 2;
  }
});