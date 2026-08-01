// compiling happens on a remote runner. a browser cannot host gcc, and vercel
// functions have no compilers either, so the code is sent to piston, which is
// free and needs no key

const RUNNERS = [
  'https://emkc.org/api/v2/piston',
  'https://piston.spicybackend.workers.dev/api/v2/piston',
];

// what piston calls each language, keyed by file extension
const LANGS = {
  c: { language: 'c', version: '10.2.0' },
  cpp: { language: 'c++', version: '10.2.0' },
  cc: { language: 'c++', version: '10.2.0' },
  cxx: { language: 'c++', version: '10.2.0' },
  h: { language: 'c', version: '10.2.0' },
  rs: { language: 'rust', version: '1.68.2' },
  go: { language: 'go', version: '1.16.2' },
  py: { language: 'python', version: '3.10.0' },
  js: { language: 'javascript', version: '18.15.0' },
  ts: { language: 'typescript', version: '5.0.3' },
  java: { language: 'java', version: '15.0.2' },
  cs: { language: 'csharp', version: '6.12.0' },
  kt: { language: 'kotlin', version: '1.8.20' },
  swift: { language: 'swift', version: '5.3.3' },
  rb: { language: 'ruby', version: '3.0.1' },
  php: { language: 'php', version: '8.2.3' },
  lua: { language: 'lua', version: '5.4.4' },
  sh: { language: 'bash', version: '5.2.0' },
  zig: { language: 'zig', version: '0.10.1' },
};

export default async function handler(req, res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.query.langs) {
    res.status(200).json({ langs: Object.keys(LANGS) });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'use post' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const ext = String(body.ext || '').toLowerCase().replace(/^\./, '');
  const code = String(body.code || '');
  const stdin = String(body.stdin || '');
  const args = Array.isArray(body.args) ? body.args.map(String) : [];

  const lang = LANGS[ext];

  if (!lang) {
    res.status(400).json({ error: 'no runner for .' + ext, known: Object.keys(LANGS) });
    return;
  }

  if (!code.trim()) {
    res.status(400).json({ error: 'the file is empty' });
    return;
  }

  const payload = JSON.stringify({
    language: lang.language,
    version: lang.version,
    files: [{ name: 'main.' + ext, content: code }],
    stdin,
    args,
    compile_timeout: 10000,
    run_timeout: 6000,
  });

  const notes = [];

  for (const host of RUNNERS) {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 20000);

    try {
      const upstream = await fetch(host + '/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        signal: stop.signal,
      });
      clearTimeout(timer);

      if (!upstream.ok) {
        notes.push(host + ': http ' + upstream.status);
        continue;
      }

      const data = await upstream.json();

      res.status(200).json({
        language: lang.language + ' ' + lang.version,
        compile: data.compile ? {
          stdout: data.compile.stdout || '',
          stderr: data.compile.stderr || '',
          code: data.compile.code,
        } : null,
        run: data.run ? {
          stdout: data.run.stdout || '',
          stderr: data.run.stderr || '',
          code: data.run.code,
          signal: data.run.signal || null,
        } : null,
      });
      return;
    } catch (e) {
      clearTimeout(timer);
      notes.push(host + ': ' + (e && e.name === 'AbortError' ? 'timeout' : String(e && e.message || e)));
    }
  }

  res.status(200).json({ error: 'no runner answered', notes });
}