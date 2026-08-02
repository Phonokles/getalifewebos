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


const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const ICON_RUN = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>';

let query = '';

function searchAll(q) {
  const needle = q.toLowerCase();
  const found = [];

  (function walk(path) {
    FS.list(path).forEach(item => {
      const full = path ? path + '/' + item.name : item.name;
      if (item.name.toLowerCase().includes(needle)) {
        found.push({ ...item, where: path });
      }
      if (item.type === 'folder') walk(full);
    });
  })('');

  return found.slice(0, 60);
}

function renderList() {
  bodyEl.innerHTML = '';

  if (!FS) {
    bodyEl.innerHTML = '<div class="files-empty">no file system found — open this app inside the WebOS</div>';
    return;
  }

  // searching looks through every folder, not just the one you are standing in
  const items = query ? searchAll(query) : FS.list(currentPath);

  if (!items.length) {
    bodyEl.innerHTML = query
      ? '<div class="files-empty">nothing matches "' + query + '" [-_-]</div>'
      : '<div class="files-empty">nothing here yet</div>';
    return;
  }

  items.forEach(item => {
    const row = document.createElement('button');
    row.className = 'files-item';
    const isPage = item.type === 'file' && FS.isPage && FS.isPage(item.name);
    const isCode = item.type === 'file' && FS.isRunnable && FS.isRunnable(item.name);
    const runnable = isPage || isCode;
    const editable = item.type === 'file' && !FS.isImage(item.name);

    row.innerHTML = `
      ${item.type === 'folder' ? ICON_FOLDER : ICON_FILE}
      <span class="files-item-name"></span>
      <span class="files-item-tools">
        ${editable ? '<span class="files-item-act files-item-edit" title="Edit in the code app">' + ICON_EDIT + '</span>' : ''}
        ${runnable ? `<span class="files-item-act files-item-run" title="${isPage ? 'Open in the browser' : 'Run in the terminal'}">` + ICON_RUN + '</span>' : ''}
        <span class="files-item-act files-item-del" title="Delete">${ICON_DEL}</span>
      </span>
    `;
    // textContent so weird characters in names can't break the markup
    row.querySelector('.files-item-name').textContent = item.name;

    if (item.where !== undefined) {
      const where = document.createElement('span');
      where.className = 'files-item-where';
      where.textContent = item.where || 'home';
      row.querySelector('.files-item-name').after(where);
    }

    const base = item.where !== undefined ? item.where : currentPath;

    row.addEventListener('click', (e) => {
      if (e.target.closest('.files-item-del')) {
        FS.remove(joinPath(base, item.name));
        return;
      }
      if (e.target.closest('.files-item-edit')) {
        FS.requestOpenInEditor(joinPath(base, item.name));
        return;
      }
      if (e.target.closest('.files-item-run')) {
        const full = joinPath(base, item.name);
        if (isPage) FS.requestOpenInBrowser(full);
        else FS.requestRun(full);
        return;
      }
      if (item.type === 'folder') {
        navigate(joinPath(base, item.name));
      } else {
        FS.requestOpen(joinPath(base, item.name));
      }
    });

    bodyEl.appendChild(row);
  });
}

const searchInput = document.getElementById('files-search');
const searchClear = document.getElementById('files-search-clear');

function paintSearch() {
  searchClear.style.display = query ? '' : 'none';
  document.querySelector('.files-search-row').classList.toggle('active', !!query);
}

searchInput.addEventListener('input', () => {
  query = searchInput.value.trim();
  paintSearch();
  renderList();
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  searchInput.value = '';
  query = '';
  paintSearch();
  renderList();
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  query = '';
  paintSearch();
  renderList();
  searchInput.focus();
});

paintSearch();

function navigate(path) {
  currentPath = path;
  query = '';
  if (searchInput) searchInput.value = '';
  paintSearch();
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