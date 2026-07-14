
(function () {

  const root = { type: 'folder', name: '', children: {} };


  root.children['readme.txt'] = {
    type: 'file',
    name: 'readme.txt',
    content: 'welcome to your files [*_*]\n\neverything here lives in RAM only.\nreload the page and it is gone - so download\nanything you want to keep (Code app > Add locally).\n'
  };

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

  function notify() {
    listeners.forEach(fn => { try { fn(); } catch (e) {} });
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
      notify();
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
      notify();
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
      notify();
      return null;
    },

    remove(path) {
      const parts = splitPath(path);
      if (!parts.length) return 'cannot remove root';
      const name = parts.pop();
      const parent = getNode(parts.join('/'));
      if (!parent || parent.type !== 'folder' || !parent.children[name]) return 'not found';
      delete parent.children[name];
      notify();
      return null;
    },

    subscribe(fn) {
      listeners.push(fn);
    },
   _pendingOpen: null,

    requestOpenInEditor(path) {
      this._pendingOpen = path;
      if (typeof openCode === 'function') openCode();
      const win = document.getElementById('win-code');
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