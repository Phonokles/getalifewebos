document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';

window.addEventListener('message', (e) => {
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
  }
});

const HOME = 'about:home';
const RESULTS = 'about:results?';
const IMAGES = 'about:images?';
const VIDEOS = 'about:videos?';
const PROXY = '/api/proxy?url=';
const FILE = 'file:';

const FS = (window.parent && window.parent.WebOSFS) ? window.parent.WebOSFS : null;

// injected first in every local page: keeps its links and any script driven
// navigation inside the os instead of hitting the real server
const FILE_HOOK = `<script>
(function () {
  function nav(u) { try { parent.postMessage({ type: 'fileNav', href: String(u) }, '*'); } catch (e) {} }

  // window.location = '...' , location.assign() and location.replace() can be
  // trapped. location.href = '...' cannot, browsers keep that one read only
  try {
    var real = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true, get: function () { return real; }, set: function (u) { nav(u); },
    });
  } catch (e) {}
  try { window.location.assign = nav; } catch (e) {}
  try { window.location.replace = nav; } catch (e) {}

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0) return;
    e.preventDefault();
    nav(href);
  }, true);
}());
<\/script>`;

function resolveFile(base, href) {
  if (/^https?:/i.test(href)) return href;

  const parts = base.split('/').slice(0, -1);
  href.split('/').forEach(part => {
    if (!part || part === '.') return;
    if (part === '..') parts.pop();
    else parts.push(part);
  });
  return FILE + parts.join('/');
}

// resolve a relative path against a file's folder, staying in the filesystem
function resolveFsPath(base, href) {
  const parts = base.split('/').slice(0, -1);
  href.split('/').forEach(part => {
    if (!part || part === '.') return;
    if (part === '..') parts.pop();
    else parts.push(part);
  });
  return parts.join('/');
}

