// everything that can run in the browser is registered here. the terminal asks
// this first and only falls back to the server when nothing local fits.
window.LocalRun = (function () {

  const BY_EXT = {
    js: () => JsRunner,
    mjs: () => JsRunner,
    ts: () => JsRunner,
    py: () => PyRunner,
    lua: () => LuaRunner,
  };

  function runnerFor(ext) {
    const get = BY_EXT[ext];
    if (!get) return null;

    let runner = null;
    try {
      runner = get();
    } catch (e) {
      return null;
    }

    return (runner && runner.available && runner.available()) ? runner : null;
  }

  return {
    handles(ext) {
      return !!runnerFor(ext);
    },

    isReady(ext) {
      const r = runnerFor(ext);
      return !!(r && r.isReady && r.isReady());
    },

    list() {
      return Object.keys(BY_EXT).filter(e => runnerFor(e));
    },

    run(ext, code, stdin, onProgress) {
      const r = runnerFor(ext);
      if (!r) return Promise.reject(new Error('nothing local for .' + ext));
      return r.run(code, stdin, onProgress, ext);
    },
  };

})();