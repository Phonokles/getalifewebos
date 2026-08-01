(function () {

  const root = { type: 'folder', name: '', children: {} };


  root.children['readme.txt'] = {
    type: 'file',
    name: 'readme.txt',
    content: 'welcome to your files [*_*]\n\neverything here lives in RAM only.\nreload the page and it is gone - so download\nanything you want to keep (Code app > Add locally).\n'
  };

  root.children['Pictures'] = { type: 'folder', name: 'Pictures', children: {} };

  const listeners = [];

 
  function splitPath(path) {
    return (path || '').split('/').filter(Boolean);
  }

  function getNode(path) {
    let node = root;
    for (const part of splitPath(path)) {
      if (node.type !== 'folder' || !node.children[part]) return null;
      node = node.children[part];
    }
    return node;
  }

  function notify(path) {
    listeners.forEach(fn => { try { fn(path); } catch (e) {} });
  }

  function joinPath(parent, name) {
    return splitPath(parent).concat(name).join('/');
  }

  window.WebOSFS = {


    list(path) {
      const node = getNode(path);
      if (!node || node.type !== 'folder') return [];
      return Object.values(node.children).sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    },

    exists(path) {
      return getNode(path) !== null;
    },


    createFolder(parentPath, name) {
      const parent = getNode(parentPath);
      if (!parent || parent.type !== 'folder') return 'folder not found';
      name = name.trim();
      if (!name) return 'name is empty';
      if (name.includes('/')) return 'name cannot contain /';
      if (parent.children[name]) return 'already exists';
      parent.children[name] = { type: 'folder', name, children: {} };
      notify(joinPath(parentPath, name));
      return null;
    },

    createFile(parentPath, name, content = '') {
      const parent = getNode(parentPath);
      if (!parent || parent.type !== 'folder') return 'folder not found';
      name = name.trim();
      if (!name) return 'name is empty';
      if (name.includes('/')) return 'name cannot contain /';
      if (!/\.[A-Za-z0-9]+$/.test(name)) return 'needs an extension like .txt';
      if (parent.children[name]) return 'already exists';
      parent.children[name] = { type: 'file', name, content };
      notify(joinPath(parentPath, name));
      return null;
    },

    readFile(path) {
      const node = getNode(path);
      return (node && node.type === 'file') ? node.content : null;
    },

    writeFile(parentPath, name, content) {
      const parent = getNode(parentPath);
      if (!parent || parent.type !== 'folder') return 'folder not found';
      name = name.trim();
      if (!name) return 'name is empty';
      if (!/\.[A-Za-z0-9]+$/.test(name)) return 'needs an extension like .txt';
      const existing = parent.children[name];
      if (existing && existing.type !== 'file') return 'a folder with that name exists';
      if (existing) {
        existing.content = content;
      } else {
        parent.children[name] = { type: 'file', name, content };
      }
      notify(joinPath(parentPath, name));
      return null;
    },

    remove(path) {
      const parts = splitPath(path);
      if (!parts.length) return 'cannot remove root';
      const name = parts.pop();
      const parent = getNode(parts.join('/'));
      if (!parent || parent.type !== 'folder' || !parent.children[name]) return 'not found';
      delete parent.children[name];
      notify(splitPath(path).join('/'));
      return null;
    },

    subscribe(fn) {
      listeners.push(fn);
    },
    _pendingOpen: null,
    _pendingImage: null,

    _pendingPage: null,

    _pendingRun: null,

    isImage(path) {
      return /\.(png|jpe?g|gif|webp|svg)$/i.test(path || '');
    },

    isPage(path) {
      return /\.html?$/i.test(path || '');
    },

    isRunnable(path) {
      return /\.(c|cpp|cc|cxx|rs|go|zig|java|cs|kt|swift|py|js|ts|rb|php|lua|sh)$/i.test(path || '');
    },

    requestRun(path) {
      this._pendingRun = path;

      let win = document.querySelector('.app-window[data-app="win-terminal"]')
             || document.getElementById('win-terminal');

      if (!win) {
        if (typeof openTerminal === 'function') win = openTerminal();
      } else {
        win.dataset.minimized = 'false';
        win.style.display = '';
        if (typeof setFocus === 'function') setFocus(win);
        if (typeof relayout === 'function') relayout();
      }

      const frame = win ? win.querySelector('iframe') : null;
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: 'runFile', path }, '*');
      }
    },

    consumePendingRun() {
      const p = this._pendingRun;
      this._pendingRun = null;
      return p;
    },

    requestOpen(path) {
      if (this.isImage(path)) this.requestOpenInViewer(path);
      else if (this.isPage(path)) this.requestOpenInBrowser(path);
      else this.requestOpenInEditor(path);
    },

    requestOpenInBrowser(path) {
      this._pendingPage = path;

      let win = document.querySelector('.app-window[data-app="win-browser"]')
             || document.getElementById('win-browser');

      if (!win) {
        if (typeof openBrowser === 'function') win = openBrowser();
      } else {
        win.dataset.minimized = 'false';
        win.style.display = '';
        if (typeof setFocus === 'function') setFocus(win);
        if (typeof relayout === 'function') relayout();
      }

      const frame = win ? win.querySelector('iframe') : null;
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: 'openPage', path }, '*');
      }
    },

    consumePendingPage() {
      const p = this._pendingPage;
      this._pendingPage = null;
      return p;
    },

    requestOpenInViewer(path) {
      this._pendingImage = path;

      let win = document.querySelector('.app-window[data-app="win-viewer"]')
             || document.getElementById('win-viewer');

      if (!win) {
        if (typeof openViewer === 'function') win = openViewer();
      } else {
        win.dataset.minimized = 'false';
        win.style.display = '';
        if (typeof setFocus === 'function') setFocus(win);
        if (typeof relayout === 'function') relayout();
      }

      const frame = win ? win.querySelector('iframe') : null;
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: 'openImage', path }, '*');
      }
    },

    consumePendingImage() {
      const p = this._pendingImage;
      this._pendingImage = null;
      return p;
    },

    requestOpenInEditor(path) {
      this._pendingOpen = path;

      // vorhandenes code-fenster wiederverwenden statt jedes mal ein neues zu oeffnen
      let win = document.querySelector('.app-window[data-app="win-code"]')
             || document.getElementById('win-code');

      if (!win) {
        if (typeof openCode === 'function') win = openCode();
      } else {
        win.dataset.minimized = 'false';
        win.style.display = '';
        if (typeof setFocus === 'function') setFocus(win);
        if (typeof relayout === 'function') relayout();
      }

      const frame = win ? win.querySelector('iframe') : null;
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: 'openFile', path }, '*');
      }
    },

    consumePendingOpen() {
      const p = this._pendingOpen;
      this._pendingOpen = null;
      return p;
    }
  };

})();