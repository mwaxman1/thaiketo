// mountLeadTracking in intercept mode, with hand-rolled stubs: no jsdom, no deps.
// Run with:
//
//     node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountLeadTracking } from '../src/lib/lead-tracking.js';

const PAGE = 'https://thaiketo.com/contact';

/** A fake win + doc pair. Returns handles for driving them. */
function page() {
  const tracked = [];
  const calls = [];
  const win = {
    location: { href: PAGE },
    fetch: async (input, init) => {
      calls.push({ input: String(input), init });
      return calls.response;
    },
  };
  win.rrTrack = (name, payload) => tracked.push({ name, payload });
  const doc = { listeners: {}, addEventListener: (type, fn) => { doc.listeners[type] = fn; } };
  return { win, doc, tracked, calls };
}

/** A form with the shape the pages give it: a `.kc-email-note` sibling. */
function leadForm() {
  const note = { className: 'kc-email-note', textContent: '' };
  const button = { tagName: 'BUTTON', type: 'submit', disabled: false };
  const form = {
    tagName: 'FORM',
    action: '/api/lead-submit',
    querySelector: () => null,
    parentElement: { parentElement: { querySelector: (sel) => (sel.includes('kc-email-note') ? note : null) } },
    reset() {},
  };
  return { form, note, button };
}

/** Drive a submit event on the fake doc. */
function submit(doc, form, extra = {}) {
  let prevented = false;
  stubFormData(() =>
    doc.listeners.submit({ target: form, submitter: form.button, preventDefault() { prevented = true; }, ...extra }),
  );
  return prevented;
}

const settle = () => new Promise((r) => setImmediate(r));

// Intercept mode builds a real FormData from the form; a fake form is not a
// DOM node, so the constructor is stubbed for the duration of each test.
const stubFormData = (fn) => {
  const real = globalThis.FormData;
  globalThis.FormData = class {};
  try { return fn(); } finally { globalThis.FormData = real; }
};

test('intercept mode: preventDefault is called, form_submit fires, the request goes to /api/lead-submit', async () => {
  const p = page();
  const { form, note, button } = leadForm();
  p.calls.response = { headers: { get: () => 'accepted' } };
  mountLeadTracking(p.win, p.doc, { intercept: true });

  const prevented = submit(p.doc, form, { submitter: button });
  assert.equal(prevented, true, 'the browser navigation is prevented');
  assert.equal(p.tracked.map((t) => t.name)[0], 'form_submit');
  await settle();
  assert.equal(p.calls.length, 1, 'the original fetch handled the submit');
  assert.equal(p.calls[0].input, '/api/lead-submit');
  assert.equal(p.calls[0].init.method, 'POST');
});

test('an accepted response fires generate_lead once and writes the confirmation into the .kc-email-note', async () => {
  const p = page();
  const { form, note, button } = leadForm();
  let resets = 0;
  form.reset = () => { resets++; };
  p.calls.response = { headers: { get: () => 'accepted' } };
  mountLeadTracking(p.win, p.doc, { intercept: true });

  submit(p.doc, form, { submitter: button });
  await settle();

  assert.deepEqual(p.tracked.map((t) => t.name), ['form_submit', 'generate_lead']);
  const leads = p.tracked.filter((t) => t.name === 'generate_lead');
  assert.equal(leads.length, 1, 'generate_lead fires once');
  assert.equal(note.textContent, 'Thank you — your request was received.');
  assert.equal(resets, 1);
  assert.equal(button.disabled, false, 're-enabled after the request settles');
});

test('a rejected response fires no generate_lead, shows the error text and re-enables the button', async () => {
  const p = page();
  const { form, note, button } = leadForm();
  p.calls.response = { headers: { get: () => 'rejected' } };
  mountLeadTracking(p.win, p.doc, { intercept: true });

  submit(p.doc, form, { submitter: button });
  await settle();

  assert.deepEqual(p.tracked.map((t) => t.name), ['form_submit']);
  assert.equal(note.textContent, 'Sorry — we could not receive that. Please try again.');
  assert.equal(button.disabled, false, 'the button is re-enabled');
});

test('a failed request fires no generate_lead, shows the error text and re-enables the button', async () => {
  const p = page();
  const { form, note, button } = leadForm();
  p.win.fetch = async () => { throw new Error('network down'); };
  mountLeadTracking(p.win, p.doc, { intercept: true });

  assert.doesNotThrow(() => submit(p.doc, form, { submitter: button }));
  await settle();

  assert.deepEqual(p.tracked.map((t) => t.name), ['form_submit']);
  assert.equal(note.textContent, 'Sorry — we could not receive that. Please try again.');
  assert.equal(button.disabled, false, 'the button is re-enabled');
});

test('nothing throws when rrTrack is absent', async () => {
  const p = page();
  delete p.win.rrTrack;
  const { form, note, button } = leadForm();
  p.calls.response = { headers: { get: () => 'accepted' } };

  assert.doesNotThrow(() => mountLeadTracking(p.win, p.doc, { intercept: true }));
  assert.doesNotThrow(() => submit(p.doc, form, { submitter: button }));
  await settle();
  assert.equal(note.textContent, 'Thank you — your request was received.');
});
