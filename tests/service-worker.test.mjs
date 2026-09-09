import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

function makeHarness({ fetchImpl, matchImpl, cacheKeys } = {}) {
  const listeners = new Map();
  const opened = new Map();
  const deleted = [];
  let claimed = 0;
  let skipWaiting = 0;

  const makeCache = name => {
    if (!opened.has(name)) opened.set(name, { added: [], puts: [] });
    const state = opened.get(name);
    return {
      addAll: async values => { state.added.push(...values); },
      put: async (request, response) => { state.puts.push({ request, response }); }
    };
  };

  const caches = {
    open: async name => makeCache(name),
    keys: async () => cacheKeys || ['still-pine-static-v1.1.0', 'still-pine-content-v1.1.0', 'unrelated-cache'],
    delete: async name => { deleted.push(name); return true; },
    match: async request => matchImpl ? matchImpl(request) : undefined
  };

  const self = {
    location: { origin: 'https://stillpine.example' },
    clients: { claim: async () => { claimed += 1; } },
    skipWaiting: () => { skipWaiting += 1; },
    addEventListener: (type, callback) => listeners.set(type, callback)
  };

  vm.runInNewContext(source, {
    self,
    caches,
    fetch: fetchImpl || (async () => new Response('ok', { status: 200 })),
    URL,
    Response,
    Set,
    Promise
  });

  return {
    listeners, opened, deleted,
    get claimed() { return claimed; },
    get skipWaiting() { return skipWaiting; }
  };
}

async function runWaitEvent(listener, extra = {}) {
  let promise = Promise.resolve();
  listener({ ...extra, waitUntil(value) { promise = Promise.resolve(value); } });
  await promise;
}

async function runFetch(listener, request) {
  let promise;
  listener({ request, respondWith(value) { promise = Promise.resolve(value); } });
  assert.ok(promise, 'fetch listener did not call respondWith');
  return promise;
}

test('install precaches core assets without immediate skipWaiting', async () => {
  const h = makeHarness();
  await runWaitEvent(h.listeners.get('install'));
  const cache = h.opened.get('still-pine-static-v1.2.0');
  assert.ok(cache);
  assert.ok(cache.added.includes('./app.js'));
  assert.ok(cache.added.includes('./js/practice-engine.js'));
  assert.ok(cache.added.includes('./content/packs/foundation-01.zenpack.json'));
  assert.equal(h.skipWaiting, 0);
});

test('legacy v1.1 cache crosses automatically into managed v1.2 updates', async () => {
  const h = makeHarness({ cacheKeys: ['still-pine-v1.1.0', 'unrelated-cache'] });
  await runWaitEvent(h.listeners.get('install'));
  assert.equal(h.skipWaiting, 1);
});

test('SKIP_WAITING occurs only after an explicit application message', () => {
  const h = makeHarness();
  h.listeners.get('message')({ data: { type: 'OTHER' } });
  assert.equal(h.skipWaiting, 0);
  h.listeners.get('message')({ data: { type: 'SKIP_WAITING' } });
  assert.equal(h.skipWaiting, 1);
});

test('activate removes old Still Pine caches but leaves unrelated caches', async () => {
  const h = makeHarness({ cacheKeys: ['still-pine-v1.1.0', 'still-pine-static-v1.1.0', 'still-pine-content-v1.1.0', 'unrelated-cache'] });
  await runWaitEvent(h.listeners.get('activate'));
  assert.deepEqual(h.deleted.sort(), ['still-pine-content-v1.1.0', 'still-pine-static-v1.1.0', 'still-pine-v1.1.0']);
  assert.equal(h.claimed, 1);
});

test('offline missing image never receives index.html as a fake fallback', async () => {
  const h = makeHarness({ fetchImpl: async () => { throw new Error('offline'); }, matchImpl: async () => undefined });
  const response = await runFetch(h.listeners.get('fetch'), {
    method: 'GET', url: 'https://stillpine.example/assets/missing.jpg', mode: 'cors', destination: 'image'
  });
  assert.equal(response.type, 'error');
  assert.equal(response.status, 0);
});

test('offline navigation receives cached index fallback', async () => {
  const cached = new Response('<!doctype html><title>Still Pine</title>', { status: 200, headers: { 'content-type': 'text/html' } });
  const h = makeHarness({
    fetchImpl: async () => { throw new Error('offline'); },
    matchImpl: async request => request === './index.html' ? cached.clone() : undefined
  });
  const response = await runFetch(h.listeners.get('fetch'), {
    method: 'GET', url: 'https://stillpine.example/', mode: 'navigate', destination: 'document'
  });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Still Pine/);
});
