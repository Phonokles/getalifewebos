document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';

window.addEventListener('message', (e) => {
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
  }
});

const FS = (window.parent && window.parent.WebOSFS) ? window.parent.WebOSFS : null;

const TYPES = [
  { id: 'c', name: 'C', ext: 'c', keys: 'clang gcc' },
  { id: 'cpp', name: 'C++', ext: 'cpp', keys: 'cplusplus gcc' },
  { id: 'rust', name: 'Rust', ext: 'rs', keys: 'cargo' },
  { id: 'go', name: 'Go', ext: 'go', keys: 'golang' },
  { id: 'zig', name: 'Zig', ext: 'zig', keys: '' },
  { id: 'java', name: 'Java', ext: 'java', keys: 'jvm' },
  { id: 'csharp', name: 'C#', ext: 'cs', keys: 'dotnet csharp' },
  { id: 'kotlin', name: 'Kotlin', ext: 'kt', keys: 'jvm android' },
  { id: 'swift', name: 'Swift', ext: 'swift', keys: 'apple ios' },
  { id: 'python', name: 'Python', ext: 'py', keys: 'py snake' },
  { id: 'js', name: 'JavaScript', ext: 'js', keys: 'node ecmascript' },
  { id: 'ts', name: 'TypeScript', ext: 'ts', keys: 'typed js' },
  { id: 'ruby', name: 'Ruby', ext: 'rb', keys: 'rails' },
  { id: 'php', name: 'PHP', ext: 'php', keys: 'web server' },
  { id: 'lua', name: 'Lua', ext: 'lua', keys: 'script' },
  { id: 'bash', name: 'Bash', ext: 'sh', keys: 'shell script sh' },
  { id: 'html', name: 'HTML', ext: 'html', keys: 'web page markup' },
  { id: 'css', name: 'CSS', ext: 'css', keys: 'style web' },
  { id: 'json', name: 'JSON', ext: 'json', keys: 'data config' },
  { id: 'md', name: 'Markdown', ext: 'md', keys: 'readme text' },
  { id: 'txt', name: 'Text', ext: 'txt', keys: 'plain notes' },
];

const BY_EXT = {};
TYPES.forEach(t => { BY_EXT[t.ext] = t; });

const STARTERS = {
  c: '#include <stdio.h>\n\nint main(void) {\n    printf("hello\\n");\n    return 0;\n}\n',
  cpp: '#include <iostream>\n\nint main() {\n    std::cout << "hello\\n";\n}\n',
  rs: 'fn main() {\n    println!("hello");\n}\n',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("hello")\n}\n',
  py: 'print("hello")\n',
  js: 'console.log("hello");\n',
  ts: 'const greeting: string = "hello";\nconsole.log(greeting);\n',
  lua: 'print("hello")\n',
  sh: '#!/bin/bash\necho "hello"\n',
  html: '<!doctype html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>page</title>\n</head>\n<body>\n  <h1>hello</h1>\n</body>\n</html>\n',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("hello");\n    }\n}\n',
};

const startView = document.getElementById('start-view');
const newView = document.getElementById('new-view');
const editorView = document.getElementById('editor-view');
const filenameInput = document.getElementById('editor-filename');
const textarea = document.getElementById('editor-textarea');
const sideEl = document.getElementById('editor-side');
const treeEl = document.getElementById('side-tree');

let currentFolder = '';
let currentType = null;
let makingProject = true;

function show(view) {
  [startView, newView, editorView].forEach(v => v.classList.toggle('active', v === view));
}

function currentFilename() {
  const raw = filenameInput.value.trim();
  return raw || ('untitled.' + (currentType ? currentType.ext : 'txt'));
}

function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

// ---------- start screen ----------

function renderRecent() {
  const box = document.getElementById('start-recent');
  if (!FS) return;

  const folders = FS.list('').filter(i => i.type === 'folder' && !i.name.startsWith('.'));
  if (!folders.length) {
    box.innerHTML = '';
    return;
  }

  box.innerHTML = '<div class="start-recent-title">open a folder</div>';
  const row = document.createElement('div');
  row.className = 'start-recent-row';

  folders.slice(0, 8).forEach(f => {
    const b = document.createElement('button');
    b.className = 'start-recent-item';
    b.textContent = f.name;
    b.addEventListener('click', () => openFolder(f.name));
    row.appendChild(b);
  });

  box.appendChild(row);
}

document.getElementById('start-new').addEventListener('click', () => {
  makingProject = true;
  document.getElementById('new-title').textContent = 'New project';
  document.getElementById('new-name').value = '';
  document.getElementById('new-name').placeholder = 'my-project';
  show(newView);
  setTimeout(() => document.getElementById('new-name').focus(), 40);
});

