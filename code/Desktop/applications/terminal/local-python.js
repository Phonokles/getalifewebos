// python that needs no server at all. pyodide is cpython compiled to wasm, so
// it runs in the tab. about 10 mb on first use, then cached by the browser.
const PyRunner = (function () {

  const CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/';

  let pyodide = null;
  let loading = null;

  function available() {
    return typeof WebAssembly === 'object';
  }

  async function boot(onProgress) {
    if (pyodide) return pyodide;
    if (loading) return loading;

    loading = (async () => {
      if (!window.loadPyodide) {
        onProgress && onProgress('downloading python (about 10 mb, once)...');
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = CDN + 'pyodide.js';
          s.onload = resolve;
          s.onerror = () => reject(new Error('could not load pyodide'));
          document.head.appendChild(s);
        });
      }

      onProgress && onProgress('starting python...');
      pyodide = await window.loadPyodide({ indexURL: CDN });
      return pyodide;
    })();

    try {
      return await loading;
    } catch (e) {
      loading = null;
      throw e;
    }
  }

  async function run(code, stdin, onProgress) {
    const py = await boot(onProgress);

    const out = [];
    const err = [];

    py.setStdout({ batched: (s) => out.push(s) });
    py.setStderr({ batched: (s) => err.push(s) });

    if (stdin) {
      const lines = String(stdin).split('\n');
      let i = 0;
      py.setStdin({ stdin: () => (i < lines.length ? lines[i++] : null) });
    }

    let code_ = 0;

    try {
      await py.runPythonAsync(code);
    } catch (e) {
      // python errors arrive as a js exception holding the traceback
      err.push(String(e && e.message ? e.message : e));
      code_ = 1;
    }

    return {
      language: 'python (in your browser)',
      compile: null,
      run: {
        stdout: out.join('\n') + (out.length ? '\n' : ''),
        stderr: err.join('\n'),
        code: code_,
        signal: null,
      },
    };
  }

  return { available, run, isReady: () => !!pyodide };

})();