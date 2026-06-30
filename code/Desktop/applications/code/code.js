document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';

window.addEventListener('message', (e) => {
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
  }
});

const LANG_EXT = {
  python: 'py',
  cpp: 'cpp',
  txt: 'txt',
  html: 'html',
  css: 'css',
  js: 'js',
  rust: 'rs'
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

document.getElementById('btn-download').addEventListener('click', () => {
  const filename = filenameInput.value.trim() || `untitled.${LANG_EXT[currentLang] || 'txt'}`;
  const blob = new Blob([textarea.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// ── Tab fügt Einrückung ein statt den Fokus zu wechseln ─────────
textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.slice(0, start) + '  ' + textarea.value.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + 2;
  }
});