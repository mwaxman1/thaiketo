// Newsletter subscribe API endpoint (Loops placeholder)
// FLAG: Replace with real Loops API integration

export const prerender = false;

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = body.email?.trim();

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ success: false, message: 'Please enter a valid email address.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // FLAG: Wire up real Loops.so API call here
    // const LOOPS_API_KEY = import.meta.env.LOOPS_API_KEY;
    // await fetch('https://app.loops.so/api/v1/contacts/create', {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${LOOPS_API_KEY}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ email, source: body.referrer || 'website' })
    // });

    return new Response(JSON.stringify({ success: true, message: 'Thanks! Check your inbox to confirm your subscription.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify({ success: false, message: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