// follows a chain of meta refreshes inside the filesystem, so a redirect page
// like index.html lands on its real target instead of the dev server
function fsRedirectTarget(path) {
  const seen = new Set();
  let current = path;

  while (!seen.has(current)) {
    seen.add(current);
    const content = FS ? FS.readFile(current) : null;
    if (content == null) break;

    const meta = /<meta[^>]+http-equiv=["']?refresh["']?[^>]*>/i.exec(content);
    if (!meta) break;
    const url = /url\s*=\s*['"]?([^'">;]+)/i.exec(meta[0]);
    if (!url) break;

    const href = url[1].trim();
    if (/^https?:/i.test(href)) break;         // external redirect, leave it

    const next = resolveFsPath(current, href);
    if (!FS.exists(next)) break;
    current = next;
  }

  return current;
}

// pulls a local page's own css, js and images out of the filesystem and inlines
// them, since relative urls in a srcdoc frame would point at the real server
function assembleFsPage(path, content) {
  let doc;
  try { doc = new DOMParser().parseFromString(content, 'text/html'); }
  catch (e) { return content + FILE_HOOK; }

  const local = (value) => {
    if (!value || /^(https?:|data:|blob:|#|javascript:|mailto:)/i.test(value)) return null;
    const p = resolveFsPath(path, value);
    return FS.exists(p) ? p : null;
  };

  doc.querySelectorAll('link[rel~="stylesheet"][href]').forEach(link => {
    const p = local(link.getAttribute('href'));
    if (!p) return;
    const style = doc.createElement('style');
    style.textContent = FS.readFile(p) || '';
    link.replaceWith(style);
  });

  doc.querySelectorAll('script[src]').forEach(s => {
    const p = local(s.getAttribute('src'));
    if (!p) return;
    const ns = doc.createElement('script');
    [...s.attributes].forEach(a => { if (a.name !== 'src') ns.setAttribute(a.name, a.value); });
    ns.textContent = FS.readFile(p) || '';
    s.replaceWith(ns);
  });

  doc.querySelectorAll('img[src], source[src], audio[src], video[src]').forEach(el => {
    const p = local(el.getAttribute('src'));
    if (!p) return;
    const data = FS.readFile(p) || '';
    if (data.startsWith('data:')) el.setAttribute('src', data);
  });

  // a <base> or leftover meta refresh would send everything back to the server
  doc.querySelectorAll('base').forEach(b => b.remove());
  doc.querySelectorAll('meta[http-equiv]').forEach(m => {
    if (/refresh/i.test(m.getAttribute('http-equiv') || '')) m.remove();
  });

  // the hook must run before the page's own scripts, so it goes first in head
  const head = doc.head || doc.documentElement;
  head.insertAdjacentHTML('afterbegin', FILE_HOOK);

  return '<!doctype html>' + doc.documentElement.outerHTML;
}

// the proxy only exists on the deployed site, not under live server.
// a yes is remembered, a no is retried later so one hiccup does not kill it
let proxyReady = null;
let proxyCheckedAt = 0;

function checkProxy() {
  if (typeof fetch !== 'function') return Promise.resolve(false);
  if (proxyReady === true) return Promise.resolve(true);
  if (proxyReady === false && Date.now() - proxyCheckedAt < 15000) {
    return Promise.resolve(false);
  }

  return fetch(PROXY.replace('?url=', '?ping=1'))
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      proxyReady = !!(d && d.ok);
      proxyCheckedAt = Date.now();
      return proxyReady;
    })
    .catch(() => {
      proxyReady = false;
      proxyCheckedAt = Date.now();
      return false;
    });
}
const EXTERNAL_SEARCH = 'https://duckduckgo.com/?q=';

const SEARCH_API = '/api/search?q=';
const WIKI_LANG = (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';

// web is the real search, images and wikipedia are separate modes you can pick
const MODES = ['web', 'images', 'wikipedia'];
let mode = localStorage.getItem('browserMode');
if (!MODES.includes(mode)) mode = 'web';


// public invidious mirrors expose a cors friendly search api. they come and go,
// so several are tried in order
const INVIDIOUS = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yewtu.be',
  'https://invidious.f5.si',
];


// these are known to refuse embedding, so we can say so straight away instead
// of showing an empty frame
const BLOCKS = [
  'google.', 'youtube.com', 'youtu.be', 'duckduckgo.com', 'bing.com',
  'ecosia.org', 'startpage.com', 'wikipedia.org', 'github.com', 'reddit.com',
  'x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'tiktok.com',
  'amazon.', 'ebay.', 'netflix.com', 'spotify.com', 'discord.com',
  'stackoverflow.com', 'linkedin.com', 'twitch.tv', 'pinterest.',
];

const QUICK = [
  ['yt: lofi', VIDEOS + encodeURIComponent('lofi hip hop')],
  ['yt: minecraft', VIDEOS + encodeURIComponent('minecraft')],
  ['example.com', 'https://example.com'],
  ['hack club', 'https://hackclub.com'],
  ['vercel', 'https://vercel.com'],
];

const tabsEl = document.getElementById('tabs');
const viewsEl = document.getElementById('views');
const urlEl = document.getElementById('url');

let tabs = [];
let activeId = null;
let seq = 0;

const active = () => tabs.find(t => t.id === activeId);

function isBlocked(url) {
  const low = url.toLowerCase();
  return BLOCKS.some(b => low.includes(b));
}

function toUrl(input) {
  const raw = input.trim();
  if (!raw) return null;
  if (raw === HOME) return HOME;

  // looks like a domain or url, otherwise treat it as a search
  if (/^[a-z]+:\/\//i.test(raw)) return raw;
  if (raw.startsWith(FILE)) return raw;
  if (FS && /\.(html?|svg)$/i.test(raw) && FS.exists(raw)) return FILE + raw;
  if (/^yt\s+/i.test(raw)) return VIDEOS + encodeURIComponent(raw.replace(/^yt\s+/i, ''));
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(raw)) return 'https://' + raw;
  if (mode === 'images') return IMAGES + encodeURIComponent(raw);
  return RESULTS + encodeURIComponent(raw) + (mode === 'wikipedia' ? '&wiki=1' : '');
}

// youtube blocks /watch but the embed player is made for framing
function youtubeId(url) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function labelFor(url) {
  if (url === HOME) return 'new tab';
  if (url.startsWith(RESULTS)) return decodeURIComponent(url.slice(RESULTS.length)).slice(0, 18);
  if (url.startsWith(IMAGES)) return 'img: ' + decodeURIComponent(url.slice(IMAGES.length)).slice(0, 13);
  if (url.startsWith(VIDEOS)) return 'yt: ' + decodeURIComponent(url.slice(VIDEOS.length)).slice(0, 14);
  if (url.startsWith(FILE)) return url.slice(FILE.length).split('/').pop();
  if (youtubeId(url)) return 'video';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (e) {
    return url.slice(0, 22);
  }
}

function newTab(url) {
  const id = 'tab' + (++seq);

  const view = document.createElement('div');
  view.className = 'br-view';
  view.dataset.id = id;
  viewsEl.appendChild(view);

  const tab = { id, view, history: [], index: -1 };
  tabs.push(tab);
  activeId = id;

  go(url || HOME);
  renderTabs();
  return tab;
}

function closeTab(id) {
  const i = tabs.findIndex(t => t.id === id);
  if (i < 0) return;

  tabs[i].view.remove();
  tabs.splice(i, 1);

  if (!tabs.length) {
    newTab(HOME);
    return;
  }

  if (activeId === id) activeId = tabs[Math.max(0, i - 1)].id;
  renderTabs();
  paint();
}

function selectTab(id) {
  activeId = id;
  renderTabs();
  paint();
}

function renderTabs() {
  [...tabsEl.querySelectorAll('.br-tab')].forEach(el => el.remove());

  tabs.forEach(t => {
    const el = document.createElement('button');
    el.className = 'br-tab' + (t.id === activeId ? ' active' : '');

    const title = document.createElement('span');
    title.className = 'br-tab-title';
    title.textContent = labelFor(t.history[t.index] || HOME);

    const close = document.createElement('span');
    close.className = 'br-tab-close';
    close.textContent = '\u00d7';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(t.id);
    });

    el.appendChild(title);
    el.appendChild(close);
    el.addEventListener('click', () => selectTab(t.id));
    tabsEl.insertBefore(el, document.getElementById('new-tab'));
  });
}

