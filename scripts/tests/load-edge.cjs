// Offline test loader: execute the real TypeScript handlers with only external
// services stubbed. No Deno server, credentials, or network access is required.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

exports.loadEdge = function loadEdge(entry, { mocks = {}, globals = {}, transform = s => s } = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const requireLocal = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), id));
      throw new Error(`Unmocked external dependency: ${id}`);
    };
    const source = transform(fs.readFileSync(filename, 'utf8'), filename);
    const code = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(code, {
      exports: module.exports, module, require: requireLocal,
      Request, Response, AbortSignal, URL, URLSearchParams, crypto, TextEncoder, btoa, setTimeout, clearTimeout,
      console: { log() {}, warn() {}, error() {} },
      fetch: () => { throw new Error('Unexpected network call'); },
      Deno: { env: { get() {} }, serve() {} }, ...globals,
    }, { filename });
    return module.exports;
  }
  return load(path.join(root, entry));
};
