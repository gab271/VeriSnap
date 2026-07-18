/**
 * delete-account — permanent erasure of a user and everything they filed.
 *
 * WHY THIS EXISTS AS A FUNCTION: a client can never delete an auth user, and it
 * must not be able to. Deletion needs the service_role key, so it happens here,
 * and only for the authenticated caller's own account — the user id comes from
 * the verified JWT, never from the request body.
 *
 * THE TENSION THIS RESOLVES: evidence is deliberately append-only. There is no
 * UPDATE or DELETE policy on `evidence_records`, so nobody — not even the person
 * who filed it — can quietly alter or remove a record. That is the property the
 * whole product rests on. But GDPR gives people a right to erasure, and Apple
 * requires in-app account deletion. We resolve it at the account level rather
 * than the record level: individual records stay immutable for as long as the
 * account exists, and deleting the account removes everything at once. There is
 * no partial delete, and no way to erase one inconvenient record while keeping
 * the rest — which would be exactly the tampering the product exists to prevent.
 *
 * Order matters: storage objects are removed FIRST. Deleting the auth user
 * cascades the database rows, and once those rows are gone we no longer know
 * which files belonged to them, which would leave orphans nobody can find.
 *
 * Deploy:
 *   npx supabase functions deploy delete-account
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'evidence';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'Supabase environment not configured' }, 500);
  }

  // Identity comes from the token, never the body — otherwise this endpoint
  // would let anyone delete anyone.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: 'Unauthorized' }, 401);

  const userId = userData.user.id;
  const admin = createClient(supabaseUrl, serviceKey);

  // 1. Remove stored media first, while we still know which files are theirs.
  const { data: records } = await admin
    .from('evidence_records')
    .select('storage_path')
    .eq('user_id', userId);

  const paths = (records ?? []).map((r) => r.storage_path as string).filter(Boolean);
  if (paths.length > 0) {
    const { error: storageError } = await admin.storage.from(BUCKET).remove(paths);
    if (storageError) {
      // Stop rather than delete the account and strand the files: a retry is
      // recoverable, orphaned media that nobody can locate is not.
      return json({ error: `Could not remove stored media: ${storageError.message}` }, 500);
    }
  }

  // 2. Delete the auth user. `on delete cascade` removes evidence_records and
  //    profiles, so this single call clears the remaining personal data.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return json({ error: deleteError.message }, 500);

  return json({ status: 'deleted', removedFiles: paths.length });
});
