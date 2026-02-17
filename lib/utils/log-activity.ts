import { createClient } from '@/lib/supabase/client';

interface LogActivityParams {
  userId?: string | null;
  actionType: string;
  targetTable: string;
  targetId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

export async function logActivity({
  userId,
  actionType,
  targetTable,
  targetId,
  oldValue = null,
  newValue = null,
}: LogActivityParams) {
  try {
    const supabase = createClient();
    await supabase.from('activity_logs').insert({
      user_id: userId ?? null,
      action_type: actionType,
      target_table: targetTable,
      target_id: targetId ?? null,
      old_value: oldValue,
      new_value: newValue,
    });
  } catch {
    // Silent fail - activity logging should never break the main flow
  }
}
