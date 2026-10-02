import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

test('the service worker caches the chosen locale for offline use without fetching other kits', async () => {
  const handlers = new Map();
  const added = [];
  const cache = {
    match: async () => undefined,
    add: async (url) => { added.push(url); },
  };
  const code = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  runInNewContext(code, {
    self: {
      location: { pathname: '/scenario-spark/sw.js' },
      addEventListener: (event, handler) => handlers.set(event, handler),
    },
    caches: { open: async () => cache },
    console: { error: () => {} },
  });
  let pending;
  handlers.get('message')({
    data: { type: 'CACHE_STARTER_KIT', language: 'fr' },
    waitUntil: (promise) => { pending = promise; },
  });
  await pending;
  assert.deepEqual(added, ['/scenario-spark/assets/fr.js']);

  handlers.get('message')({
    data: { type: 'CACHE_STARTER_KIT', language: '../private' },
    waitUntil: () => assert.fail('An unsupported language must not be cached'),
  });
  assert.equal(added.length, 1);
});
