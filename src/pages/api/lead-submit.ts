import type { APIRoute } from 'astro';
import { leadResponse } from '../../lib/lead-status.js';

export const prerender = false;

// The lead endpoint. The forms post HERE, not to the provider, so the page
// can be told — honestly — whether the lead was accepted (the
// `x-lead-status` header) and fire `generate_lead` on that and nothing else.

const PROVIDER_FORM_URL = 'https://api.sequenzy.com/api/v1/forms/o76kxb87r26dd3749df6ejqy';
const THANK_YOU = '/?subscribed=1';

function normalizeHost(host: string): string {
  const bare = host.trim().toLowerCase().split(':')[0] ?? '';
  return bare.startsWith('www.') ? bare.slice(4) : bare;
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // a server-side client; a browser always sends one
  const forwarded = request.headers.get('x-forwarded-host');
  const site = forwarded ? forwarded.split(',')[0]!.trim() : new URL(request.url).host;
  try {
    return normalizeHost(new URL(origin).host) === normalizeHost(site);
  } catch {
    return false;
  }
}

async function forwardToProvider(form: FormData): Promise<boolean> {
  const body = [...form.entries()]
    .filter(([, value]): value is string => typeof value === 'string')
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
    accept: 'application/json',
  };
  const key = process.env.SEQUENZY_API_KEY;
  if (key) headers.authorization = `Bearer ${key}`;

  try {
    const response = await fetch(PROVIDER_FORM_URL, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.error('[lead-submit] provider refused the submission', response.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      '[lead-submit] provider unreachable:',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOrigin(request)) {
    return new Response('cross-origin submission refused', { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response('malformed submission', { status: 400 });
  }

  const accepted = await forwardToProvider(form);
  return leadResponse(accepted ? 'accepted' : 'unavailable', {
    accept: request.headers.get('accept'),
    thankYou: THANK_YOU,
  });
};
