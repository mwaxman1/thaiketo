// Every lead form posts to the site's own route, not the provider. Run with:
//
//     node --test tests/
//
// Reads the source, no build: a form that posts straight to the provider
// navigates off-site, so the page can never observe acceptance, and a
// provider id in the page tells a bot where to post.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

test('every form under src/ posts to /api/lead-submit, and no page names the provider', () => {
  const files = readdirSync('src', { recursive: true })
    .filter((f) => f.endsWith('.astro'))
    .map((f) => join('src', f));

  let forms = 0;
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    assert.ok(
      !/sequenzy|o76kxb87r26dd3749df6ejqy/.test(src),
      `${file} names the provider; the id stays server-side`,
    );
    for (const m of src.matchAll(/<form\b[^>]*>/g)) {
      forms++;
      assert.match(m[0], /action="\/api\/lead-submit"/, `${file}: ${m[0]}`);
      assert.match(m[0], /method="POST"/, `${file}: ${m[0]}`);
      assert.match(m[0], /data-lead-form/, `${file}: ${m[0]}`);
    }
  }

  assert.equal(forms, 9, `expected the nine lead forms, found ${forms}`);
});