function go(url, addToHistory = true) {
  const tab = active();
  if (!tab) return;

  if (addToHistory) {
    tab.history = tab.history.slice(0, tab.index + 1);
    tab.history.push(url);
    tab.index = tab.history.length - 1;
  }

  render(tab, url);
  renderTabs();
  paint();
}

function render(tab, url) {
  tab.view.innerHTML = '';

  if (url === HOME) {
    tab.view.appendChild(buildHome());
    return;
  }

  if (url.startsWith(RESULTS)) {
    tab.view.appendChild(buildResults(decodeURIComponent(url.slice(RESULTS.length))));
    return;
  }

  if (url.startsWith(IMAGES)) {
    tab.view.appendChild(buildImages(decodeURIComponent(url.slice(IMAGES.length))));
    return;
  }

  if (url.startsWith(VIDEOS)) {
    tab.view.appendChild(buildVideos(decodeURIComponent(url.slice(VIDEOS.length))));
    return;
  }

  if (url.startsWith(FILE)) {
    const requested = url.slice(FILE.length);
    const finalPath = fsRedirectTarget(requested);
    // rewrite the history entry so the url bar and back button track the real page
    if (finalPath !== requested && tab.history[tab.index] === url) {
      tab.history[tab.index] = FILE + finalPath;
    }
    tab.view.appendChild(fileFrame(finalPath));
    return;
  }

  const vid = youtubeId(url);
  if (vid) {
    const frame = document.createElement('iframe');
    frame.setAttribute('src', 'https://www.youtube-nocookie.com/embed/' + vid);
    frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen');
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    tab.view.appendChild(frame);
    return;
  }

  // everything goes through the proxy, otherwise any site that refuses framing
  // would silently show nothing
  const holder = document.createElement('div');
  holder.className = 'br-holder';
  holder.innerHTML = '<div class="br-results-note">loading...</div>';
  tab.view.appendChild(holder);

  checkProxy().then(ok => {
    holder.innerHTML = '';

    if (ok) {
      holder.appendChild(proxyFrame(url));
      return;
    }

    if (isBlocked(url)) {
      holder.appendChild(buildBlocked(url));
      return;
    }

    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-same-origin allow-modals');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.setAttribute('src', url);
    holder.appendChild(frame);
  });
}

