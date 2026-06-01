import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.106.2';
import { jsonResponse } from './cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'student' | 'teacher' | 'admin';
  status: 'active' | 'disabled';
};

export function serviceClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireManager(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return { error: jsonResponse({ error: 'Unauthorized' }, 401) };
  }

  const admin = serviceClient();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,email,full_name,role,status')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.status !== 'active') {
    return { error: jsonResponse({ error: 'Profile not allowed' }, 403) };
  }

  if (!['teacher', 'admin'].includes(profile.role)) {
    return { error: jsonResponse({ error: 'Manager role required' }, 403) };
  }

  return { admin, user, profile: profile as Profile };
}

export function canManageRole(actor: Profile, targetRole: string) {
  if (actor.role === 'admin') return ['student', 'teacher', 'admin'].includes(targetRole);
  return targetRole === 'student';
}

export function temporaryPassword() {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}
