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
  runInNewContext(code, {
    self: {
      location: { pathname: '/scenario-spark/sw.js' },
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
        addAll: async (requests) => {
          assert.ok(requests.every((request) => request.cache === 'reload'));
          for (const request of requests) newCache.set(request.url, 'new navbar');
        },
      }),
      keys: async () => ['scenario-spark-v9', 'scenario-spark-release-2', 'other-app'],
      delete: async (name) => { deleted.push(name); },
      match: async (request) => newCache.get(request.url),
    },
  });

  let pending;
  handlers.get('install')({ waitUntil: (promise) => { pending = promise; } });
  await pending;
  handlers.get('activate')({ waitUntil: (promise) => { pending = promise; } });
  await pending;

  assert.deepEqual(deleted, ['scenario-spark-v9']);
  assert.equal(oldCache.get('/scenario-spark/assets/index.js'), 'old navbar');
  let response;
  handlers.get('fetch')({
    request: { method: 'GET', mode: 'cors', url: '/scenario-spark/assets/index.js' },
    respondWith: (promise) => { response = promise; },
  });
  assert.equal(await response, 'new navbar');
});