function localPages() {
  if (!FS) return [];
  const out = [];
  (function walk(path) {
    FS.list(path).forEach(item => {
      const full = path ? path + '/' + item.name : item.name;
      if (item.type === 'folder') walk(full);
      else if (/\.html?$/i.test(item.name)) out.push(full);
    });
  })('');
  return out.slice(0, 10);
}

function buildHome() {
  const home = document.createElement('div');
  home.className = 'br-home';

  const title = document.createElement('div');
  title.className = 'br-home-title';
  title.textContent = 'search the web';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'br-home-search';
  input.placeholder = 'type and press enter';
  input.spellcheck = false;
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const url = toUrl(input.value);
    if (url) go(url);
  });

  const local = localPages();
  if (local.length) {
    const label = document.createElement('div');
    label.className = 'br-home-hint';
    label.textContent = 'pages in your filesystem';
    home.appendChild(label);

    const own = document.createElement('div');
    own.className = 'br-links';
    local.forEach(path => {
      const b = document.createElement('button');
      b.className = 'br-link own';
      b.textContent = path;
      b.addEventListener('click', () => go(FILE + path));
      own.appendChild(b);
    });
    home.appendChild(own);
  }

  const links = document.createElement('div');
  links.className = 'br-links';
  const hint = document.createElement('div');
  hint.className = 'br-home-hint';
  hint.textContent = 'type "yt cats" to find videos, or paste a youtube link';
  home.appendChild(hint);

  QUICK.forEach(([name, url]) => {
    const b = document.createElement('button');
    b.className = 'br-link';
    b.textContent = name;
    b.addEventListener('click', () => go(url));
    links.appendChild(b);
  });

  home.appendChild(title);
  home.appendChild(input);
  home.appendChild(links);
  setTimeout(() => input.focus(), 30);
  return home;
}

async function fetchWiki(query) {
  const api = `https://${WIKI_LANG}.wikipedia.org/w/api.php`
    + '?action=query&generator=search&gsrlimit=12'
    + '&gsrsearch=' + encodeURIComponent(query)
    + '&prop=extracts|info&exintro=1&explaintext=1&exsentences=2&inprop=url'
    + '&format=json&origin=*';

  const res = await fetch(api);
  if (!res.ok) return { engine: null, items: [], note: 'wikipedia answered ' + res.status };

  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return { engine: 'wikipedia', items: [], note: 'nothing found' };

  return {
    engine: 'wikipedia',
    items: Object.values(pages)
      .sort((a, b) => (a.index || 0) - (b.index || 0))
      .map(p => ({
        title: p.title,
        url: p.fullurl || `https://${WIKI_LANG}.wikipedia.org/wiki/${encodeURIComponent(p.title)}`,
        text: (p.extract || '').trim(),
      })),
  };
}

function buildResults(rawQuery) {
  const useWiki = rawQuery.endsWith('&wiki=1');
  const query = useWiki ? rawQuery.slice(0, -7) : rawQuery;

  const box = document.createElement('div');
  box.className = 'br-results';

  const head = document.createElement('div');
  head.className = 'br-results-head';
  head.textContent = 'results for "' + query + '"';

  const list = document.createElement('div');
  list.className = 'br-results-list';
  list.innerHTML = '<div class="br-results-note">searching...</div>';

  const foot = document.createElement('button');
  foot.className = 'br-results-more';
  foot.textContent = 'search the whole web in a real tab \u2197';
  foot.addEventListener('click', () =>
    window.open(EXTERNAL_SEARCH + encodeURIComponent(query), '_blank', 'noopener'));

  box.appendChild(head);
  box.appendChild(list);
  box.appendChild(foot);

  fetchResults(query, useWiki)
    .then(data => {
      if (data.engine) head.textContent = `results for "${query}"  \u00b7  ${data.engine}`;
      if (data.note) {
        const why = document.createElement('div');
        why.className = 'br-results-why';
        why.textContent = 'web search skipped: ' + data.note;
        box.insertBefore(why, list);
      }
      renderResults(list, data.items, query);
    })
    .catch(() => {
      list.innerHTML = '';
      const note = document.createElement('div');
      note.className = 'br-results-note';
      note.textContent = 'could not reach the search api. use the button below.';
      list.appendChild(note);
    });

  return box;
}

