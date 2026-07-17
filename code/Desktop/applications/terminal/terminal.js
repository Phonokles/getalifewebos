document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';

window.addEventListener('message', (e) => {
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
  }
});

const outputEl = document.getElementById('term-output');
const inputEl = document.getElementById('term-input');
const termEl = document.getElementById('term');

const history = [];
let historyIndex = -1;

const FS = (window.parent && window.parent.WebOSFS) ? window.parent.WebOSFS : null;
let cwd = '';

const promptEl = document.getElementById('term-prompt');

function updatePrompt() {
  promptEl.textContent = `user@webos:~${cwd ? '/' + cwd : ''}$`;
}

// resolves input like '..', 'projects/sub', '/abs', '~' against cwd.
// no input at all means the current directory (fixes ls always
// showing home), while '~' and '/' explicitly mean the root
function resolvePath(input) {
  if (input === undefined || input === null || input === '') return cwd;
  if (input === '~' || input === '/') return '';
  let parts = (input.startsWith('/') || input.startsWith('~'))
    ? []
    : cwd.split('/').filter(Boolean);
  for (const part of input.replace(/^[~/]+/, '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join('/');
}

// splits 'a/b/name' into parent path + name for create/write calls
function splitParent(path) {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop() || '';
  return { parent: parts.join('/'), name };
}

function requireFS() {
  if (!FS) {
    printLine('no file system found — run this terminal inside the WebOS', 'err');
    return false;
  }
  return true;
}

const nanoEl = document.getElementById('nano');
const nanoText = document.getElementById('nano-text');
const nanoFilename = document.getElementById('nano-filename');
const nanoStatus = document.getElementById('nano-status');
let nanoPath = null;

function nanoOpen(path) {
  nanoPath = path;
  nanoFilename.textContent = '~/' + path;
  nanoStatus.textContent = '';
  nanoText.value = FS.readFile(path) ?? '';
  nanoEl.classList.add('open');
  nanoText.focus();
}

function nanoSave() {
  const { parent, name } = splitParent(nanoPath);
  const err = FS.writeFile(parent, name, nanoText.value);
  nanoStatus.textContent = err ? err : '[ saved ]';
  if (!err) setTimeout(() => { nanoStatus.textContent = ''; }, 1200);
}

function nanoClose() {
  nanoEl.classList.remove('open');
  nanoPath = null;
  inputEl.focus();
}

nanoText.addEventListener('keydown', (e) => {
  if (e.ctrlKey && (e.key === 's' || e.key === 'o')) {   // ^S (or nano's ^O)
    e.preventDefault();
    nanoSave();
  }
  if (e.ctrlKey && e.key === 'x') {                      // ^X exit
    e.preventDefault();
    nanoClose();
  }
});



function copyAny(srcPath, dstParent, dstName) {
  const content = FS.readFile(srcPath);
  if (content !== null) {
    return FS.createFile(dstParent, dstName, content);   // file
  }
  let err = FS.createFolder(dstParent, dstName);         // folder: recurse
  if (err) return err;
  const dstPath = dstParent ? dstParent + '/' + dstName : dstName;
  for (const item of FS.list(srcPath)) {
    err = copyAny(srcPath + '/' + item.name, dstPath, item.name);
    if (err) return err;
  }
  return null;
}

// cp/mv target logic: 'cp a.txt folder' copies INTO the folder,
// 'cp a.txt b.txt' copies to that name
function resolveCopyTarget(dstRaw, srcName) {
  const dst = resolvePath(dstRaw);
  const isFolder = dst === '' || (FS.exists(dst) && FS.readFile(dst) === null);
  if (isFolder) return { parent: dst, name: srcName };
  return splitParent(dst);
}

const WALLPAPERS = ['Nightforrest.jpg', 'dayforrest.jpg'];
const APPS = ['settings', 'calculator', 'code', 'todo', 'files', 'snake'];

function printLine(text, cls = '') {
  const line = document.createElement('div');
  line.className = 'term-line' + (cls ? ' ' + cls : '');
  line.textContent = text;
  outputEl.appendChild(line);
  outputEl.scrollTop = outputEl.scrollHeight;
}

function printCommand(cmd) {
  printLine(cmd, 'cmd');
}

const COMMANDS = {
  help() {
    printLine('available commands:');
    printLine('  help                    show this list');
    printLine('  clear                   clear the screen');
    printLine('  echo <text> [> file]    print text / write it to a file');
    printLine('  date                    show current date/time');
    printLine('  whoami                  who you probably are');
    printLine('  neofetch                system info');
    printLine('  apps                    list openable apps');
    printLine('  open <app>              open an app');
    printLine('  theme <dark|light>      switch theme');
    printLine('  wallpaper <list|name>   list/set wallpaper');
    printLine('  workspace <1-4>         switch workspace');
    printLine('  lock                    lock the screen');
    printLine('  reboot                  reboot the system');
    printLine('  shutdown                shut the system down');
    printLine('files (RAM only, gone after reload):');
    printLine('  pwd                     current directory');
    printLine('  ls [path]               list a directory');
    printLine('  cd <path>               change directory (.. goes up)');
    printLine('  tree [path]             directory tree');
    printLine('  mkdir <name>            create a folder');
    printLine('  touch <file.ext>        create an empty file');
    printLine('  cat <file>              print a file');
    printLine('  head/tail <file> [n]    first/last n lines');
    printLine('  wc <file>               count lines/words/chars');
    printLine('  grep <pattern> <file>   search inside a file');
    printLine('  cp <src> <dst>          copy file or folder');
    printLine('  mv <src> <dst>          move / rename');
    printLine('  rm <path>               delete a file or folder');
    printLine('  nano <file>             edit right here (^S save, ^X exit)');
    printLine('  edit <file>             open a file in the code editor');
  },

  clear() {
    outputEl.innerHTML = '';
  },

  echo(args) {
    // echo hi > notes.txt (overwrite) / >> (append)
    const gt = args.indexOf('>');
    const gtgt = args.indexOf('>>');
    const redir = gtgt >= 0 ? gtgt : gt;

    if (redir < 0) {
      printLine(args.join(' '));
      return;
    }

    if (!requireFS()) return;
    const text = args.slice(0, redir).join(' ');
    const target = args[redir + 1];
    if (!target) {
      printLine('usage: echo <text> > <file>', 'err');
      return;
    }
    const path = resolvePath(target);
    const { parent, name } = splitParent(path);
    const old = (gtgt >= 0 && FS.readFile(path)) || '';
    const err = FS.writeFile(parent, name, old + text + '\n');
    if (err) {
      printLine(err, 'err');
    }
  },

  pwd() {
    printLine('~' + (cwd ? '/' + cwd : ''));
  },

  ls(args) {
    if (!requireFS()) return;
    const path = resolvePath(args[0] || '');
    if (!FS.exists(path)) {
      printLine(`ls: no such directory: ${args[0]}`, 'err');
      return;
    }
    const items = FS.list(path);
    if (!items.length) {
      printLine('(empty)');
      return;
    }
    items.forEach(item => {
      printLine(item.type === 'folder' ? item.name + '/' : item.name);
    });
  },

  cd(args) {
    if (!requireFS()) return;
    const path = resolvePath(args[0] || '~');    // plain cd goes home
    if (path !== '' && !FS.exists(path)) {
      printLine(`cd: no such directory: ${args[0]}`, 'err');
      return;
    }
    if (path !== '' && FS.readFile(path) !== null) {
      printLine(`cd: not a directory: ${args[0]}`, 'err');
      return;
    }
    cwd = path;
    updatePrompt();
  },

  mkdir(args) {
    if (!requireFS()) return;
    if (!args[0]) {
      printLine('usage: mkdir <name>', 'err');
      return;
    }
    const { parent, name } = splitParent(resolvePath(args[0]));
    const err = FS.createFolder(parent, name);
    if (err) printLine(`mkdir: ${err}`, 'err');
  },

  touch(args) {
    if (!requireFS()) return;
    if (!args[0]) {
      printLine('usage: touch <file.ext>', 'err');
      return;
    }
    const { parent, name } = splitParent(resolvePath(args[0]));
    const err = FS.createFile(parent, name, '');
    if (err) printLine(`touch: ${err}`, 'err');
  },

  cat(args) {
    if (!requireFS()) return;
    if (!args[0]) {
      printLine('usage: cat <file>', 'err');
      return;
    }
    const content = FS.readFile(resolvePath(args[0]));
    if (content === null) {
      printLine(`cat: no such file: ${args[0]}`, 'err');
      return;
    }
    content.split('\n').forEach(line => printLine(line));
  },

  rm(args) {
    if (!requireFS()) return;
    if (!args[0]) {
      printLine('usage: rm <path>', 'err');
      return;
    }
    const err = FS.remove(resolvePath(args[0]));
    if (err) printLine(`rm: ${err}`, 'err');
  },

  edit(args) {
    if (!requireFS()) return;
    if (!args[0]) {
      printLine('usage: edit <file>', 'err');
      return;
    }
    const path = resolvePath(args[0]);
    if (FS.readFile(path) === null) {
      printLine(`edit: no such file: ${args[0]}`, 'err');
      return;
    }
    FS.requestOpenInEditor(path);
    printLine(`opening ${args[0]} in the code editor...`);
  },

  nano(args) {
    if (!requireFS()) return;
    if (!args[0]) {
      printLine('usage: nano <file>', 'err');
      return;
    }
    const path = resolvePath(args[0]);
    // existing folders can't be nano'd; new files are fine (created on save)
    if (FS.exists(path) && FS.readFile(path) === null) {
      printLine(`nano: is a directory: ${args[0]}`, 'err');
      return;
    }
    nanoOpen(path);
  },

  cp(args) {
    if (!requireFS()) return;
    if (args.length < 2) {
      printLine('usage: cp <src> <dst>', 'err');
      return;
    }
    const src = resolvePath(args[0]);
    if (!FS.exists(src)) {
      printLine(`cp: no such file or directory: ${args[0]}`, 'err');
      return;
    }
    const { name: srcName } = splitParent(src);
    const { parent, name } = resolveCopyTarget(args[1], srcName);
    const err = copyAny(src, parent, name);
    if (err) printLine(`cp: ${err}`, 'err');
  },

  mv(args) {
    if (!requireFS()) return;
    if (args.length < 2) {
      printLine('usage: mv <src> <dst>', 'err');
      return;
    }
    const src = resolvePath(args[0]);
    if (!FS.exists(src)) {
      printLine(`mv: no such file or directory: ${args[0]}`, 'err');
      return;
    }
    const { name: srcName } = splitParent(src);
    const { parent, name } = resolveCopyTarget(args[1], srcName);
    const err = copyAny(src, parent, name);
    if (err) {
      printLine(`mv: ${err}`, 'err');
      return;
    }
    FS.remove(src);
    // moving the folder you're standing in kicks you back home
    if (cwd === src || cwd.startsWith(src + '/')) {
      cwd = '';
      updatePrompt();
    }
  },

  head(args) {
    if (!requireFS()) return;
    const content = args[0] !== undefined ? FS.readFile(resolvePath(args[0])) : null;
    if (content === null) {
      printLine(`head: no such file: ${args[0] || ''}`, 'err');
      return;
    }
    const n = parseInt(args[1], 10) || 10;
    content.split('\n').slice(0, n).forEach(line => printLine(line));
  },

  tail(args) {
    if (!requireFS()) return;
    const content = args[0] !== undefined ? FS.readFile(resolvePath(args[0])) : null;
    if (content === null) {
      printLine(`tail: no such file: ${args[0] || ''}`, 'err');
      return;
    }
    const n = parseInt(args[1], 10) || 10;
    content.split('\n').slice(-n).forEach(line => printLine(line));
  },

  wc(args) {
    if (!requireFS()) return;
    const content = args[0] !== undefined ? FS.readFile(resolvePath(args[0])) : null;
    if (content === null) {
      printLine(`wc: no such file: ${args[0] || ''}`, 'err');
      return;
    }
    const lines = content.split('\n').length;
    const words = content.split(/\s+/).filter(Boolean).length;
    printLine(`${lines} lines  ${words} words  ${content.length} chars  ${args[0]}`);
  },

  grep(args) {
    if (!requireFS()) return;
    if (args.length < 2) {
      printLine('usage: grep <pattern> <file>', 'err');
      return;
    }
    const content = FS.readFile(resolvePath(args[1]));
    if (content === null) {
      printLine(`grep: no such file: ${args[1]}`, 'err');
      return;
    }
    const pattern = args[0].toLowerCase();
    const hits = content.split('\n').filter(l => l.toLowerCase().includes(pattern));
    if (!hits.length) {
      printLine('(no matches)');
      return;
    }
    hits.forEach(line => printLine(line));
  },

  tree(args) {
    if (!requireFS()) return;
    const path = resolvePath(args[0] || '');
    if (path !== '' && (!FS.exists(path) || FS.readFile(path) !== null)) {
      printLine(`tree: no such directory: ${args[0]}`, 'err');
      return;
    }
    printLine('~' + (path ? '/' + path : ''));
    (function rec(p, prefix) {
      const items = FS.list(p);
      items.forEach((item, i) => {
        const last = i === items.length - 1;
        printLine(prefix + (last ? '`-- ' : '|-- ') + item.name + (item.type === 'folder' ? '/' : ''));
        if (item.type === 'folder') {
          rec(p ? p + '/' + item.name : item.name, prefix + (last ? '    ' : '|   '));
        }
      });
    })(path, '');
  },

  date() {
    printLine(new Date().toString());
  },

  whoami() {
    printLine('idk who tf you are');
  },

  neofetch() {
    printLine('   /\\_/\\   have a life webos');
    printLine('  ( o.o )  -------------------');
    printLine('   > ^ <   uptime: since you opened this tab');
    printLine('           shell:  fakebash 1.0');
    printLine('           theme:  ' + (document.documentElement.dataset.theme || 'dark'));
  },

  apps() {
    printLine('available apps: ' + APPS.join(', '));
  },

  open(args) {
    const app = (args[0] || '').toLowerCase();
    const map = {
      settings: 'openSettings',
      calculator: 'openCalculator',
      code: 'openCode',
      todo: 'openTodo',
      files: 'openFiles',
      snake: 'openSnake'
    };
    if (!map[app]) {
      printLine(`unknown app "${app}". try: ${APPS.join(', ')}`, 'err');
      return;
    }
    window.parent[map[app]]?.();
    printLine(`opening ${app}...`);
  },

  theme(args) {
    const mode = (args[0] || '').toLowerCase();
    if (mode !== 'dark' && mode !== 'light') {
      printLine('usage: theme <dark|light>', 'err');
      return;
    }
    document.documentElement.dataset.theme = mode;
    window.parent.postMessage({ type: 'setTheme', theme: mode }, '*');
    printLine(`theme set to ${mode}`);
  },

  wallpaper(args) {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'list' || !sub) {
      printLine('available wallpapers: ' + WALLPAPERS.join(', '));
      return;
    }
    const match = WALLPAPERS.find(w => w.toLowerCase() === sub);
    if (!match) {
      printLine(`unknown wallpaper "${sub}". try "wallpaper list"`, 'err');
      return;
    }
    window.parent.postMessage({ type: 'setWallpaper', file: match }, '*');
    printLine(`wallpaper set to ${match}`);
  },

  workspace(args) {
    const n = parseInt(args[0], 10);
    if (![1, 2, 3, 4].includes(n)) {
      printLine('usage: workspace <1-4>', 'err');
      return;
    }
    window.parent.switchWorkspace?.(n);
    printLine(`switched to workspace ${n}`);
  },

  lock() {
    printLine('locking...');
    window.parent.lockScreen?.();
  },

  reboot() {
    printLine('rebooting...');
    window.parent.location.href = '../shutdownanim/shutdownanim.html?reboot=1';
  },

  shutdown() {
    printLine('shutting down...');
    window.parent.location.href = '../shutdownanim/shutdownanim.html';
  }
};

function runCommand(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return;

  printCommand(trimmed);
  history.push(trimmed);
  historyIndex = history.length;

  const [name, ...args] = trimmed.split(/\s+/);
  const fn = COMMANDS[name.toLowerCase()];

  if (!fn) {
    printLine(`command not found: ${name}. type "help" for a list.`, 'err');
    return;
  }

  fn(args);
}

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    runCommand(inputEl.value);
    inputEl.value = '';
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (historyIndex > 0) {
      historyIndex--;
      inputEl.value = history[historyIndex];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex < history.length - 1) {
      historyIndex++;
      inputEl.value = history[historyIndex];
    } else {
      historyIndex = history.length;
      inputEl.value = '';
    }
  }
});

termEl.addEventListener('click', () => inputEl.focus());

updatePrompt();
printLine('Have a Life WebOS  --  type "help" to get started');
inputEl.focus();