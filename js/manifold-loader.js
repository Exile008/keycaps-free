// WASM singleton loader for manifold-3d 3.5.4.
// Browser: resolves locateFile against the vendored directory.
// Node: leaves the default locateFile untouched (manifold.js uses
// createRequire + import.meta.url to find manifold.wasm next to itself).

let _promise = null;

export async function getManifold() {
  if (_promise) return _promise;
  _promise = (async () => {
    const mod = await import('../vendor/manifold/manifold.js');
    const Module = mod.default;
    const isNode = typeof window === 'undefined';
    const config = isNode
      ? {}
      : { locateFile: (f) => new URL('../vendor/manifold/' + f, import.meta.url).href };
    const wasm = await Module(config);
    wasm.setup();
    return wasm;
  })();
  return _promise;
}

// Test helper: drop the cached instance (used by None; exposed for completeness).
export function resetManifold() {
  _promise = null;
}