document.getElementById('start-file').addEventListener('click', () => {
  makingProject = false;
  document.getElementById('new-title').textContent = 'New file';
  document.getElementById('new-name').value = '';
  document.getElementById('new-name').placeholder = 'untitled';
  show(newView);
  setTimeout(() => document.getElementById('new-name').focus(), 40);
});

document.getElementById('new-back').addEventListener('click', () => show(startView));

// ---------- searchable type picker ----------

const typeSelect = document.getElementById('type-select');
const typeDrop = document.getElementById('type-drop');
const typeSearch = document.getElementById('type-search');
const typeList = document.getElementById('type-list');
let typeSel = 0;

function matchingTypes() {
  const q = typeSearch.value.trim().toLowerCase();
  if (!q) return TYPES;
  return TYPES.filter(t =>
    t.name.toLowerCase().includes(q) || t.ext.includes(q) || t.keys.includes(q));
}

function renderTypes() {
  const list = matchingTypes();
  typeSel = Math.min(typeSel, Math.max(0, list.length - 1));

  typeList.innerHTML = list
    .map((t, i) => `<button class="type-item${i === typeSel ? ' selected' : ''}" data-id="${t.id}">
        <span class="type-item-name"></span><span class="type-item-ext">.${t.ext}</span>
      </button>`)
    .join('');

  typeList.querySelectorAll('.type-item').forEach((el, i) => {
    el.querySelector('.type-item-name').textContent = list[i].name;
    el.addEventListener('click', () => pickType(list[i]));
  });
}

function pickType(t) {
  currentType = t;
  document.getElementById('type-current-name').textContent = t.name + '  .' + t.ext;
  typeSelect.classList.remove('open');
}

document.getElementById('type-current').addEventListener('click', (e) => {
  e.stopPropagation();
  typeSelect.classList.toggle('open');
  if (typeSelect.classList.contains('open')) {
    typeSearch.value = '';
    typeSel = 0;
    renderTypes();
    setTimeout(() => typeSearch.focus(), 30);
  }
});

typeSearch.addEventListener('input', () => { typeSel = 0; renderTypes(); });

typeSearch.addEventListener('keydown', (e) => {
  const list = matchingTypes();

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    typeSel = Math.min(typeSel + 1, list.length - 1);
    renderTypes();
    typeList.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    typeSel = Math.max(typeSel - 1, 0);
    renderTypes();
    typeList.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (list[typeSel]) pickType(list[typeSel]);
  } else if (e.key === 'Escape') {
    typeSelect.classList.remove('open');
  }
});

document.addEventListener('click', () => typeSelect.classList.remove('open'));
typeDrop.addEventListener('click', (e) => e.stopPropagation());

// ---------- creating ----------

function hint(msg) {
  document.getElementById('new-hint').textContent = msg || '';
}

document.getElementById('new-create').addEventListener('click', () => {
  const name = document.getElementById('new-name').value.trim();

  if (!name) return hint('give it a name first');
  if (!currentType) return hint('pick a file type');
  if (/[\\/]/.test(name)) return hint('no slashes in the name');
  if (!FS) return hint('no file system');

  if (makingProject) {
    if (FS.exists(name)) return hint('a folder called ' + name + ' already exists');

    const err = FS.createFolder('', name);
    if (err) return hint(err);

    const file = 'main.' + currentType.ext;
    FS.writeFile(name, file, STARTERS[currentType.ext] || '');
    openFile(name, file);
  } else {
    const file = name.includes('.') ? name : name + '.' + currentType.ext;
    FS.writeFile('', file, STARTERS[currentType.ext] || '');
    openFile('', file);
  }

  hint('');
});

document.getElementById('new-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('new-create').click();
});

// ---------- sidebar tree ----------

function openFolder(folder) {
  currentFolder = folder;
  const first = FS.list(folder).find(i => i.type === 'file');
  if (first) openFile(folder, first.name);
  else {
    show(editorView);
    filenameInput.value = '';
    textarea.value = '';
    renderTree();
  }
}

function openFile(folder, name) {
  currentFolder = folder;
  const path = folder ? folder + '/' + name : name;
  const content = FS ? FS.readFile(path) : null;

  filenameInput.value = name;
  textarea.value = content === null || content === undefined ? '' : content;
  currentType = BY_EXT[extOf(name)] || currentType;

  show(editorView);
  renderTree();
  paintRun();
  setTimeout(() => textarea.focus(), 40);
}

