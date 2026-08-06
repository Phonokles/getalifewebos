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

// ---------- github ----------

const ghModal = document.getElementById('gh-modal');
const ghTitle = document.getElementById('gh-modal-title');
const ghBody = document.getElementById('gh-modal-body');
const ghStatus = document.getElementById('gh-modal-status');

function ghOpen(title) {
  ghTitle.textContent = title;
  ghStatus.textContent = '';
  ghStatus.className = 'gh-modal-status';
  ghModal.classList.add('open');
}

function ghClose() {
  ghModal.classList.remove('open');
  ghBody.innerHTML = '';
}

function ghSay(msg, kind) {
  ghStatus.textContent = msg || '';
  ghStatus.className = 'gh-modal-status' + (kind ? ' ' + kind : '');
}

document.getElementById('gh-modal-close').addEventListener('click', ghClose);
ghModal.addEventListener('click', (e) => { if (e.target === ghModal) ghClose(); });

function parseRepo(value) {
  const val = (value || '').trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '');
  const parts = val.split('/').filter(Boolean);
  return parts.length >= 2 ? { owner: parts[0], repo: parts[1] } : null;
}

function renderGhBar() {
  const bar = document.getElementById('gh-bar');
  if (!bar) return;

  const GH = window.GitHubClient;
  bar.innerHTML = '';
  if (!GH) return;

  if (GH.hasToken()) {
    const who = document.createElement('span');
    who.className = 'gh-bar-user';
    who.textContent = 'GitHub: ' + GH.user();

    const out = document.createElement('button');
    out.className = 'gh-bar-btn';
    out.textContent = 'Sign out';
    out.addEventListener('click', () => { GH.signOut(); renderGhBar(); });

    bar.appendChild(who);
    bar.appendChild(out);
  } else {
    const b = document.createElement('button');
    b.className = 'gh-bar-btn gh-bar-signin';
    b.textContent = 'Sign in to GitHub';
    b.addEventListener('click', () => openSignIn());
    bar.appendChild(b);
  }
}

function openSignIn(after) {
  const GH = window.GitHubClient;
  if (!GH) return;

  ghOpen('Sign in to GitHub');
  ghBody.innerHTML = `
    <p class="gh-note">Paste a personal access token with <b>repo</b> scope
      (github.com &rsaquo; Settings &rsaquo; Developer settings &rsaquo; Tokens).
      It is stored only in this browser.</p>
    <input type="password" class="gh-input" id="gh-token" placeholder="ghp_...  or  github_pat_..." spellcheck="false" autocomplete="off">
    <button class="gh-primary" id="gh-token-go">Sign in</button>`;

  const input = document.getElementById('gh-token');
  const go = document.getElementById('gh-token-go');
  setTimeout(() => input.focus(), 40);

  async function run() {
    go.disabled = true;
    ghSay('checking token...');
    try {
      const login = await GH.signIn(input.value);
      ghSay('signed in as ' + login, 'ok');
      renderGhBar();
      setTimeout(() => { ghClose(); if (after) after(); }, 650);
    } catch (e) {
      ghSay(String(e.message || e), 'err');
      go.disabled = false;
    }
  }

  go.addEventListener('click', run);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
}

function fillRepoPicks(boxId, onPick) {
  const GH = window.GitHubClient;
  GH.repos().then(list => {
    const box = document.getElementById(boxId);
    if (!box) return;
    box.innerHTML = '<div class="gh-repos-title">your repos</div>';
    list.slice(0, 40).forEach(r => {
      const b = document.createElement('button');
      b.className = 'gh-repo-chip';
      b.textContent = r.full_name + (r.private ? ' \u00b7 private' : '');
      b.addEventListener('click', () => onPick(r));
      box.appendChild(b);
    });
  }).catch(() => {});
}

