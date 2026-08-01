document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';

window.addEventListener('message', (e) => {
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
  }
});


const FS = (window.parent && window.parent.WebOSFS) ? window.parent.WebOSFS : null;

const breadcrumbEl = document.getElementById('files-breadcrumb');
const bodyEl       = document.getElementById('files-body');
const createRow    = document.getElementById('files-create-row');
const createInput  = document.getElementById('files-create-input');
const createHint   = document.getElementById('files-create-hint');

let currentPath = '';        // '' = root, otherwise 'folder/subfolder'
let createMode  = null;      // null | 'folder' | 'file'

const ICON_FOLDER = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
const ICON_FILE   = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><polyline points="14 2 14 7 19 7"/></svg>`;
const ICON_DEL    = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

function joinPath(base, name) {
  return base ? `${base}/${name}` : name;
}

function renderBreadcrumb() {
  breadcrumbEl.innerHTML = '';
  const parts = currentPath.split('/').filter(Boolean);

  const rootBtn = document.createElement('button');
  rootBtn.className = 'crumb' + (parts.length ? '' : ' current');
  rootBtn.textContent = 'data';
  rootBtn.addEventListener('click', () => navigate(''));
  breadcrumbEl.appendChild(rootBtn);

  let acc = '';
  parts.forEach((part, i) => {
    const sep = document.createElement('span');
    sep.className = 'crumb-sep';
    sep.textContent = '/';
    breadcrumbEl.appendChild(sep);

    acc = joinPath(acc, part);
    const target = acc;
    const btn = document.createElement('button');
    btn.className = 'crumb' + (i === parts.length - 1 ? ' current' : '');
    btn.textContent = part;
    btn.addEventListener('click', () => navigate(target));
    breadcrumbEl.appendChild(btn);
  });
}


function renderList() {
  bodyEl.innerHTML = '';

  if (!FS) {
    bodyEl.innerHTML = '<div class="files-empty">no file system found — open this app inside the WebOS</div>';
    return;
  }

  const items = FS.list(currentPath);

  if (!items.length) {
    bodyEl.innerHTML = '<div class="files-empty">nothing here yet</div>';
    return;
  }

  items.forEach(item => {
    const row = document.createElement('button');
    row.className = 'files-item';
    const isPage = item.type === 'file' && FS.isPage && FS.isPage(item.name);
    const isCode = item.type === 'file' && FS.isRunnable && FS.isRunnable(item.name);
    const runnable = isPage || isCode;

    row.innerHTML = `
      ${item.type === 'folder' ? ICON_FOLDER : ICON_FILE}
      <span class="files-item-name"></span>
      ${runnable ? `<span class="files-item-run" title="${isPage ? 'Open in the browser' : 'Run in the terminal'}">&#9654;</span>` : ''}
      <span class="files-item-del" title="Delete">${ICON_DEL}</span>
    `;
    // textContent so weird characters in names can't break the markup
    row.querySelector('.files-item-name').textContent = item.name;

    row.addEventListener('click', (e) => {
      if (e.target.closest('.files-item-del')) {
        FS.remove(joinPath(currentPath, item.name));
        return;
      }
      if (e.target.closest('.files-item-run')) {
        const full = joinPath(currentPath, item.name);
        if (isPage) FS.requestOpenInBrowser(full);
        else FS.requestRun(full);
        return;
      }
      if (item.type === 'folder') {
        navigate(joinPath(currentPath, item.name));
      } else {
        FS.requestOpen(joinPath(currentPath, item.name));
      }
    });

    bodyEl.appendChild(row);
  });
}

function navigate(path) {
  currentPath = path;
  closeCreate();
  renderBreadcrumb();
  renderList();
}


function openCreate(mode) {
  createMode = mode;
  createRow.classList.add('open');
  createHint.classList.add('open');
  createHint.classList.remove('error');
  createInput.value = '';
  createInput.placeholder = mode === 'folder' ? 'folder name' : 'filename.txt';
  createHint.textContent = mode === 'folder'
    ? 'name of the new folder'
    : 'type the name with its extension, e.g. notes.txt or main.py';
  createInput.focus();
}

function closeCreate() {
  createMode = null;
  createRow.classList.remove('open');
  createHint.classList.remove('open');
}

function confirmCreate() {
  if (!FS || !createMode) return;
  const name = createInput.value;
  const err = createMode === 'folder'
    ? FS.createFolder(currentPath, name)
    : FS.createFile(currentPath, name, '');

  if (err) {
    createHint.textContent = err;
    createHint.classList.add('error');
    createInput.focus();
    return;
  }
  closeCreate();
}

document.getElementById('btn-new-folder').addEventListener('click', () => openCreate('folder'));
document.getElementById('btn-new-file').addEventListener('click', () => openCreate('file'));
document.getElementById('files-create-confirm').addEventListener('click', confirmCreate);
document.getElementById('files-create-cancel').addEventListener('click', closeCreate);

createInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') confirmCreate();
  if (e.key === 'Escape') closeCreate();
});

if (FS) FS.subscribe(() => { renderBreadcrumb(); renderList(); });

navigate('');