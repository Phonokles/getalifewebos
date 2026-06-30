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

const WALLPAPERS = ['Nightforrest.jpg', 'dayforrest.jpg'];
const APPS = ['settings', 'calculator', 'code', 'todo'];

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
    printLine('  echo <text>             print text');
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
  },

  clear() {
    outputEl.innerHTML = '';
  },

  echo(args) {
    printLine(args.join(' '));
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
      todo: 'openTodo'
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

printLine('Have a Life WebOS  --  type "help" to get started');
inputEl.focus();