async function fetchResults(query, useWiki) {
  if (typeof fetch !== 'function') {
    return { engine: null, items: [], note: 'this browser has no fetch' };
  }

  if (useWiki) return fetchWiki(query);

  const res = await fetch(SEARCH_API + encodeURIComponent(query) + '&lang=' + WIKI_LANG);

  if (!res.ok) {
    return {
      engine: null,
      items: [],
      note: res.status === 404
        ? 'api/search.js is not deployed'
        : 'the search endpoint answered ' + res.status,
    };
  }

  const data = await res.json();

  return {
    engine: data.engine,
    items: data.results || [],
    note: (data.results && data.results.length) ? null
      : 'no source had an answer'
        + (data.tried ? ': ' + data.tried.map(t => t.source + ' ' + (t.note || t.found)).join(', ') : ''),
  };
}

function renderResults(list, items, query) {
  list.innerHTML = '';

  if (!items.length) {
    const note = document.createElement('div');
    note.className = 'br-results-note';
    note.textContent = 'nothing found for that. try the whole web below.';
    list.appendChild(note);
    return;
  }

  items.forEach(item => {
    const row = document.createElement('button');
    row.className = 'br-result';

    const title = document.createElement('span');
    title.className = 'br-result-title';
    title.textContent = item.title;

    const link = document.createElement('span');
    link.className = 'br-result-url';
    link.textContent = labelFor(item.url) + item.url.replace(/^https?:\/\/[^/]+/, '');

    const text = document.createElement('span');
    text.className = 'br-result-text';
    text.textContent = item.text;

    row.appendChild(link);
    row.appendChild(title);
    if (item.text) row.appendChild(text);

    // a page several engines agree on is worth marking
    if (item.sources && item.sources.length) {
      const tag = document.createElement('span');
      tag.className = 'br-result-src' + (item.sources.length > 1 ? ' agreed' : '');
      tag.textContent = item.sources.join(' + ');
      row.appendChild(tag);
    }
    row.addEventListener('click', () => go(item.url));
    list.appendChild(row);
  });
}

// ---------- image search ----------

// openverse is a key free, cors friendly index of openly licensed images, so
// it works straight from the browser with no server in the way
const IMAGE_API = 'https://api.openverse.org/v1/images/?mature=false&page_size=40&q=';

