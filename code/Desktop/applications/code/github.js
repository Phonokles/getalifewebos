// talks to the github rest api straight from the browser with a personal
// access token. github allows cross origin api calls, so no server is needed.
// clone reads a repo tree into the virtual filesystem, commit walks a folder
// back out through the git data api (blobs -> tree -> commit -> ref).

(function () {

  const API = 'https://api.github.com';
  const IMG_MIME = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  };

  function fs() {
    return (window.parent && window.parent.WebOSFS) ? window.parent.WebOSFS : null;
  }

  function token() { return localStorage.getItem('githubToken') || ''; }

  // base64 that survives unicode both ways
  function toB64(str) { return btoa(unescape(encodeURIComponent(str))); }
  function fromB64(b64) { return decodeURIComponent(escape(atob(String(b64).replace(/\s/g, '')))); }

  function headers(extra) {
    return Object.assign({
      'Authorization': 'Bearer ' + token(),
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }, extra || {});
  }

  async function api(path, opts) {
    opts = opts || {};
    const res = await fetch(API + path, { method: opts.method || 'GET', headers: headers(opts.headers), body: opts.body });
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).message || msg; } catch (e) {}
      throw new Error(res.status + ' ' + msg);
    }
    return res.status === 204 ? null : res.json();
  }

  // run async work over a list a few at a time, reporting progress
  async function pool(items, worker, concurrency, onEach) {
    let i = 0, done = 0;
    const results = new Array(items.length);
    async function run() {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await worker(items[idx], idx);
        done++;
        if (onEach) onEach(done, items.length);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) || 1 }, run));
    return results;
  }

  function ensureFolder(FS, path) {
    if (!path) return;
    let acc = '';
    path.split('/').forEach(part => {
      const parent = acc;
      acc = acc ? acc + '/' + part : part;
      if (!FS.exists(acc)) FS.createFolder(parent, part);
    });
  }

  function extOf(name) {
    const m = /\.([a-z0-9]+)$/i.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  }

  // ---------- auth ----------

  async function signIn(tok) {
    tok = (tok || '').trim();
    if (!tok) throw new Error('paste a token first');

    const res = await fetch(API + '/user', {
      headers: { 'Authorization': 'Bearer ' + tok, 'Accept': 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(res.status === 401 ? 'token rejected' : 'github answered ' + res.status);

    const u = await res.json();
    localStorage.setItem('githubToken', tok);
    localStorage.setItem('githubUser', u.login);
    return u.login;
  }

  function signOut() {
    localStorage.removeItem('githubToken');
    localStorage.removeItem('githubUser');
  }

  async function repos() {
    const list = await api('/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator');
    return list.map(r => ({ full_name: r.full_name, branch: r.default_branch, private: r.private }));
  }

  // ---------- clone ----------

  async function clone(owner, repo, branch, dest, onProgress) {
    const FS = fs();
    if (!FS) throw new Error('no filesystem');

    if (!branch) {
      const info = await api(`/repos/${owner}/${repo}`);
      branch = info.default_branch;
    }

    const tree = await api(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    const nodes = tree.tree || [];
    const blobs = nodes.filter(n => n.type === 'blob');

    dest = (dest || repo).trim();
    ensureFolder(FS, dest);
    nodes.filter(n => n.type === 'tree').forEach(n => ensureFolder(FS, dest + '/' + n.path));

    let skipped = 0;
    await pool(blobs, async (b) => {
      const full = dest + '/' + b.path;
      const folder = full.split('/').slice(0, -1).join('/');
      const name = full.split('/').pop();
      ensureFolder(FS, folder);

      const blob = await api(`/repos/${owner}/${repo}/git/blobs/${b.sha}`);
      const b64 = (blob.content || '').replace(/\n/g, '');
      const ext = extOf(name);

      let content;
      if (IMG_MIME[ext]) {
        content = `data:${IMG_MIME[ext]};base64,${b64}`;
      } else {
        try { content = fromB64(b64); } catch (e) { content = ''; }
      }

      // the filesystem needs an extension on every file, so LICENSE, Makefile
      // and the like cannot be stored and are skipped
      const err = FS.writeFile(folder, name, content);
      if (err) skipped++;
    }, 4, onProgress);

    return { branch, dest, count: blobs.length - skipped, skipped };
  }

  // ---------- collect + commit ----------

  function collect(folder) {
    const FS = fs();
    const out = [];
    (function walk(path) {
      FS.list(path).forEach(item => {
        const full = path ? path + '/' + item.name : item.name;
        if (item.type === 'folder') walk(full);
        else {
          const rel = folder && full.startsWith(folder + '/') ? full.slice(folder.length + 1) : full;
          out.push({ path: rel, content: FS.readFile(full) || '' });
        }
      });
    })(folder || '');
    return out;
  }

  async function push(opts) {
    const { owner, repo, branch, message, files, onProgress } = opts;
    if (!files || !files.length) throw new Error('nothing to commit');

    const ref = await api(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    const baseSha = ref.object.sha;
    const baseCommit = await api(`/repos/${owner}/${repo}/git/commits/${baseSha}`);

    const entries = await pool(files, async (f) => {
      const isData = /^data:[^;]+;base64,/.test(f.content);
      const body = isData
        ? { content: f.content.split(',')[1], encoding: 'base64' }
        : { content: toB64(f.content), encoding: 'base64' };

      const blob = await api(`/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
    }, 4, onProgress);

    const newTree = await api(`/repos/${owner}/${repo}/git/trees`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: entries }),
    });

    const newCommit = await api(`/repos/${owner}/${repo}/git/commits`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message || 'update from Have a Life WebOS', tree: newTree.sha, parents: [baseSha] }),
    });

    await api(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: newCommit.sha }),
    });

    return { sha: newCommit.sha.slice(0, 7), count: files.length, url: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}` };
  }

  window.GitHubClient = {
    user: () => localStorage.getItem('githubUser'),
    hasToken: () => !!token(),
    signIn, signOut, repos, clone, collect, push,
  };

})();