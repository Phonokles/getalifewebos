// compiling happens on a remote runner. a browser cannot host gcc, and vercel
// functions have no compilers either, so the code is sent to piston, which is
// free and needs no key

// emkc answers /runtimes but refuses /execute without a key, so it is only
// useful once PISTON_KEY is set. wandbox is the one that works without.
const RUNNERS = [
  'https://emkc.org/api/v2/piston',
];

const PISTON_KEY = process.env.PISTON_KEY || '';

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

// wandbox is a second, independent service. it has been open without a key for
// years, so it is a real fallback rather than another piston clone
const WANDBOX = {
  c: 'gcc-head-c', cpp: 'gcc-head', cc: 'gcc-head', cxx: 'gcc-head', h: 'gcc-head-c',
  rs: 'rust-head', go: 'go-head', py: 'cpython-head', js: 'nodejs-head',
  rb: 'ruby-head', php: 'php-head', lua: 'lua-5.4.0', cs: 'mono-head',
  swift: 'swift-5.2.5', java: 'openjdk-head', ts: 'typescript-3.9.5',
};

async function viaWandbox(ext, code, stdin) {
  const compiler = WANDBOX[ext];
  if (!compiler) return { error: 'wandbox has no compiler for .' + ext };

  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 20000);

  try {
    const res = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: stop.signal,
      body: JSON.stringify({ compiler, code, stdin, save: false }),
    });
    clearTimeout(timer);

    if (!res.ok) return { error: 'http ' + res.status };

    const d = await res.json();

    // the container backend is sometimes out of capacity. that is temporary and
    // shows up as a compiler error, so it must not be reported as one
    const busy = /OCI runtime|Resource temporarily unavailable|crun:|cannot allocate|too many/i;
    const both = (d.compiler_error || '') + (d.program_error || '');

    if (busy.test(both)) return { retry: 'the runner is out of capacity' };

    return {
      result: {
        language: compiler,
        compile: (d.compiler_error || d.compiler_message) ? {
          stdout: d.compiler_output || '',
          stderr: d.compiler_error || '',
          code: d.status && d.status !== '0' && !d.program_message ? 1 : 0,
        } : null,
        run: {
          stdout: d.program_output || '',
          stderr: d.program_error || '',
          code: parseInt(d.status || '0', 10) || 0,
          signal: d.signal || null,
        },
      },
    };
  } catch (e) {
    clearTimeout(timer);
    return { error: e && e.name === 'AbortError' ? 'timeout' : String(e && e.message || e) };
  }
}

// godbolt is a third, independent service. it compiles and runs without a key
const GODBOLT = {
  c: { id: 'cg132', lang: 'c' },
  cpp: { id: 'g132', lang: 'c++' },
  cc: { id: 'g132', lang: 'c++' },
  cxx: { id: 'g132', lang: 'c++' },
  rs: { id: 'r1740', lang: 'rust' },
  go: { id: 'gl1201', lang: 'go' },
};

async function viaGodbolt(ext, code, stdin, args) {
  const conf = GODBOLT[ext];
  if (!conf) return { error: 'godbolt has no compiler for .' + ext };

  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 20000);

  try {
    const res = await fetch(`https://godbolt.org/api/compiler/${conf.id}/compile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      signal: stop.signal,
      body: JSON.stringify({
        source: code,
        options: {
          userArguments: '-O2',
          executeParameters: { args: args || [], stdin },
          compilerOptions: { executorRequest: true },
          filters: { execute: true },
        },
        lang: conf.lang,
      }),
    });
    clearTimeout(timer);

    if (!res.ok) return { error: 'http ' + res.status };

    const d = await res.json();
    const lines = (arr) => (arr || []).map(x => (x && x.text !== undefined ? x.text : x)).join('\n');

    if (d.buildResult && d.buildResult.code) {
      return {
        result: {
          language: conf.lang + ' (godbolt)',
          compile: { stdout: lines(d.buildResult.stdout), stderr: lines(d.buildResult.stderr), code: d.buildResult.code },
          run: null,
        },
      };
    }

    return {
      result: {
        language: conf.lang + ' (godbolt)',
        compile: null,
        run: { stdout: lines(d.stdout), stderr: lines(d.stderr), code: d.code || 0, signal: null },
      },
    };
  } catch (e) {
    clearTimeout(timer);
    return { error: e && e.name === 'AbortError' ? 'timeout' : String(e && e.message || e) };
  }
}

export default async function handler(req, res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // /api/run?check=1 shows which services answer from here
  if (req.query.check) {
    const probes = [
      ...RUNNERS.map(h => [h, h + '/runtimes']),
      ['wandbox', 'https://wandbox.org/api/list.json'],
      ['godbolt', 'https://godbolt.org/api/compilers/c++'],
    ];

    const results = await Promise.all(probes.map(async ([name, url]) => {
      const stop = new AbortController();
      const timer = setTimeout(() => stop.abort(), 8000);
      try {
        const r = await fetch(url, { signal: stop.signal });
        clearTimeout(timer);
        return { service: name, status: r.status, ok: r.ok };
      } catch (e) {
        clearTimeout(timer);
        return { service: name, status: null, ok: false,
          note: e && e.name === 'AbortError' ? 'timeout' : String(e && e.message || e) };
      }
    }));

    res.status(200).json({ hasKey: !!PISTON_KEY, probes: results });
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

  // wandbox first: it needs no key, piston does. a busy backend usually frees
  // up within a moment, so it gets a few tries before moving on
  let wb = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    wb = await viaWandbox(ext, code, stdin);

    if (wb.result) {
      res.status(200).json(wb.result);
      return;
    }
    if (!wb.retry) break;

    await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
  }

  notes.push('wandbox: ' + (wb.error || wb.retry));

  for (const host of RUNNERS) {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 20000);

    try {
      const headers = { 'content-type': 'application/json' };
      if (PISTON_KEY) headers.authorization = PISTON_KEY;

      const upstream = await fetch(host + '/execute', {
        method: 'POST',
        headers,
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

  const gb = await viaGodbolt(ext, code, stdin, args);
  if (gb.result) {
    res.status(200).json(gb.result);
    return;
  }
  notes.push('godbolt: ' + gb.error);

  res.status(200).json({
    error: 'no runner answered',
    notes,
    hint: 'all free services refused. see api/run.js to add one or set PISTON_KEY.',
  });
}