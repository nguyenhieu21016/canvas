import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { canManageRole, requireManager, temporaryPassword } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const context = await requireManager(req);
  if ('error' in context) return context.error;

  try {
    const body = await req.json();
    const { data: target, error: targetError } = await context.admin
      .from('profiles')
      .select('id,role')
      .eq('id', body.id)
      .single();

    if (targetError || !target) return jsonResponse({ error: 'Target user not found' }, 404);
    if (!canManageRole(context.profile, target.role)) {
      return jsonResponse({ error: 'Cannot reset this user' }, 403);
    }

    const password = body.password || temporaryPassword();
    const { error } = await context.admin.auth.admin.updateUserById(body.id, { password });
    if (error) return jsonResponse({ error: error.message }, 400);

    return jsonResponse({ temporaryPassword: password });
  } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }
});
