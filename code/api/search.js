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


// engines change their markup all the time, so instead of matching their exact
// classes this pulls out every outgoing link with a sensible title
function extractLinks(html, ownHosts) {
  const clean = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const skip = /\/(privacy|about|contact|settings|preferences|login|signup|impressum|datenschutz)/i;
  const out = [];
  const seen = new Set();

  const re = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]{0,400}?)<\/a>/gi;
  let m;

  while ((m = re.exec(clean)) !== null) {
    const url = m[1];
    const title = strip(m[2]);

    if (title.length < 8 || title.length > 130) continue;
    if (skip.test(url)) continue;

    let host;
    try {
      host = new URL(url).hostname.replace(/^www\./, '');
    } catch (e) {
      continue;
    }
    if (ownHosts.some(h => host.endsWith(h))) continue;

    const key = keyOf(url);
    if (seen.has(key)) continue;
    seen.add(key);

    // whatever text follows the link, up to the next link, is usually the snippet
    const after = clean.slice(m.index + m[0].length, m.index + m[0].length + 600);
    const cut = after.search(/<a[^>]+href="https?:/i);
    const text = strip(cut > 0 ? after.slice(0, cut) : after).slice(0, 240);

    out.push({ title, url, text });
    if (out.length >= 15) break;
  }

  return out;
}

// several small engines that tolerate requests from a server. the big ones all
// answer a datacenter with a captcha, so they are not worth trying
const ENGINES = [
  { name: 'mojeek',     url: q => 'https://www.mojeek.com/search?q=' + encodeURIComponent(q),        hosts: ['mojeek.com'] },
  { name: 'marginalia', url: q => 'https://search.marginalia.nu/search?query=' + encodeURIComponent(q), hosts: ['marginalia.nu'] },
  { name: 'stract',     url: q => 'https://stract.com/search?q=' + encodeURIComponent(q),            hosts: ['stract.com'] },
  { name: 'wiby',       url: q => 'https://wiby.me/?q=' + encodeURIComponent(q),                     hosts: ['wiby.me'] },
  { name: 'rightdao',   url: q => 'https://rightdao.com/search?query=' + encodeURIComponent(q),      hosts: ['rightdao.com'] },
];

const SEARX_HOSTS = [
  'https://searx.be', 'https://priv.au', 'https://search.inetol.net',
  'https://searxng.site', 'https://opnxng.com', 'https://baresearch.org',
  'https://search.projectsegfau.lt', 'https://searx.tiekoetter.com',
  'https://search.bus-hit.me', 'https://northboot.xyz',
];

async function htmlEngine(engine, query) {
  const got = await grab(engine.url(query));
  if (got.error) return { error: got.error, items: [] };

  const html = await got.res.text();
  const items = extractLinks(html, engine.hosts);
  return { items, error: items.length ? null : 'nothing parsed' };
}

// one searxng mirror is often rate limited, so a few are asked at once and the
// first useful answer wins
async function searxng(query) {
  const picks = SEARX_HOSTS.slice().sort(() => Math.random() - 0.5).slice(0, 4);
  const notes = [];

  const runs = picks.map(async host => {
    const json = await grab(`${host}/search?format=json&q=` + encodeURIComponent(query));
    if (json.res) {
      try {
        const data = await json.res.json();
        const items = (data.results || []).slice(0, 15).map(r => ({
          title: r.title || r.url,
          url: r.url,
          text: (r.content || '').slice(0, 240),
        }));
        if (items.length) return items;
      } catch (e) {
        notes.push(host.replace('https://', '') + ': no json');
      }
    } else {
      notes.push(host.replace('https://', '') + ': ' + json.error);
    }

    const page = await grab(`${host}/search?q=` + encodeURIComponent(query));
    if (!page.res) return [];

    const items = extractLinks(await page.res.text(), [new URL(host).hostname]);
    return items;
  });

  const settled = await Promise.all(runs.map(p => p.catch(() => [])));
  const best = settled.filter(x => x.length).sort((a, b) => b.length - a.length)[0];

  return best && best.length
    ? { items: best }
    : { items: [], error: notes.slice(0, 3).join(' | ') || 'no mirror answered' };
}

// official endpoint, answers servers, but only knows topics it has an entry for
async function ddgAnswers(query) {
  const got = await grab('https://api.duckduckgo.com/?no_html=1&no_redirect=1&skip_disambig=1&format=json&q='
    + encodeURIComponent(query));
  if (got.error) return { error: got.error, items: [] };

  const body = await got.res.text();
  if (!body.trim().startsWith('{')) return { error: 'not json', items: [] };

  try {
    const data = JSON.parse(body);
    const items = [];

    if (data.AbstractURL && data.AbstractText) {
      items.push({ title: data.Heading || query, url: data.AbstractURL, text: data.AbstractText.slice(0, 240) });
    }

    (data.Results || []).forEach(r => {
      if (r.FirstURL) items.push({ title: strip(r.Text || r.FirstURL).slice(0, 110), url: r.FirstURL, text: '' });
    });

    (data.RelatedTopics || []).forEach(t => {
      (t.Topics || [t]).forEach(x => {
        if (x.FirstURL && x.Text) {
          items.push({ title: x.Text.split(' - ')[0].slice(0, 110), url: x.FirstURL, text: x.Text.slice(0, 240) });
        }
      });
    });

    return { items: items.slice(0, 15), error: items.length ? null : 'no answer' };
  } catch (e) {
    return { error: 'bad json', items: [] };
  }
}

// same page from two sources should count once, so compare without the noise
function keyOf(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '');
    return u.hostname.replace(/^www\./, '') + path;
  } catch (e) {
    return url;
  }
}

// reciprocal rank fusion: a page ranked well by several engines wins over one
// that a single engine put on top
function merge(lists) {
  const K = 10;
  const seen = new Map();

  lists.forEach(({ source, items }) => {
    items.forEach((item, rank) => {
      const key = keyOf(item.url);
      const score = 1 / (K + rank);
      const hit = seen.get(key);

      if (!hit) {
        seen.set(key, {
          title: item.title,
          url: item.url,
          text: item.text || '',
          sources: [source],
          score,
        });
        return;
      }

      hit.score += score;
      if (!hit.sources.includes(source)) hit.sources.push(source);
      if ((item.text || '').length > hit.text.length) hit.text = item.text;
      if (item.title.length > hit.title.length && item.title.length < 110) hit.title = item.title;
    });
  });

  return [...seen.values()].sort((a, b) => b.score - a.score);
}

export default async function handler(req, res) {
  const query = (req.query.q || '').trim();

  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'public, max-age=300');

  if (!query) {
    res.status(400).json({ error: 'no query' });
    return;
  }

  const jobs = [
    ...ENGINES.map(e => [e.name, () => htmlEngine(e, query)]),
    ['searxng', () => searxng(query)],
    ['duckduckgo', () => ddgAnswers(query)],
  ];

  const settled = await Promise.all(jobs.map(async ([name, run]) => {
    try {
      const out = await run();
      return { source: name, items: out.items || [], note: out.error || null };
    } catch (e) {
      return { source: name, items: [], note: String(e && e.message || e) };
    }
  }));

  const working = settled.filter(s => s.items.length);

  res.status(200).json({
    engine: working.map(s => s.source).join(' + ') || null,
    results: merge(working).slice(0, 25),
    tried: settled.map(s => ({ source: s.source, found: s.items.length, note: s.note })),
  });
}