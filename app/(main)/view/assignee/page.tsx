'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { CATEGORY_ORDER } from '@/lib/utils/category-colors';
import { useAuth } from '@/hooks/use-auth';
import { FilterBar } from '@/components/views/filter-bar';
import { AssigneeGrid } from '@/components/views/assignee-grid';
import type { User, TaskCategory } from '@/lib/types/database';

export default function AssigneeViewPage() {
  const { profile, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<TaskCategory[]>(
    () => [...CATEGORY_ORDER]
  );

  // Set default assignee to current user once loaded
  const [defaultSet, setDefaultSet] = useState(false);
  if (!defaultSet && profile && !authLoading) {
    setAssigneeId(profile.id);
    setDefaultSet(true);
  }

  // Fetch active users
  const { data: users = [] } = useQuery({
    queryKey: queryKeys.users.active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as User[];
    },
  });

  // Memoize categories for FilterBar
  const allCategories = useMemo(() => [...CATEGORY_ORDER], []);

  // Resolve selected user's name for task filtering
  const assigneeName = useMemo(() => {
    if (!assigneeId) return null;
    return users.find((u) => u.id === assigneeId)?.name ?? null;
  }, [assigneeId, users]);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">
          담당자별 일일 체크
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          담당자가 맡은 캠페인의 업무 진행 상황을 한눈에 확인하고 체크할 수 있습니다.
        </p>
      </div>

      {/* Filter Bar */}
      <FilterBar
        date={date}
        onDateChange={setDate}
        users={users}
        selectedUserId={assigneeId}
        onUserChange={setAssigneeId}
        categories={allCategories}
        selectedCategories={selectedCategories}
        onCategoryChange={setSelectedCategories}
      />

      {/* Grid */}
      <AssigneeGrid
        date={date}
        assigneeId={assigneeId}
        assigneeName={assigneeName}
        categories={selectedCategories}
      />
    </div>
  );
}
