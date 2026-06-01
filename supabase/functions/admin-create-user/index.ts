import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { canManageRole, requireManager } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const context = await requireManager(req);
  if ('error' in context) return context.error;

  try {
    const body = await req.json();
    const role = body.role ?? 'student';
    if (!canManageRole(context.profile, role)) {
      return jsonResponse({ error: 'Cannot create this role' }, 403);
    }

    const { data, error } = await context.admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name ?? '' },
    });

    if (error) return jsonResponse({ error: error.message }, 400);

    const { error: profileError } = await context.admin.from('profiles').upsert({
      id: data.user.id,
      email: body.email,
      full_name: body.full_name ?? '',
      role,
      status: 'active',
    });

    if (profileError) return jsonResponse({ error: profileError.message }, 400);

    return jsonResponse({ user: data.user });
  } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }
});
