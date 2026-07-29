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

// runs inside the proxied page: links stay in the proxy instead of dead ending
const HOOK = `<script>
(function () {
  function tell(url) {
    try { parent.postMessage({ type: 'proxyNav', url: url }, '*'); } catch (e) {}
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.startsWith('javascript:') || href.startsWith('#')) return;
    e.preventDefault();
    tell(new URL(href, document.baseURI).href);
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

  try {
    const upstream = await fetch(parsed.href, {
      redirect: 'follow',
      headers: {
        'user-agent': UA,
        'accept': req.headers.accept || 'text/html,application/xhtml+xml,*/*',
        'accept-language': req.headers['accept-language'] || 'en,de;q=0.8',
      },
    });

    const type = upstream.headers.get('content-type') || 'application/octet-stream';

    upstream.headers.forEach((value, key) => {
      if (!STRIP.includes(key.toLowerCase()) && key.toLowerCase() !== 'set-cookie') {
        res.setHeader(key, value);
      }
    });

    res.setHeader('content-type', type);
    res.setHeader('access-control-allow-origin', '*');

    if (!type.includes('text/html')) {
      const buf = Buffer.from(await upstream.arrayBuffer());
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
    res.status(502).json({ error: String(err && err.message ? err.message : err) });
  }
}

