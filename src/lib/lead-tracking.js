// lead-tracking.js — fires `form_submit` and the server-confirmed `generate_lead`.
//
// The server tells us, in the `x-lead-status` response header, whether the
// lead was actually accepted (`src/lib/lead-status.js`); `generate_lead` is
// fired on that confirmation and on nothing else. Analytics must never break
// a form: every entry point is wrapped in try/catch, nothing here calls
// `preventDefault` outside intercept mode, and the request body is never
// altered.
//
// Plain ESM, no imports: importable by `node --test`.

const LEAD_STATUS_HEADER = 'x-lead-status';

/**
 * A "lead request" resolves to the same origin as the page and its pathname
 * starts with `/api/lead-submit`.
 */
function makeIsLeadRequest(win) {
  return function isLeadRequest(url) {
    try {
      const page = new URL(win.location.href);
      const target = new URL(String(url), page.href);
      return target.origin === page.origin && target.pathname.startsWith('/api/lead-submit');
    } catch {
      return false;
    }
  };
}

/**
 * `accept: application/json` merged into a HeadersInit without clobbering
 * `content-type` or anything else the caller supplied. Any existing `accept`
 * key (case-insensitive) is dropped first so the merged init never carries
 * both `Accept` and `accept` — a `Headers` copy is already deduped by `set`.
 */
function mergeAccept(headers) {
  if (!headers) return { accept: 'application/json' };
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    const copy = new Headers(headers);
    copy.set('accept', 'application/json');
    return copy;
  }
  if (Array.isArray(headers)) {
    return headers
      .filter(function (entry) {
        return !(entry && String(entry[0]).toLowerCase() === 'accept');
      })
      .concat([['accept', 'application/json']]);
  }
  const merged = {};
  for (const key of Object.keys(headers)) {
    if (String(key).toLowerCase() !== 'accept') merged[key] = headers[key];
  }
  merged.accept = 'application/json';
  return merged;
}

/**
 * The confirmation note, which the mounting site may place OUTSIDE the form
 * (a sibling). Prefers a `[data-lead-status]` element inside the form, then
 * walks up to 3 ancestors looking for a `.kc-email-note` / `[data-lead-status]`
 * sibling; null when there is none.
 */
function findNote(form) {
  try {
    const inside = form.querySelector('[data-lead-status]');
    if (inside) return inside;
    let ancestor = form;
    for (let i = 0; i < 3; i++) {
      ancestor = ancestor.parentElement;
      if (!ancestor || !ancestor.parentElement) break;
      const note = ancestor.parentElement.querySelector('.kc-email-note, [data-lead-status]');
      if (note) return note;
    }
  } catch {
    /* analytics must never break a form */
  }
  return null;
}

export function mountLeadTracking(win = window, doc = document, options = {}) {
  try {
    const isLeadRequest = makeIsLeadRequest(win);
    let currentForm = null;

    /** `rrTrack(name, { form })` when the page provides it. */
    function fire(name, form) {
      try {
        if (typeof win.rrTrack === 'function') win.rrTrack(name, { form });
      } catch {
        /* analytics must never break a form */
      }
    }

    if (options.intercept === true) {
      // Intercept mode (the sibling repo's mode): the page has no submit
      // handler of its own, so this one owns the request. No fetch wrapper
      // is installed — the ORIGINAL fetch is used directly below.
      const originalFetch = win.fetch;
      doc.addEventListener(
        'submit',
        function (e) {
          try {
            const form = e.target;
            if (!form || form.tagName !== 'FORM' || !isLeadRequest(form.action)) return;
            e.preventDefault();
            fire('form_submit', form);

            const note = findNote(form);
            const button =
              e.submitter && e.submitter.tagName === 'BUTTON'
                ? e.submitter
                : form.querySelector('button[type="submit"], button:not([type])');
            const setBusy = (busy) => {
              try {
                if (button) button.disabled = busy;
              } catch {}
            };
            const show = (el, text) => {
              try {
                if (el) el.textContent = text;
              } catch {}
            };

            setBusy(true);
            originalFetch
              .call(win, form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: { accept: 'application/json' },
              })
              .then(function (res) {
                if (res && res.headers && res.headers.get(LEAD_STATUS_HEADER) === 'accepted') {
                  fire('generate_lead', form);
                  try {
                    form.reset();
                  } catch {}
                  show(note, 'Thank you — your request was received.');
                } else {
                  show(note, 'Sorry — we could not receive that. Please try again.');
                }
                setBusy(false);
              })
              .catch(function () {
                show(note, 'Sorry — we could not receive that. Please try again.');
                setBusy(false);
              });
          } catch {
            /* analytics must never break a form */
          }
        },
        true,
      );
      return;
    }

    // Passive mode (this repo's mode): the page's own handlers own the
    // request. This only listens and wraps fetch; it never calls
    // preventDefault and never touches the body.
    doc.addEventListener(
      'submit',
      function (e) {
        try {
          const form = e.target;
          if (!form || form.tagName !== 'FORM' || !isLeadRequest(form.action)) return;
          fire('form_submit', form);
          currentForm = form;
        } catch {
          /* analytics must never break a form */
        }
      },
      true,
    );

    const originalFetch = win.fetch;
    if (typeof originalFetch !== 'function' || originalFetch.__leadTracking) return;
    const wrapped = function (input, init) {
      try {
        let url = input;
        if (input && typeof input === 'object' && 'url' in input) url = input.url;
        if (!isLeadRequest(url)) return originalFetch.apply(win, arguments);
        const mergedInit = Object.assign({}, init, { headers: mergeAccept(init && init.headers) });
        return originalFetch
          .call(win, input, mergedInit)
          .then(function (res) {
            try {
              if (res && res.headers && res.headers.get(LEAD_STATUS_HEADER) === 'accepted') {
                fire('generate_lead', currentForm);
              }
            } catch {
              /* analytics must never break a form */
            }
            return res;
          });
      } catch (err) {
        // The original fetch threw; the caller must see exactly that.
        throw err;
      }
    };
    try {
      Object.defineProperty(wrapped, '__leadTracking', { value: true });
    } catch {}
    win.fetch = wrapped;
  } catch {
    /* analytics must never break a form */
  }
}
