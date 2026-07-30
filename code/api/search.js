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
    if (!res.ok) return null;
    return res;
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

// mojeek runs its own index and does not fight off servers the way the big
// engines do, so it is the first choice
async function mojeek(query) {
  const res = await grab('https://www.mojeek.com/search?q=' + encodeURIComponent(query));
  if (!res) return [];

  const html = await res.text();
  const out = [];
  const blocks = html.split(/<li[^>]*>/i).slice(1);

  for (const block of blocks) {
    const link = block.match(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;

    const title = strip(link[2]);
    if (!title || title.length < 2) continue;

    const desc = block.match(/<p[^>]*class="[^"]*s[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    out.push({ title, url: link[1], text: desc ? strip(desc[1]).slice(0, 240) : '' });

    if (out.length >= 12) break;
  }
  return out;
}

// public searxng mirrors, some of them answer with json
async function searx(query) {
  const hosts = ['https://searx.be', 'https://search.bus-hit.me', 'https://priv.au'];

  for (const host of hosts) {
    const res = await grab(`${host}/search?format=json&q=` + encodeURIComponent(query));
    if (!res) continue;

    try {
      const data = await res.json();
      const items = (data.results || []).slice(0, 12).map(r => ({
        title: r.title || r.url,
        url: r.url,
        text: (r.content || '').slice(0, 240),
      }));
      if (items.length) return items;
    } catch (e) {
      // not json, try the next mirror
    }
  }
  return [];
}

// last resort: always answers, but only knows encyclopedia articles
async function wiki(query, lang) {
  const api = `https://${lang}.wikipedia.org/w/api.php`
    + '?action=query&generator=search&gsrlimit=10'
    + '&gsrsearch=' + encodeURIComponent(query)
    + '&prop=extracts|info&exintro=1&explaintext=1&exsentences=2&inprop=url&format=json';

  const res = await grab(api);
  if (!res) return [];

  try {
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return [];

    return Object.values(pages)
      .sort((a, b) => (a.index || 0) - (b.index || 0))
      .map(p => ({
        title: p.title,
        url: p.fullurl || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title)}`,
        text: (p.extract || '').trim().slice(0, 240),
      }));
  } catch (e) {
    return [];
  }
}

export default async function handler(req, res) {
  const query = (req.query.q || '').trim();
  const lang = /^de/i.test(req.query.lang || '') ? 'de' : 'en';

  res.setHeader('access-control-allow-origin', '*');

  if (!query) {
    res.status(400).json({ error: 'no query' });
    return;
  }

  const sources = [
    ['mojeek', () => mojeek(query)],
    ['searx', () => searx(query)],
    ['wikipedia', () => wiki(query, lang)],
  ];

  for (const [name, run] of sources) {
    try {
      const results = await run();
      if (results.length) {
        res.status(200).json({ engine: name, results });
        return;
      }
    } catch (e) {
      // try the next source
    }
  }

  res.status(200).json({ engine: null, results: [] });
}