function safeName(title, url) {
  let base = (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  if (!base) {
    try { base = new URL(url).pathname.split('/').pop().replace(/\.[^.]+$/, '') || 'image'; }
    catch (e) { base = 'image'; }
  }
  let ext = 'jpg';
  const m = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.exec(url || '');
  if (m) ext = m[1].toLowerCase();
  return base + '.' + ext;
}

function buildImages(query) {
  const box = document.createElement('div');
  box.className = 'br-results';

  const head = document.createElement('div');
  head.className = 'br-results-head';
  head.textContent = 'images for "' + query + '"';

  const grid = document.createElement('div');
  grid.className = 'br-img-grid';
  grid.innerHTML = '<div class="br-results-note">looking for images...</div>';

  box.appendChild(head);
  box.appendChild(grid);

  fetchImages(query)
    .then(data => {
      if (data.note) head.textContent = `images for "${query}"  \u00b7  openverse`;
      renderImages(grid, data.items);
    })
    .catch(() => {
      grid.innerHTML = '';
      const note = document.createElement('div');
      note.className = 'br-results-note';
      note.textContent = 'could not reach the image search.';
      grid.appendChild(note);
    });

  return box;
}

async function fetchImages(query) {
  if (typeof fetch !== 'function') return { items: [], note: 'this browser has no fetch' };

  const res = await fetch(IMAGE_API + encodeURIComponent(query));
  if (!res.ok) return { items: [], note: 'image search answered ' + res.status };

  const data = await res.json();
  const items = (data.results || []).map(r => ({
    thumb: r.thumbnail || r.url,
    full: r.url,
    title: r.title || 'image',
    source: r.foreign_landing_url || r.url,
    creator: r.creator || '',
    license: (r.license || '').toUpperCase(),
    filename: safeName(r.title, r.url),
  }));

  return { items, note: items.length ? null : 'nothing found' };
}

function renderImages(grid, items) {
  grid.innerHTML = '';

  if (!items.length) {
    const note = document.createElement('div');
    note.className = 'br-results-note';
    note.textContent = 'no images found for that [-_-]';
    grid.appendChild(note);
    return;
  }

  items.forEach(image => {
    const cell = document.createElement('button');
    cell.className = 'br-img-cell';

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = image.thumb;
    img.alt = image.title;
    img.addEventListener('error', () => cell.remove());

    cell.appendChild(img);
    cell.addEventListener('click', () => openLightbox(image));
    grid.appendChild(cell);
  });
}

// ---------- image lightbox ----------

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

// tries the image straight from its host, then through the proxy which adds the
// cors header the host may be missing
async function imageToBlob(src) {
  if (!src) return null;
  try {
    const r = await fetch(src, { mode: 'cors' });
    if (r.ok) return await r.blob();
  } catch (e) { /* host has no cors, fall through */ }

  try {
    const r = await fetch(PROXY + encodeURIComponent(src));
    if (r.ok) {
      const blob = await r.blob();
      if (blob.type.startsWith('image/')) return blob;
    }
  } catch (e) { /* proxy not deployed */ }

  return null;
}

async function fetchImageBlob(image) {
  return (await imageToBlob(image.full)) || (await imageToBlob(image.thumb));
}

function openLightbox(image) {
  const root = document.querySelector('.br');

  const back = document.createElement('div');
  back.className = 'br-lightbox';

  const inner = document.createElement('div');
  inner.className = 'br-lightbox-inner';

  const big = document.createElement('img');
  big.className = 'br-lightbox-img';
  big.src = image.full;
  big.alt = image.title;
  // if the full image refuses to load, fall back to the thumbnail
  big.addEventListener('error', () => { big.src = image.thumb; }, { once: true });

  const bar = document.createElement('div');
  bar.className = 'br-lightbox-bar';

  const caption = document.createElement('div');
  caption.className = 'br-lightbox-caption';
  caption.textContent = [image.title, image.creator && 'by ' + image.creator, image.license]
    .filter(Boolean).join('  \u00b7  ');

  const actions = document.createElement('div');
  actions.className = 'br-lightbox-actions';

  const dl = document.createElement('button');
  dl.className = 'br-lightbox-btn';
  dl.textContent = 'Download';
  dl.addEventListener('click', () => downloadImage(image, dl));

  const wall = document.createElement('button');
  wall.className = 'br-lightbox-btn';
  wall.textContent = 'Set as wallpaper';
  wall.addEventListener('click', () => setAsWallpaper(image, wall));

  const src = document.createElement('button');
  src.className = 'br-lightbox-btn';
  src.textContent = 'Open source \u2197';
  src.addEventListener('click', () => window.open(image.source, '_blank', 'noopener'));

  const close = document.createElement('button');
  close.className = 'br-lightbox-close';
  close.textContent = '\u00d7';
  close.addEventListener('click', () => back.remove());

  actions.appendChild(dl);
  actions.appendChild(wall);
  actions.appendChild(src);
  bar.appendChild(caption);
  bar.appendChild(actions);
  inner.appendChild(close);
  inner.appendChild(big);
  inner.appendChild(bar);
  back.appendChild(inner);

  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
  document.addEventListener('keydown', function esc(ev) {
    if (ev.key !== 'Escape') return;
    back.remove();
    document.removeEventListener('keydown', esc);
  });

  root.appendChild(back);
}

async function downloadImage(image, btn) {
  const old = btn.textContent;
  btn.textContent = 'getting it...';

  const blob = await fetchImageBlob(image);
  if (!blob) {
    // last resort: hand it to a real browser tab where the user can save it
    window.open(image.full, '_blank', 'noopener');
    btn.textContent = old;
    return;
  }

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = image.filename;
  a.click();
  URL.revokeObjectURL(a.href);
  btn.textContent = 'Downloaded';
  setTimeout(() => { btn.textContent = old; }, 1400);
}

async function setAsWallpaper(image, btn) {
  const old = btn.textContent;
  btn.textContent = 'setting...';

  const blob = await fetchImageBlob(image);
  if (!blob) {
    btn.textContent = 'could not fetch';
    setTimeout(() => { btn.textContent = old; }, 1600);
    return;
  }

  const dataUrl = await blobToDataURL(blob);
  const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace('+xml', '');
  const name = image.filename.replace(/\.[^.]+$/, '') + '.' + ext;

  // saving it into the filesystem means it also shows up in the wallpaper
  // picker in settings, next to the built in ones
  if (FS) {
    if (!FS.exists('Pictures')) FS.createFolder('', 'Pictures');
    FS.writeFile('Pictures', name, dataUrl);
    window.parent.postMessage({ type: 'setWallpaper', file: 'Pictures/' + name }, '*');
  } else {
    window.parent.postMessage({ type: 'setWallpaper', file: dataUrl }, '*');
  }

  btn.textContent = 'Wallpaper set';
  setTimeout(() => { btn.textContent = old; }, 1600);
}

// no allow-same-origin on purpose: the proxied page comes from our own origin,
// so without it a hostile page could reach into the os
// runs the page straight from the virtual filesystem. no allow-same-origin, so
// a page you wrote cannot reach into the os itself
function fileFrame(path) {
  const holder = document.createElement('div');
  holder.className = 'br-holder';

  const content = FS ? FS.readFile(path) : null;

  if (content === null || content === undefined) {
    holder.innerHTML = '<div class="br-results-note">' + path + ' is not in the filesystem</div>';
    return holder;
  }

  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups');
  frame.setAttribute('srcdoc', assembleFsPage(path, content));
  holder.appendChild(frame);
  return holder;
}

function proxyFrame(url) {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-modals');
  frame.setAttribute('src', PROXY + encodeURIComponent(url));
  return frame;
}

window.addEventListener('message', (e) => {
  if (e.data?.type === 'proxyNav' && e.data.url) {
    go(e.data.url);
    return;
  }

  // the files app or the code editor asked us to run a local page
  if (e.data?.type === 'openPage' && e.data.path) {
    if (!active()) newTab(HOME);
    go(FILE + e.data.path);
    return;
  }

  if (e.data?.type === 'fileNav' && e.data.href) {
    const tab = active();
    const here = tab && tab.history[tab.index];
    if (!here || !here.startsWith(FILE)) return;
    go(resolveFile(here.slice(FILE.length), e.data.href));
  }
});

function buildVideos(query) {
  const box = document.createElement('div');
  box.className = 'br-results';

  const head = document.createElement('div');
  head.className = 'br-results-head';
  head.textContent = 'videos for "' + query + '"';

  const list = document.createElement('div');
  list.className = 'br-results-list';
  list.innerHTML = '<div class="br-results-note">looking for videos...</div>';

  const foot = document.createElement('button');
  foot.className = 'br-results-more';
  foot.textContent = 'search on youtube in a real tab \u2197';
  foot.addEventListener('click', () => window.open(
    'https://www.youtube.com/results?search_query=' + encodeURIComponent(query), '_blank', 'noopener'));

  box.appendChild(head);
  box.appendChild(list);
  box.appendChild(foot);

  fetchVideos(query)
    .then(items => renderVideos(list, items))
    .catch(() => {
      list.innerHTML = '';
      const note = document.createElement('div');
      note.className = 'br-results-note';
      note.textContent = 'no mirror answered. paste a youtube link instead, that always plays.';
      list.appendChild(note);
    });

  return box;
}

async function fetchVideos(query) {
  for (const host of INVIDIOUS) {
    try {
      const res = await fetch(`${host}/api/v1/search?type=video&q=` + encodeURIComponent(query));
      if (!res.ok) continue;

      const data = await res.json();
      if (!Array.isArray(data) || !data.length) continue;

      return data.filter(v => v.videoId).slice(0, 12).map(v => ({
        id: v.videoId,
        title: v.title || v.videoId,
        author: v.author || '',
        seconds: v.lengthSeconds || 0,
      }));
    } catch (e) {
      // try the next mirror
    }
  }
  throw new Error('no mirror');
}

function clock(sec) {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function renderVideos(list, items) {
  list.innerHTML = '';

  items.forEach(v => {
    const row = document.createElement('button');
    row.className = 'br-video';

    const thumb = document.createElement('img');
    thumb.className = 'br-video-thumb';
    thumb.src = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
    thumb.alt = '';
    thumb.addEventListener('error', () => { thumb.style.visibility = 'hidden'; });

    const text = document.createElement('span');
    text.className = 'br-video-text';

    const title = document.createElement('span');
    title.className = 'br-video-title';
    title.textContent = v.title;

    const meta = document.createElement('span');
    meta.className = 'br-video-meta';
    meta.textContent = [v.author, clock(v.seconds)].filter(Boolean).join('  \u00b7  ');

    text.appendChild(title);
    text.appendChild(meta);
    row.appendChild(thumb);
    row.appendChild(text);
    row.addEventListener('click', () => go('https://www.youtube.com/watch?v=' + v.id));
    list.appendChild(row);
  });
}

function buildBlocked(url) {
  const box = document.createElement('div');
  box.className = 'br-blocked';

  const face = document.createElement('div');
  face.className = 'br-blocked-face';
  face.textContent = '[-_-]';

  const host = document.createElement('div');
  host.className = 'br-blocked-host';
  host.textContent = labelFor(url);

  const text = document.createElement('div');
  text.className = 'br-blocked-text';
  text.textContent = 'this site does not allow being shown inside another page. '
    + 'that is the site\u2019s own rule against clickjacking, nothing here can change it.';

  const btn = document.createElement('button');
  btn.className = 'br-blocked-btn';
  btn.textContent = 'open in a real tab \u2197';
  btn.addEventListener('click', () => window.open(url, '_blank', 'noopener'));

  if (proxyReady === false) {
    text.textContent = 'the proxy only runs on the deployed site, not under live server. '
      + 'without it this page cannot be shown here.';
  }

  box.appendChild(face);
  box.appendChild(host);
  box.appendChild(text);
  box.appendChild(btn);
  return box;
}

function paint() {
  const tab = active();

  tabs.forEach(t => t.view.classList.toggle('active', t.id === activeId));

  if (!tab) return;
  const url = tab.history[tab.index] || HOME;
  urlEl.value = url === HOME ? '' : url;

  document.getElementById('back').disabled = tab.index <= 0;
  document.getElementById('forward').disabled = tab.index >= tab.history.length - 1;
  document.getElementById('external').disabled = url === HOME;
}

const modeBtn = document.getElementById('mode');

function paintMode() {
  modeBtn.textContent = mode;
}

modeBtn.addEventListener('click', () => {
  mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  localStorage.setItem('browserMode', mode);
  paintMode();
});

paintMode();

document.getElementById('new-tab').addEventListener('click', () => newTab(HOME));

document.getElementById('back').addEventListener('click', () => {
  const tab = active();
  if (!tab || tab.index <= 0) return;
  tab.index--;
  render(tab, tab.history[tab.index]);
  renderTabs();
  paint();
});

document.getElementById('forward').addEventListener('click', () => {
  const tab = active();
  if (!tab || tab.index >= tab.history.length - 1) return;
  tab.index++;
  render(tab, tab.history[tab.index]);
  renderTabs();
  paint();
});

document.getElementById('reload').addEventListener('click', () => {
  const tab = active();
  if (tab) render(tab, tab.history[tab.index] || HOME);
});

document.getElementById('external').addEventListener('click', () => {
  const tab = active();
  const url = tab && tab.history[tab.index];
  if (!url || url === HOME) return;

  const target = url.startsWith(RESULTS)
    ? EXTERNAL_SEARCH + encodeURIComponent(decodeURIComponent(url.slice(RESULTS.length)))
    : url.startsWith(IMAGES)
      ? 'https://duckduckgo.com/?iax=images&ia=images&q=' + encodeURIComponent(decodeURIComponent(url.slice(IMAGES.length)))
      : url;

  window.open(target, '_blank', 'noopener');
});

urlEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const url = toUrl(urlEl.value);
  if (url) go(url);
});

// a page or url handed over from another app opens right away
const pendingUrl = FS && FS.consumePendingUrl ? FS.consumePendingUrl() : null;
const pendingPage = FS && FS.consumePendingPage ? FS.consumePendingPage() : null;
newTab(pendingUrl ? pendingUrl : (pendingPage ? FILE + pendingPage : HOME));