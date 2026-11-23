// The lead-acceptance contract on thaiketo. Run with:
//
//     node --test tests/
//
// Fixtures only: `fetch` is stubbed (no provider, no network). The stub
// records every forward, so "was it forwarded" is counted, not inferred.
import test from 'node:test';
import assert from 'node:assert/strict';
const { POST } = await import('../src/pages/api/lead-submit.ts');

const PROVIDER = 'https://api.sequenzy.com/api/v1/forms/o76kxb87r26dd3749df6ejqy';
const ORIGIN = 'https://thaiketo.com';
const ROUTE = 'https://thaiketo.com/api/lead-submit';

/** Every body the route sent to the provider. */
let forwarded = [];
/** The status the stubbed provider answers with. */
let providerStatus = 200;

globalThis.fetch = async (url, init) => {
  assert.equal(String(url), PROVIDER, `the route must only talk to the provider: ${url}`);
  forwarded.push({ url: String(url), body: new URLSearchParams(init.body) });
  if (providerStatus !== 200) {
    return new Response('provider said no', { status: providerStatus });
  }
  return Response.json({ success: true });
};

/** Post a submission to the route. `origin: null` sends no Origin header. */
async function submit({ accept = 'application/json', origin = ORIGIN } = {}) {
  const headers = { 'content-type': 'application/x-www-form-urlencoded' };
  if (accept) headers.accept = accept;
  if (origin) headers.origin = origin;
  return POST({
    request: new Request(ROUTE, {
      method: 'POST',
      headers,
      body: 'email=visitor%40example.com&referrer=contact',
    }),
  });
}

test('an accepted submission: 200, x-lead-status: accepted, one forward', async () => {
  forwarded = [];
  const res = await submit();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-lead-status'), 'accepted');
  assert.deepEqual(await res.json(), { ok: true, status: 'accepted' });

  assert.equal(forwarded.length, 1, 'exactly one forward');
  assert.equal(forwarded[0].url, PROVIDER);
  assert.equal(forwarded[0].body.get('email'), 'visitor@example.com');
  assert.equal(forwarded[0].body.get('referrer'), 'contact', 'fields are not dropped or renamed');
});

test('the same submission with Accept: text/html: 303 to /?subscribed=1', async () => {
  forwarded = [];
  const res = await submit({ accept: 'text/html' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/?subscribed=1');
  assert.equal(res.headers.get('x-lead-status'), 'accepted');
  assert.equal(forwarded.length, 1);
});

test('a provider 500: 502 unavailable, no success claim', async () => {
  forwarded = [];
  providerStatus = 500;
  try {
    const res = await submit();
    assert.equal(res.status, 502);
    assert.equal(res.headers.get('x-lead-status'), 'unavailable');
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.status, 'unavailable');
    assert.equal(forwarded.length, 1, 'one attempt was made');
  } finally {
    providerStatus = 200;
  }
});

test('a cross-origin Origin: 403, zero forwards', async () => {
  forwarded = [];
  const res = await submit({ origin: 'https://attacker.example' });
  assert.equal(res.status, 403);
  assert.equal(await res.text(), 'cross-origin submission refused');
  assert.equal(forwarded.length, 0, 'nothing is forwarded');
});
