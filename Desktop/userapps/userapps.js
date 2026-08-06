// turns files in the virtual filesystem into apps and widgets.
//   name.window  -> a launchable app, opens the html in a window
//   name.widget  -> a desktop widget you switch on in settings
// the app or widget is named after the file, the icon is the first letter.
// everything is rescanned whenever the filesystem changes.

(function () {

  const FS = window.WebOSFS;
  if (!FS) return;

  // injected into every user app and widget so their links go through the os
  // instead of trying to navigate the iframe against the wrong base url
  function navHook(from) {
    return '<scr' + 'ipt>(function(){' +
      'document.addEventListener("click",function(e){' +
      'var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a)return;' +
      'var href=a.getAttribute("href")||"";' +
      'if(!href||href.charAt(0)==="#"||href.indexOf("javascript:")===0)return;' +
      'e.preventDefault();' +
      'parent.postMessage({type:"userAppNav",href:href,from:' + JSON.stringify(from) + '},"*");' +
      '},true);}());</scr' + 'ipt>';
  }

  function withHook(path) {
    return (FS.readFile(path) || '') + navHook(path);
  }

  const windowsList = [];               // [{ path, name, id, letter }]
  const widgetsList = [];               // [{ path, name, key, letter }]
  const widgetNodes = {};               // path -> { key, id, node, frame, lastContent }
  let widgetSeq = 0;

  function fileName(p) {
    return String(p || '').split('/').pop();
  }
  function appName(p) {
    return fileName(p).replace(/\.(window|widget)$/i, '');
  }
  function letterOf(name) {
    return ((name || '').trim()[0] || '?').toUpperCase();
  }

  function walk(path, cb) {
    FS.list(path).forEach(item => {
      const full = path ? path + '/' + item.name : item.name;
      if (item.type === 'folder') walk(full, cb);
      else cb(full, item.name);
    });
  }

  function makeWidgetNode(path) {
    const node = document.createElement('div');
    node.className = 'user-widget';
    node.id = 'userwidget-' + (++widgetSeq);

    const frame = document.createElement('iframe');
    frame.className = 'user-widget-frame';
    node.appendChild(frame);
    document.body.appendChild(node);

    frame.srcdoc = withHook(path);
    return { node, frame };
  }

  // brings the widget nodes in sync with the .widget files on disk
  function syncWidgets(paths) {
    Object.keys(widgetNodes).forEach(p => {
      if (paths.includes(p)) return;
      const info = widgetNodes[p];
      window.WidgetManager?.unregister(info.key);
      info.node.remove();
      delete widgetNodes[p];
    });

    let order = 0;
    paths.forEach(p => {
      const content = FS.readFile(p) || '';

      if (widgetNodes[p]) {
        // the file could have been edited, so refresh the iframe if it changed
        if (widgetNodes[p].lastContent !== content) {
          widgetNodes[p].frame.srcdoc = content + navHook(p);
          widgetNodes[p].lastContent = content;
        }
        order++;
        return;
      }

      const key = 'uwidget:' + p;
      const made = makeWidgetNode(p);
      widgetNodes[p] = { key, id: made.node.id, node: made.node, frame: made.frame, lastContent: content };

      window.WidgetManager?.register({
        key,
        id: made.node.id,
        min: { w: 140, h: 100 },
        defaultVisible: false,                                   // opt in from settings
        defaultLayout: { x: 40, y: 60 + order * 30, w: 240, h: 180 },
      });
      order++;
    });
  }

  function scan() {
    const foundWindows = [];
    const foundWidgets = [];

    walk('', (full, name) => {
      if (/\.window$/i.test(name)) foundWindows.push(full);
      else if (/\.widget$/i.test(name)) foundWidgets.push(full);
    });

    windowsList.length = 0;
    foundWindows.forEach(p => {
      const name = appName(p);
      windowsList.push({ path: p, name, id: 'uwin:' + p, letter: letterOf(name) });
    });

    // close windows whose .window file was deleted
    document.querySelectorAll('.app-window[data-app^="uwin:"]').forEach(win => {
      const path = win.dataset.app.slice(5);
      if (!foundWindows.includes(path) && typeof destroyWindow === 'function') destroyWindow(win);
    });

    syncWidgets(foundWidgets);

    widgetsList.length = 0;
    foundWidgets.forEach(p => {
      const name = appName(p);
      widgetsList.push({ path: p, name, key: 'uwidget:' + p, letter: letterOf(name) });
    });

    window.dispatchEvent(new CustomEvent('userapps-changed'));
  }

  function openUserWindow(path) {
    if (!FS.exists(path)) return null;
    const name = appName(path);
    const html = withHook(path);
    const win = openWindow('uwin:' + path, name.toUpperCase(), '', 640, 480,
      { singleton: true, srcdoc: html });

    // a reopened singleton keeps its old content, so push the latest in
    const frame = win && win.querySelector('iframe');
    if (frame) frame.srcdoc = html;
    return win;
  }

  // resolve a link from inside an app against that app's folder in the fs
  function resolveNav(fromPath, href) {
    if (/^https?:/i.test(href)) return { external: href };
    const parts = String(fromPath).split('/').slice(0, -1);
    href.split('/').forEach(part => {
      if (!part || part === '.') return;
      if (part === '..') parts.pop();
      else parts.push(part);
    });
    return { path: parts.join('/') };
  }

  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.type !== 'userAppNav' || !d.href) return;

    const target = resolveNav(d.from || '', d.href);

    if (target.external) {
      if (FS.requestOpenUrl) FS.requestOpenUrl(target.external);
      return;
    }

    const p = target.path;
    if (!p || !FS.exists(p)) return;

    if (FS.isWindowApp && FS.isWindowApp(p)) openUserWindow(p);
    else if (FS.isPage && FS.isPage(p)) FS.requestOpenInBrowser(p);
    else FS.requestOpen(p);
  });

  function toggleWidget(path) {
    const info = widgetNodes[path];
    if (!info) return;
    const next = !(window.WidgetManager?.isVisible(info.key));
    window.postMessage({ type: 'setWidgetVisible', widget: info.key, visible: next }, '*');
  }

  window.UserApps = {
    listWindows: () => windowsList.slice(),
    listWidgets: () => widgetsList.slice(),
    openWindow: openUserWindow,
    toggleWidget,
    rescan: scan,
  };

  FS.subscribe(scan);
  scan();

})();