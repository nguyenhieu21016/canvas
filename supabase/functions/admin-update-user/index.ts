import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { canManageRole, requireManager } from '../_shared/auth.ts';

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
    const nextRole = body.role ?? target.role;

    if (!canManageRole(context.profile, target.role) || !canManageRole(context.profile, nextRole)) {
      return jsonResponse({ error: 'Cannot update this user' }, 403);
    }

    if (body.email) {
      const { error: authError } = await context.admin.auth.admin.updateUserById(body.id, {
        email: body.email,
      });
      if (authError) return jsonResponse({ error: authError.message }, 400);
    }

    const { data, error } = await context.admin
      .from('profiles')
      .update({
        email: body.email,
        full_name: body.full_name,
        role: nextRole,
        status: body.status ?? 'active',
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ profile: data });
  } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }
});
