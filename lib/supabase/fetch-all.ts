import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;

/**
 * Fetch all rows from a table, paginating past PostgREST's row limit.
 */
export async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  options?: { column?: string; ascending?: boolean }
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(table)
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1);

    if (options?.column) {
      query = query.order(options.column, { ascending: options.ascending ?? true });
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as T[];
    all.push(...rows);

    if (rows.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += PAGE_SIZE;
    }
  }

  return all;
}
