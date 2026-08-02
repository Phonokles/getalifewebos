// javascript and typescript run in a worker, so an endless loop cannot freeze
// the os and the code cannot touch the page
const JsRunner = (function () {

  const TS_CDN = 'https://cdn.jsdelivr.net/npm/typescript@5.4.5/lib/typescript.js';

  const WORKER = `
    let out = [];
    const send = (s) => out.push(s);

    console.log = (...a) => send(a.map(fmt).join(' '));
    console.info = console.log;
    console.warn = console.log;
    console.debug = console.log;

    let errOut = [];
    console.error = (...a) => errOut.push(a.map(fmt).join(' '));

    function fmt(v) {
      if (typeof v === 'string') return v;
      try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); }
    }

    self.onmessage = async (e) => {
      const { code, stdin } = e.data;
      let lines = String(stdin || '').split('\\n');
      let li = 0;

      self.readLine = () => (li < lines.length ? lines[li++] : null);
      self.prompt = self.readLine;

      let failed = null;

      try {
        const result = await eval('(async () => {' + code + '\\n})()');
        if (result !== undefined) send(fmt(result));
      } catch (err) {
        failed = (err && err.stack) ? err.stack : String(err);
      }

      self.postMessage({ out, errOut, failed });
    };
  `;

  function available() {
    return typeof Worker === 'function' && typeof Blob === 'function';
  }

  let tsLib = null;

  async function toJs(code, ext) {
    if (ext !== 'ts') return code;

    if (!tsLib) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = TS_CDN;
        s.onload = resolve;
        s.onerror = () => reject(new Error('could not load the typescript compiler'));
        document.head.appendChild(s);
      });
      tsLib = window.ts;
    }

    return tsLib.transpileModule(code, {
      compilerOptions: { target: tsLib.ScriptTarget.ES2020 },
    }).outputText;
  }

  async function run(code, stdin, onProgress, ext) {
    if (ext === 'ts') onProgress && onProgress('compiling typescript...');

    const js = await toJs(code, ext);
    const url = URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }));
    const worker = new Worker(url);

    const result = await new Promise((resolve) => {
      // a runaway loop must not hang the terminal forever
      const timer = setTimeout(() => {
        worker.terminate();
        resolve({ out: [], errOut: [], failed: 'stopped after 6 seconds' });
      }, 6000);

      worker.onmessage = (e) => {
        clearTimeout(timer);
        resolve(e.data);
      };
      worker.onerror = (e) => {
        clearTimeout(timer);
        resolve({ out: [], errOut: [], failed: e.message || 'worker error' });
      };

      worker.postMessage({ code: js, stdin });
    });

    worker.terminate();
    URL.revokeObjectURL(url);

    const stderr = [...(result.errOut || [])];
    if (result.failed) stderr.push(result.failed);

    return {
      language: (ext === 'ts' ? 'typescript' : 'javascript') + ' (in your browser)',
      compile: null,
      run: {
        stdout: (result.out || []).join('\n') + (result.out && result.out.length ? '\n' : ''),
        stderr: stderr.join('\n'),
        code: result.failed ? 1 : 0,
        signal: null,
      },
    };
  }

  return { available, run, isReady: () => true };

})();