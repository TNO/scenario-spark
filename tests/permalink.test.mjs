import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PERMALINK_PARAM,
  createPermalink,
  decodePermalinkData,
  encodePermalinkData,
} from '../src/utils/permalink.ts';

const box = {
  id: 'example',
  label: 'Voorbeeld – ünïcode ✓',
  categories: [{ id: 'c', label: 'Category', componentIds: ['d'] }],
  components: [{ id: 'd', label: 'Driver', values: [{ id: 'v', label: 'Value' }] }],
  inconsistencies: {},
  narratives: [],
};

test('round-trips a box through a URL-safe string', async () => {
  const encoded = await encodePermalinkData(box);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(JSON.parse(await decodePermalinkData(encoded)), box);
});

test('compresses repetitive content', async () => {
  const big = { ...box, desc: 'scenario '.repeat(2000) };
  const encoded = await encodePermalinkData(big);
  assert.ok(encoded.length < JSON.stringify(big).length / 10);
});

test('builds a link with the box query parameter', async () => {
  const link = await createPermalink(box, 'https://example.org/app/', '#!/home');
  const url = new URL(link);
  assert.equal(url.hash.startsWith('#!/home?box='), true);
  const encoded = new URLSearchParams(url.hash.split('?')[1]).get(PERMALINK_PARAM);
  assert.deepEqual(JSON.parse(await decodePermalinkData(encoded)), box);
});

test('rejects corrupted data', async () => {
  await assert.rejects(decodePermalinkData('not-a-valid-payload'));
});
