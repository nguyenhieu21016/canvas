import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { canManageRole, requireManager } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const context = await requireManager(req);
  if ('error' in context) return context.error;

  try {
    const body = await req.json();
    if (body.id === context.user.id) {
      return jsonResponse({ error: 'Cannot delete yourself' }, 400);
    }

    const { data: target, error: targetError } = await context.admin
      .from('profiles')
      .select('id,role')
      .eq('id', body.id)
      .single();

    if (targetError || !target) return jsonResponse({ error: 'Target user not found' }, 404);
    if (!canManageRole(context.profile, target.role)) {
      return jsonResponse({ error: 'Cannot delete this user' }, 403);
    }

    const { error } = await context.admin.auth.admin.deleteUser(body.id);
    if (error) return jsonResponse({ error: error.message }, 400);

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }
});
