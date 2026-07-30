// searches on the server and hands back plain results. going through the
// search pages themselves does not work: they show a captcha to anything
// coming from a datacenter, and vercel is a datacenter

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const HEADERS = {
  'user-agent': UA,
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'de,en;q=0.8',
};

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  auml: 'a\u0308', ouml: 'o\u0308', uuml: 'u\u0308',
  Auml: 'A\u0308', Ouml: 'O\u0308', Uuml: 'U\u0308', szlig: '\u00df',
  eacute: '\u00e9', egrave: '\u00e8', agrave: '\u00e0', ccedil: '\u00e7',
  ndash: '\u2013', mdash: '\u2014', hellip: '\u2026', middot: '\u00b7',
  laquo: '\u00ab', raquo: '\u00bb', ldquo: '\u201c', rdquo: '\u201d',
  lsquo: '\u2018', rsquo: '\u2019', euro: '\u20ac', deg: '\u00b0',
  times: '\u00d7', copy: '\u00a9', reg: '\u00ae', trade: '\u2122',
};

function decode(text) {
  return String(text || '')
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (m, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&([a-z]+);/gi, (m, name) =>
      ENTITIES[name] !== undefined ? ENTITIES[name] : m)
    .normalize('NFC');
}

function strip(html) {
  return decode(String(html || '').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

async function grab(url, extra = {}) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 7000);
  try {
    const res = await fetch(url, { headers: { ...HEADERS, ...extra }, signal: stop.signal });
    clearTimeout(timer);
    if (!res.ok) return { error: 'http ' + res.status };
    return { res };
  } catch (e) {
    clearTimeout(timer);
    return { error: e && e.name === 'AbortError' ? 'timeout' : String(e && e.message || e) };
  }
}


// mojeek has its own index and is far less hostile to servers than the big ones
async function mojeek(query) {
  const got = await grab('https://www.mojeek.com/search?q=' + encodeURIComponent(query));
  if (got.error) return { error: got.error, items: [] };

  const html = await got.res.text();

  // only look inside the results list, otherwise the menu links become hits
  const listStart = html.search(/<ul[^>]+class="[^"]*results[^"]*"/i);
  const area = listStart >= 0 ? html.slice(listStart) : html;

  const items = [];
  for (const block of area.split(/<li[^>]*>/i).slice(1)) {
    const link = block.match(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    if (/mojeek\.com/i.test(link[1])) continue;

    const title = strip(link[2]);
    if (title.length < 3) continue;

    const desc = block.match(/<p[^>]*class="[^"]*s[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    items.push({ title, url: link[1], text: desc ? strip(desc[1]).slice(0, 240) : '' });
    if (items.length >= 12) break;
  }

  return { items, error: items.length ? null : 'no results parsed' };
}

// searxng mirrors, tried as json first and then as plain html
async function searxng(query) {
  const hosts = [
    'https://searx.be', 'https://priv.au', 'https://search.inetol.net',
    'https://searxng.site', 'https://opnxng.com',
  ];
  const notes = [];

  for (const host of hosts) {
    const json = await grab(`${host}/search?format=json&q=` + encodeURIComponent(query));
    if (json.res) {
      try {
        const data = await json.res.json();
        const items = (data.results || []).slice(0, 12).map(r => ({
          title: r.title || r.url,
          url: r.url,
          text: (r.content || '').slice(0, 240),
        }));
        if (items.length) return { items, host };
      } catch (e) {
        notes.push(host + ': not json');
      }
    } else {
      notes.push(host + ': ' + json.error);
    }

    const page = await grab(`${host}/search?q=` + encodeURIComponent(query));
    if (!page.res) continue;

    const html = await page.res.text();
    const items = [];
    for (const block of html.split(/<article[^>]*>/i).slice(1)) {
      const link = block.match(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!link) continue;
      const title = strip(link[2]);
      if (title.length < 3) continue;
      const desc = block.match(/<p[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
      items.push({ title, url: link[1], text: desc ? strip(desc[1]).slice(0, 240) : '' });
      if (items.length >= 12) break;
    }
    if (items.length) return { items, host };
  }

  return { items: [], error: notes.slice(0, 3).join(' | ') || 'no mirror answered' };
}

// official api, answers servers without a captcha, but only knows topics it has
// a direct answer for
async function ddgAnswers(query) {
  const got = await grab('https://api.duckduckgo.com/?no_html=1&no_redirect=1&format=json&q='
    + encodeURIComponent(query));
  if (got.error) return { error: got.error, items: [] };

  try {
    const data = await got.res.json();
    const items = [];

    if (data.AbstractURL && data.AbstractText) {
      items.push({ title: data.Heading || query, url: data.AbstractURL, text: data.AbstractText.slice(0, 240) });
    }

    (data.RelatedTopics || []).forEach(t => {
      const list = t.Topics || [t];
      list.forEach(x => {
        if (x.FirstURL && x.Text) {
          items.push({ title: x.Text.split(' - ')[0].slice(0, 90), url: x.FirstURL, text: x.Text.slice(0, 240) });
        }
      });
    });

    return { items: items.slice(0, 12), error: items.length ? null : 'no answer' };
  } catch (e) {
    return { error: 'bad json', items: [] };
  }
}


// always answers, but only knows encyclopedia articles
async function wiki(query, lang) {
  const api = `https://${lang}.wikipedia.org/w/api.php`
    + '?action=query&generator=search&gsrlimit=10'
    + '&gsrsearch=' + encodeURIComponent(query)
    + '&prop=extracts|info&exintro=1&explaintext=1&exsentences=2&inprop=url&format=json';

  const got = await grab(api);
  if (got.error) return { error: got.error, items: [] };

  try {
    const data = await got.res.json();
    const pages = data?.query?.pages;
    if (!pages) return { items: [], error: 'nothing found' };

    return {
      items: Object.values(pages)
        .sort((a, b) => (a.index || 0) - (b.index || 0))
        .map(p => ({
          title: p.title,
          url: p.fullurl || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title)}`,
          text: (p.extract || '').trim().slice(0, 240),
        })),
    };
  } catch (e) {
    return { error: 'bad json', items: [] };
  }
}

export default async function handler(req, res) {
  const query = (req.query.q || '').trim();
  const lang = /^de/i.test(req.query.lang || '') ? 'de' : 'en';

  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'public, max-age=300');

  if (!query) {
    res.status(400).json({ error: 'no query' });
    return;
  }

  const sources = [
    ['mojeek', () => mojeek(query)],
    ['searxng', () => searxng(query)],
    ['duckduckgo', () => ddgAnswers(query)],
    ['wikipedia', () => wiki(query, lang)],
  ];

  const tried = [];

  for (const [name, run] of sources) {
    try {
      const out = await run();
      tried.push({ source: name, found: out.items.length, note: out.error || null });

      if (out.items.length) {
        res.status(200).json({ engine: name, results: out.items, tried });
        return;
      }
    } catch (e) {
      tried.push({ source: name, found: 0, note: String(e && e.message || e) });
    }
  }

  res.status(200).json({ engine: null, results: [], tried });
}