function renderTree() {
  if (!FS) return;

  document.getElementById('side-title').textContent = currentFolder || 'home';
  const items = FS.list(currentFolder);
  treeEl.innerHTML = '';

  if (currentFolder) {
    const up = document.createElement('button');
    up.className = 'tree-item tree-up';
    up.textContent = '..';
    up.addEventListener('click', () => {
      currentFolder = currentFolder.split('/').slice(0, -1).join('/');
      renderTree();
    });
    treeEl.appendChild(up);
  }

  items
    .slice()
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1))
    .forEach(item => {
      const el = document.createElement('button');
      el.className = 'tree-item' + (item.type === 'folder' ? ' folder' : '');
      if (item.type === 'file' && item.name === filenameInput.value) el.classList.add('active');

      el.innerHTML = item.type === 'folder'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><span></span>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg><span></span>';

      el.querySelector('span').textContent = item.name;

      el.addEventListener('click', () => {
        if (item.type === 'folder') {
          currentFolder = currentFolder ? currentFolder + '/' + item.name : item.name;
          renderTree();
        } else {
          openFile(currentFolder, item.name);
        }
      });

      treeEl.appendChild(el);
    });
}

document.getElementById('side-new').addEventListener('click', () => {
  makingProject = false;
  document.getElementById('new-title').textContent = 'New file in ' + (currentFolder || 'home');
  document.getElementById('new-name').value = '';
  show(newView);
});

document.getElementById('btn-toggle-side').addEventListener('click', () => {
  sideEl.classList.toggle('hidden');
});

if (FS) FS.subscribe(() => {
  const frame = window.frameElement;
  if (frame && !frame.isConnected) return;
  if (editorView.classList.contains('active')) renderTree();
  if (startView.classList.contains('active')) renderRecent();
});

// ---------- editor actions ----------

function flashBtn(btn, text) {
  const old = btn.innerHTML;
  btn.textContent = text;
  clearTimeout(btn._t);
  btn._t = setTimeout(() => { btn.innerHTML = old; }, 1400);
}

document.getElementById('btn-change-type').addEventListener('click', () => {
  makingProject = false;
  document.getElementById('new-title').textContent = 'Change type';
  document.getElementById('new-name').value = currentFilename().replace(/\.[^.]+$/, '');
  show(newView);
});

document.getElementById('btn-add-local').addEventListener('click', () => {
  const blob = new Blob([textarea.value], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = currentFilename();
  a.click();
  URL.revokeObjectURL(a.href);
});

const addDataBtn = document.getElementById('btn-add-data');

addDataBtn.addEventListener('click', () => {
  if (!FS) return;
  const err = FS.writeFile(currentFolder, currentFilename(), textarea.value);
  flashBtn(addDataBtn, err || 'Saved');
});

const runBtn = document.getElementById('btn-run');

function canRun() {
  const name = currentFilename();
  if (!FS) return false;
  return FS.isPage(name) || (FS.isRunnable && FS.isRunnable(name));
}

function paintRun() {
  runBtn.style.display = canRun() ? '' : 'none';
}

runBtn.addEventListener('click', () => {
  if (!FS) return;

  const err = FS.writeFile(currentFolder, currentFilename(), textarea.value);
  if (err) return flashBtn(runBtn, err);

  const path = currentFolder ? currentFolder + '/' + currentFilename() : currentFilename();
  if (FS.isPage(currentFilename())) FS.requestOpenInBrowser(path);
  else FS.requestRun(path);
});

filenameInput.addEventListener('input', paintRun);

// ---------- drag and drop ----------

const body = document.getElementById('editor-body');
const dropHint = document.getElementById('drop-hint');
let dragDepth = 0;

['dragenter', 'dragover'].forEach(ev => {
  document.addEventListener(ev, (e) => {
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault();
    if (ev === 'dragenter') dragDepth++;
    dropHint.classList.add('show');
  });
});

document.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dropHint.classList.remove('show');
});

document.addEventListener('drop', (e) => {
  if (!e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault();
  dragDepth = 0;
  dropHint.classList.remove('show');

  const file = e.dataTransfer.files[0];
  const reader = new FileReader();

  reader.onload = () => {
    show(editorView);
    filenameInput.value = file.name;
    textarea.value = String(reader.result || '');
    currentType = BY_EXT[extOf(file.name)] || currentType;
    paintRun();
    renderTree();
  };

  reader.readAsText(file);
});

// ---------- opening from other apps ----------

function openFromFS(path) {
  const parts = path.split('/');
  const name = parts.pop();
  openFile(parts.join('/'), name);
}

window.addEventListener('message', (e) => {
  if (e.data?.type === 'openFile' && e.data.path) openFromFS(e.data.path);
});

const pending = FS && FS.consumePendingOpen ? FS.consumePendingOpen() : null;

if (pending) {
  openFromFS(pending);
} else {
  show(startView);
  renderRecent();
}

renderTypes();
paintRun();