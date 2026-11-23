import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/components/ConversionTracking.astro', import.meta.url), 'utf8');
const script = src.match(/<script is:inline[^>]*>([\s\S]*?)<\/script>/)[1];
const tick = () => new Promise((r) => setImmediate(r));

// Runs the component script in a stub page. Returns handles to drive it.
function load({ endpoint = '/api/analytics/events', consent = null, statuses = [202] } = {}) {
  const store = new Map(consent ? [['rr-analytics-consent', consent]] : []);
  const writes = [];
  const calls = [];
  let now = 0;
  let timers = [];
  const listeners = {};
  const stubDoc = { querySelectorAll: () => [], addEventListener() {}, visibilityState: 'visible' };
  const win = {
    innerWidth: 1280,
    addEventListener: (t, f) => { listeners[t] = f; },
  };
  const ctx = {
    window: win, document: stubDoc, IntersectionObserver: undefined, WeakSet, Date, JSON, Math, URL,
    location: { href: 'https://site.test/page', origin: 'https://site.test', pathname: '/page' },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { writes.push(k); store.set(k, v); },
    },
    setTimeout: (f, ms) => { const t = { f, at: now + ms }; timers.push(t); return t; },
    clearTimeout: (t) => { timers = timers.filter((x) => x !== t); },
    fetch: async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return { status: statuses[Math.min(calls.length, statuses.length) - 1] };
    },
  };
  ctx.window.crypto = undefined;
  vm.runInNewContext(`var endpoint=${JSON.stringify(endpoint)},property='site.test';${script}`, Object.assign(ctx, { globalThis: ctx }));
  return {
    calls, writes, store, track: win.rrTrack,
    advance(ms) { now += ms; const due = timers.filter((t) => t.at <= now); timers = timers.filter((t) => t.at > now); due.forEach((t) => t.f()); },
    storageEvent: () => listeners.storage({ key: 'rr-analytics-consent' }),
  };
}

test('no storage write and no request before consent', async () => {
  const p = load();
  p.track('cta_click', { cta_id: 'a' });
  p.advance(5000); await tick();
  assert.equal(p.writes.length, 0);
  assert.equal(p.calls.length, 0);
});

test('default endpoint uses credentials same-origin', async () => {
  const p = load({ consent: 'accepted' });
  p.advance(700); await tick();
  assert.equal(p.calls.length, 1);
  assert.equal(p.calls[0].url, '/api/analytics/events');
  assert.equal(p.calls[0].init.credentials, 'same-origin');
});

test('https cross-origin endpoint uses credentials omit', async () => {
  const url = 'https://obx-posthog-static-collector.mike-previews.workers.dev';
  const p = load({ consent: 'accepted', endpoint: url });
  p.advance(700); await tick();
  assert.equal(p.calls[0].url, url);
  assert.equal(p.calls[0].init.credentials, 'omit');
});

test('http cross-origin endpoint is rejected: nothing stored or sent', async () => {
  const p = load({ consent: 'accepted', endpoint: 'http://collector.test/e' });
  p.track('cta_click', { cta_id: 'a' });
  p.advance(5000); await tick();
  assert.equal(p.calls.length, 0);
  assert.equal(p.writes.length, 0);
});

test('queue clears only on status 202', async () => {
  const p = load({ consent: 'accepted', statuses: [500, 202, 202] });
  p.advance(700); await tick();            // page_view -> 500, kept
  assert.equal(p.calls.length, 1);
  p.advance(1000); await tick();           // retry resends the same event, 202 clears it
  assert.equal(p.calls.length, 2);
  assert.deepEqual(p.calls[1].body.events.map((e) => e.name), ['page_view']);
  p.track('cta_click', { cta_id: 'a' });
  p.advance(700); await tick();
  assert.deepEqual(p.calls[2].body.events.map((e) => e.name), ['cta_click']);
});

test('withdrawn consent drops the queued events', async () => {
  const p = load({ consent: 'accepted' });
  p.store.set('rr-analytics-consent', 'declined');
  p.storageEvent();
  p.advance(5000); await tick();
  assert.equal(p.calls.length, 0);
});
