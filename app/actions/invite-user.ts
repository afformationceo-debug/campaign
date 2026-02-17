'use server';

import { createClient } from '@supabase/supabase-js';

export async function inviteUser(email: string, name: string, role: string, position: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: 'temp1234!',
    email_confirm: true,
  });

  if (authError) {
    return { error: authError.message };
  }

  // Create profile in users table
  const { error: profileError } = await supabase.from('users').insert({
    id: authData.user.id,
    name,
    email,
    role,
    position: position || null,
    is_active: true,
  });

  if (profileError) {
    return { error: profileError.message };
  }

  return { success: true, userId: authData.user.id };
}
