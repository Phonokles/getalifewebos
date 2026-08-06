// fetches a page on the server and hands it back without the headers that stop
// framing. only the document goes through here, subresources load straight from
// the origin thanks to the injected <base>

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const STRIP = [
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'permissions-policy',
  'content-encoding',
  'content-length',
  'transfer-encoding',
];

// runs inside the proxied page: links stay in the proxy instead of dead ending,
// and download links are reported so the os can save them to its filesystem
const HOOK = `<script>
(function () {
  var DL = /\\.(pdf|zip|rar|7z|tar|gz|tgz|docx?|xlsx?|pptx?|csv|odt|rtf|mp3|wav|flac|ogg|m4a|mp4|webm|mkv|mov|apk|exe|dmg|iso|epub|mobi|bin)(\\?|$)/i;
  function tell(url) {
    try { parent.postMessage({ type: 'proxyNav', url: url }, '*'); } catch (e) {}
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.startsWith('javascript:') || href.startsWith('#')) return;
    e.preventDefault();
    var abs = new URL(href, document.baseURI).href;
    if (a.hasAttribute('download') || DL.test(abs)) {
      try { parent.postMessage({ type: 'proxyDownload', url: abs, name: a.getAttribute('download') || '' }, '*'); } catch (e) {}
    } else {
      tell(abs);
    }
  }, true);
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.method.toLowerCase() !== 'get') return;
    e.preventDefault();
    var q = new URLSearchParams(new FormData(f)).toString();
    var u = new URL(f.getAttribute('action') || '', document.baseURI);
    u.search = q;
    tell(u.href);
  }, true);
}());
</script>`;

function errorPage(title, detail, url) {
  const safe = String(detail || '').replace(/[<>&]/g, '');
  const link = String(url || '').replace(/"/g, '&quot;');
  return `<!doctype html><meta charset="utf-8">
<style>
  body { margin:0; height:100vh; display:flex; flex-direction:column;
         align-items:center; justify-content:center; gap:14px; text-align:center;
         background:#0e0e0e; color:#bbb; font:13px/1.9 monospace; padding:30px; }
  b { color:#fff; font-weight:normal; font-size:15px; letter-spacing:2px; }
  p { max-width:420px; color:#777; margin:0; }
  a { color:#ddd; text-decoration:none; border:1px solid #333; padding:8px 14px;
      border-radius:7px; }
  a:hover { background:#1a1a1a; }
</style>
<div>[-_-]</div>
<b>${title}</b>
<p>${safe}</p>
<a href="${link}" target="_blank" rel="noopener">open in a real tab &#8599;</a>`;
}

export default async function handler(req, res) {
  const target = req.query.url;

  if (req.query.ping) {
    res.status(200).json({ ok: true });
    return;
  }

  if (!target) {
    res.status(400).json({ error: 'no url' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch (e) {
    res.status(400).json({ error: 'bad url' });
    return;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    res.status(400).json({ error: 'only http and https' });
    return;
  }

  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 8000);

  try {
    const upstream = await fetch(parsed.href, {
      redirect: 'follow',
      signal: stop.signal,
      headers: {
        'user-agent': UA,
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': req.headers['accept-language'] || 'de,en;q=0.8',
        'upgrade-insecure-requests': '1',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
      },
    });
    clearTimeout(timer);

    if (upstream.status >= 400) {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.status(200).send(errorPage(
        'the site answered ' + upstream.status,
        upstream.status === 403
          ? 'it refuses requests coming from a server instead of a normal browser. '
            + 'cloudflare and similar guards do this.'
          : 'the page could not be fetched.',
        parsed.href));
      return;
    }

    const type = upstream.headers.get('content-type') || 'application/octet-stream';

    upstream.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (STRIP.includes(k) || k === 'set-cookie') return;
      try {
        res.setHeader(key, value);
      } catch (e) {
        // some upstream headers are not valid to forward, skip them
      }
    });

    res.setHeader('content-type', type);
    res.setHeader('access-control-allow-origin', '*');

    if (!type.includes('text/html')) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.length > 4 * 1024 * 1024) {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.status(200).send(errorPage('too big to pass through',
          'the file is over 4 mb, which is more than the function may return.', parsed.href));
        return;
      }
      res.status(upstream.status).send(buf);
      return;
    }

    let html = await upstream.text();
    const finalUrl = upstream.url || parsed.href;

    // meta based csp would still block, so it goes too
    html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '');

    const base = `<base href="${finalUrl.replace(/"/g, '&quot;')}">`;

    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1>${base}`);
    } else {
      html = base + html;
    }

    html = /<\/body>/i.test(html)
      ? html.replace(/<\/body>/i, `${HOOK}</body>`)
      : html + HOOK;

    res.status(upstream.status).send(html);
  } catch (err) {
    clearTimeout(timer);
    const aborted = err && err.name === 'AbortError';
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.status(200).send(errorPage(
      aborted ? 'the site took too long' : 'could not reach the site',
      aborted
        ? 'it did not answer within eight seconds.'
        : String(err && err.message ? err.message : err),
      parsed.href));
  }
}