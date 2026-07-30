document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';

window.addEventListener('message', (e) => {
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
  }
});

const HOME = 'about:home';
const RESULTS = 'about:results?';
const VIDEOS = 'about:videos?';
const PROXY = '/api/proxy?url=';

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

// search pages themselves show a captcha to a datacenter, so the server does
// the searching and only hands back the results
const ENGINES = {
  web: { label: 'web', url: q => RESULTS + encodeURIComponent(q) },
  wiki: { label: 'wikipedia', url: q => RESULTS + encodeURIComponent(q) + '&only=wiki' },
};

let engine = localStorage.getItem('browserEngine');
if (!ENGINES[engine]) engine = 'web';

// public invidious mirrors expose a cors friendly search api. they come and go,
// so several are tried in order
const INVIDIOUS = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yewtu.be',
  'https://invidious.f5.si',
];

// search engines refuse framing, so results come from an api and get drawn in
// the app. wikipedia allows cross origin requests officially
const WIKI_LANG = (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';

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
  if (/^yt\s+/i.test(raw)) return VIDEOS + encodeURIComponent(raw.replace(/^yt\s+/i, ''));
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(raw)) return 'https://' + raw;
  return ENGINES[engine].url(raw);
}

// youtube blocks /watch but the embed player is made for framing
function youtubeId(url) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function labelFor(url) {
  if (url === HOME) return 'new tab';
  if (url.startsWith(RESULTS)) return decodeURIComponent(url.slice(RESULTS.length)).slice(0, 18);
  if (url.startsWith(VIDEOS)) return 'yt: ' + decodeURIComponent(url.slice(VIDEOS.length)).slice(0, 14);
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

  if (url.startsWith(VIDEOS)) {
    tab.view.appendChild(buildVideos(decodeURIComponent(url.slice(VIDEOS.length))));
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

  const wiki = url.match(/^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/(.+)$/i);
  if (wiki) {
    tab.view.appendChild(buildReader(wiki[1], decodeURIComponent(wiki[2]), url));
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

function buildResults(rawQuery) {
  const onlyWiki = rawQuery.endsWith('&only=wiki');
  const query = onlyWiki ? rawQuery.slice(0, -10) : rawQuery;

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

  fetchResults(query, onlyWiki)
    .then(data => {
      if (data.engine) head.textContent = `results for "${query}"  \u00b7  ${data.engine}`;
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

async function fetchResults(query, onlyWiki) {
  // the server endpoint does a real web search when it is available
  if (!onlyWiki && typeof fetch === 'function') {
    try {
      const res = await fetch(SEARCH_API + encodeURIComponent(query) + '&lang=' + WIKI_LANG);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length) {
          return { engine: data.engine, items: data.results };
        }
      }
    } catch (e) {
      // fall through to wikipedia
    }
  }

  const api = `https://${WIKI_LANG}.wikipedia.org/w/api.php`
    + '?action=query&generator=search&gsrlimit=8'
    + '&gsrsearch=' + encodeURIComponent(query)
    + '&prop=extracts|info&exintro=1&explaintext=1&exsentences=2&inprop=url'
    + '&format=json&origin=*';

  const res = await fetch(api);
  if (!res.ok) throw new Error('http ' + res.status);

  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return { engine: 'wikipedia', items: [] };

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

    row.appendChild(title);
    row.appendChild(link);
    if (item.text) row.appendChild(text);
    row.addEventListener('click', () => go(item.url));
    list.appendChild(row);
  });
}

// no allow-same-origin on purpose: the proxied page comes from our own origin,
// so without it a hostile page could reach into the os
function proxyFrame(url) {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-modals');
  frame.setAttribute('src', PROXY + encodeURIComponent(url));
  return frame;
}

window.addEventListener('message', (e) => {
  if (e.data?.type !== 'proxyNav' || !e.data.url) return;
  go(e.data.url);
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

// wikipedia blocks framing, but the api gives us the text, so the article is
// rendered here instead of showing a dead end
function buildReader(lang, title, url) {
  const box = document.createElement('div');
  box.className = 'br-reader';

  const head = document.createElement('div');
  head.className = 'br-reader-head';
  head.textContent = title.replace(/_/g, ' ');

  const body = document.createElement('div');
  body.className = 'br-reader-body';
  body.innerHTML = '<div class="br-results-note">loading the article...</div>';

  const foot = document.createElement('button');
  foot.className = 'br-results-more';
  foot.textContent = 'open the real page \u2197';
  foot.addEventListener('click', () => window.open(url, '_blank', 'noopener'));

  box.appendChild(head);
  box.appendChild(body);
  box.appendChild(foot);

  const api = `https://${lang}.wikipedia.org/w/api.php`
    + '?action=query&prop=extracts&explaintext=1&redirects=1'
    + '&titles=' + encodeURIComponent(title)
    + '&format=json&origin=*';

  fetch(api)
    .then(r => r.json())
    .then(data => {
      const page = Object.values(data?.query?.pages || {})[0];
      const text = (page?.extract || '').trim();
      body.innerHTML = '';

      if (!text) {
        const note = document.createElement('div');
        note.className = 'br-results-note';
        note.textContent = 'no text for this article.';
        body.appendChild(note);
        return;
      }

      text.split(/\n{2,}/).forEach(part => {
        const trimmed = part.trim();
        if (!trimmed) return;

        // short lines without a period are section headings in the plain text
        const isHeading = trimmed.length < 60 && !/[.!?]$/.test(trimmed);
        const el = document.createElement(isHeading ? 'h3' : 'p');
        el.className = isHeading ? 'br-reader-h' : 'br-reader-p';
        el.textContent = trimmed.replace(/^=+\s*|\s*=+$/g, '');
        body.appendChild(el);
      });
    })
    .catch(() => {
      body.innerHTML = '';
      const note = document.createElement('div');
      note.className = 'br-results-note';
      note.textContent = 'could not load the article.';
      body.appendChild(note);
    });

  return box;
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

const engineBtn = document.getElementById('engine');

function paintEngine() {
  engineBtn.textContent = ENGINES[engine].label;
}

engineBtn.addEventListener('click', () => {
  const keys = Object.keys(ENGINES);
  engine = keys[(keys.indexOf(engine) + 1) % keys.length];
  localStorage.setItem('browserEngine', engine);
  paintEngine();
});

paintEngine();

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
    : url;

  window.open(target, '_blank', 'noopener');
});

urlEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const url = toUrl(urlEl.value);
  if (url) go(url);
});

newTab(HOME);