function openClone() {
  const GH = window.GitHubClient;
  if (!GH) return;
  if (!GH.hasToken()) { openSignIn(openClone); return; }

  ghOpen('Clone from GitHub');
  ghBody.innerHTML = `
    <p class="gh-note">Enter a repo as <b>owner/name</b>. Its files land in a new folder in your filesystem.</p>
    <input type="text" class="gh-input" id="gh-repo" placeholder="Phonokles/getalifewebos" spellcheck="false" autocomplete="off">
    <input type="text" class="gh-input" id="gh-branch" placeholder="branch (optional)" spellcheck="false" autocomplete="off">
    <button class="gh-primary" id="gh-clone-go">Clone</button>
    <div class="gh-repos" id="gh-repos"></div>`;

  const repoI = document.getElementById('gh-repo');
  const branchI = document.getElementById('gh-branch');
  const go = document.getElementById('gh-clone-go');
  setTimeout(() => repoI.focus(), 40);

  fillRepoPicks('gh-repos', (r) => { repoI.value = r.full_name; branchI.value = r.branch || ''; });

  async function run() {
    const parsed = parseRepo(repoI.value);
    if (!parsed) { ghSay('use owner/name', 'err'); return; }

    go.disabled = true;
    try {
      ghSay('reading the repo tree...');
      const res = await GH.clone(parsed.owner, parsed.repo, branchI.value.trim(), parsed.repo,
        (n, t) => ghSay(`downloading ${n}/${t}`));
      ghSay(`cloned ${res.count} files into ${res.dest}`
        + (res.skipped ? `  (${res.skipped} skipped, no extension)` : ''), 'ok');
      renderRecent();
      setTimeout(() => { ghClose(); openFolder(res.dest); }, 900);
    } catch (e) {
      ghSay(String(e.message || e), 'err');
      go.disabled = false;
    }
  }

  go.addEventListener('click', run);
  [repoI, branchI].forEach(el => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); }));
}

function openCommit() {
  const GH = window.GitHubClient;
  if (!GH || !FS) return;
  if (!GH.hasToken()) { openSignIn(openCommit); return; }

  const folder = currentFolder;
  let files;
  if (folder) {
    files = GH.collect(folder);
  } else {
    const name = currentFilename();
    FS.writeFile('', name, textarea.value);
    files = [{ path: name, content: textarea.value }];
  }

  if (!files.length) { ghOpen('Commit to GitHub'); ghSay('nothing to commit', 'err'); return; }

  ghOpen('Commit to GitHub');
  ghBody.innerHTML = `
    <p class="gh-note">${folder
      ? `Committing the <b>${folder}</b> folder (${files.length} files).`
      : `Committing <b>${currentFilename()}</b>.`} Existing files are updated, new ones added.</p>
    <input type="text" class="gh-input" id="gh-crepo" placeholder="owner/name" spellcheck="false" autocomplete="off">
    <input type="text" class="gh-input" id="gh-cbranch" placeholder="branch (pick a repo to fill)" spellcheck="false" autocomplete="off">
    <input type="text" class="gh-input" id="gh-cmsg" placeholder="commit message" spellcheck="false" autocomplete="off">
    <button class="gh-primary" id="gh-commit-go">Commit &amp; push</button>
    <div class="gh-repos" id="gh-repos"></div>`;

  const repoI = document.getElementById('gh-crepo');
  const branchI = document.getElementById('gh-cbranch');
  const msgI = document.getElementById('gh-cmsg');
  const go = document.getElementById('gh-commit-go');

  const last = localStorage.getItem('githubLastRepo') || '';
  if (last) repoI.value = last;
  msgI.value = 'update ' + (folder || currentFilename());
  setTimeout(() => repoI.focus(), 40);

  fillRepoPicks('gh-repos', (r) => { repoI.value = r.full_name; branchI.value = r.branch || ''; });

  async function run() {
    const parsed = parseRepo(repoI.value);
    if (!parsed) { ghSay('use owner/name', 'err'); return; }
    const branch = branchI.value.trim() || 'main';

    go.disabled = true;
    try {
      ghSay('uploading files...');
      const res = await GH.push({
        owner: parsed.owner, repo: parsed.repo, branch,
        message: msgI.value.trim(), files,
        onProgress: (n, t) => ghSay(`uploading ${n}/${t}`),
      });
      localStorage.setItem('githubLastRepo', parsed.owner + '/' + parsed.repo);
      ghSay(`committed ${res.count} files  \u00b7  ${res.sha}`, 'ok');
      setTimeout(ghClose, 1800);
    } catch (e) {
      ghSay(String(e.message || e), 'err');
      go.disabled = false;
    }
  }

  go.addEventListener('click', run);
  [repoI, branchI, msgI].forEach(el => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); }));
}

document.getElementById('start-clone').addEventListener('click', openClone);
document.getElementById('btn-commit').addEventListener('click', openCommit);

renderGhBar();