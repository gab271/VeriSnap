/**
 * revenuecat-webhook — the only thing allowed to grant a paid plan.
 *
 * The client never decides whether it is premium. RevenueCat calls this function
 * when a subscription starts, renews, lapses, or is refunded, and only this
 * function (holding the service_role key) writes `profiles.is_premium`. That is
 * what makes the free-tier limit unbypassable: a tampered app can claim anything
 * it likes and the database still refuses the insert.
 *
 * SECURITY: RevenueCat is configured with an Authorization header value that we
 * store as a secret. Requests that do not present it are rejected, so nobody can
 * POST themselves a subscription. The comparison is length-safe and constant-time
 * to avoid leaking the secret through timing.
 *
 * Deploy:
 *   npx supabase functions deploy revenuecat-webhook --no-verify-jwt
 *   (--no-verify-jwt because RevenueCat authenticates with the shared secret
 *    below, not a Supabase user JWT.)
 * Required secret:
 *   REVENUECAT_WEBHOOK_SECRET
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Events that should grant or extend access. */
const GRANTING = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
]);

/** Events that should revoke access immediately. */
const REVOKING = new Set(['CANCELLATION', 'EXPIRATION', 'SUBSCRIPTION_PAUSED', 'REFUND']);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Constant-time compare so a wrong secret cannot be guessed by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Map a RevenueCat product/entitlement onto our plan names. */
function planFor(event: Record<string, unknown>): 'premium' | 'pro' {
  const productId = String(event.product_id ?? '').toLowerCase();
  return productId.includes('pro') ? 'pro' : 'premium';
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!expectedSecret) return json({ error: 'REVENUECAT_WEBHOOK_SECRET is not set' }, 500);

  const presented = req.headers.get('Authorization') ?? '';
  if (!safeEqual(presented, expectedSecret)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Supabase environment not configured' }, 500);
  }

  let event: Record<string, unknown>;
  try {
    const body = await req.json();
    event = (body?.event ?? {}) as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const type = String(event.type ?? '');
  // app_user_id is the Supabase user id — we set it when configuring the SDK.
  const userId = String(event.app_user_id ?? '');
  if (!userId) return json({ error: 'Missing app_user_id' }, 400);

  const admin = createClient(supabaseUrl, serviceKey);

  let update: Record<string, unknown> | null = null;

  if (GRANTING.has(type)) {
    const expiresMs = Number(event.expiration_at_ms ?? 0);
    update = {
      is_premium: true,
      plan: planFor(event),
      premium_expires_at: expiresMs > 0 ? new Date(expiresMs).toISOString() : null,
      revenuecat_user_id: userId,
    };
  } else if (REVOKING.has(type)) {
    // Revoke immediately. Being strict here is the safe direction: the worst case
    // is a paying user briefly sees the free limit, which support can fix — the
    // opposite error gives away the product.
    update = {
      is_premium: false,
      plan: 'free',
      premium_expires_at: null,
      revenuecat_user_id: userId,
    };
  }

  // Unhandled event types (TRANSFER, BILLING_ISSUE, TEST...) are acknowledged so
  // RevenueCat does not retry them forever.
  if (!update) return json({ status: 'ignored', type });

  const { error } = await admin.from('profiles').update(update).eq('id', userId);
  if (error) return json({ error: error.message }, 500);

  return json({ status: 'applied', type, userId });
});
