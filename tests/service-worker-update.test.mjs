import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

test('a new worker fetches fresh app assets and replaces the previous offline cache', async () => {
  const handlers = new Map();
  const oldCache = new Map([['/scenario-spark/assets/index.js', 'old navbar']]);
  const newCache = new Map();
  const deleted = [];
  const code = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
    .replace('__BUILD_HASH__', 'release-2');
  const origin = 'https://example.org';
  let online = false;
  runInNewContext(code, {
    URL,
    fetch: async () => {
      if (!online) throw new TypeError('offline');
      return { status: 200, type: 'basic', body: 'network navbar', clone() { return this; } };
    },
    self: {
      location: { origin, pathname: '/scenario-spark/sw.js' },
      addEventListener: (event, handler) => handlers.set(event, handler),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    Request: class {
      constructor(url, options) {
        this.url = url;
        this.cache = options.cache;
      }
    },
    caches: {
      open: async () => ({
        put: async () => {},
        addAll: async (requests) => {
          assert.ok(requests.every((request) => request.cache === 'reload'));
          for (const request of requests) newCache.set(request.url, 'new navbar');
        },
      }),
      keys: async () => ['scenario-spark-v9', 'scenario-spark-release-2', 'other-app'],
      delete: async (name) => { deleted.push(name); },
      match: async (request) =>
        newCache.get(new URL(typeof request === 'string' ? request : request.url, origin).pathname),
    },
  });

  let pending;
  handlers.get('install')({ waitUntil: (promise) => { pending = promise; } });
  await pending;
  handlers.get('activate')({ waitUntil: (promise) => { pending = promise; } });
  await pending;

  assert.deepEqual(deleted, ['scenario-spark-v9']);
  assert.equal(oldCache.get('/scenario-spark/assets/index.js'), 'old navbar');
  const fetchAsset = async () => {
    let response;
    handlers.get('fetch')({
      request: { method: 'GET', mode: 'cors', url: `${origin}/scenario-spark/assets/index.js` },
      respondWith: (promise) => { response = promise; },
    });
    return response;
  };
  // Offline: stable-named assets fall back to the freshly installed cache.
  assert.equal(await fetchAsset(), 'new navbar');
  // Online: stable-named assets are network-first, so a new deployment is used immediately.
  online = true;
  assert.equal((await fetchAsset()).body, 'network navbar');
});
