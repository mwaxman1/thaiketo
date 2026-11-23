// lead-status.js — the explicit lead-acceptance contract.
//
// A JSON client (fetch with accept: application/json) gets the outcome in the
// body AND the `x-lead-status` header, so the browser can honestly fire
// `generate_lead` only when the lead was accepted. An HTML client (a form
// posting without JS) still gets the 303 to the thank-you page, with the
// same header for anyone looking. A rejected bot is deliberately told
// nothing: it sees the same success shape a human sees.
//
// Plain ESM, no imports: importable by `node --test`.

export const LEAD_STATUS_HEADER = 'x-lead-status';

/** True iff the client asked for JSON. */
export function wantsJson(accept) {
  return String(accept ?? '').toLowerCase().includes('application/json');
}

const OUTCOMES = new Set(['accepted', 'rejected', 'unavailable']);

/**
 * The terminal response for a lead submission.
 *
 * @param {'accepted'|'rejected'|'unavailable'} outcome
 * @param {{ accept?: string | null, thankYou: string }} opts
 * @returns {Response}
 */
export function leadResponse(outcome, { accept, thankYou }) {
  const status = OUTCOMES.has(outcome) ? outcome : 'unavailable';
  const json = wantsJson(accept);
  const headers = {
    [LEAD_STATUS_HEADER]: status,
    'cache-control': 'no-store',
  };

  if (status === 'unavailable') {
    return json
      ? new Response(JSON.stringify({ ok: false, status }), {
          status: 502,
          headers: { ...headers, 'content-type': 'application/json' },
        })
      : new Response('lead capture unavailable', {
          status: 502,
          headers: { ...headers, 'content-type': 'text/plain' },
        });
  }

  return json
    ? new Response(JSON.stringify({ ok: true, status }), {
        status: 200,
        headers: { ...headers, 'content-type': 'application/json' },
      })
    : new Response(null, {
        status: 303,
        headers: { ...headers, location: thankYou, 'content-type': 'text/plain' },
      });
}
