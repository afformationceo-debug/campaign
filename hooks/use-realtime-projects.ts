'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import type { Project, ProjectTask } from '@/lib/types/database';

export function useRealtimeProjects() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  useEffect(() => {
    const projectsChannel = supabase
      .channel('projects-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        (payload) => {
          const key = queryKeys.projects.all;
          switch (payload.eventType) {
            case 'INSERT':
              queryClient.setQueryData(key, (old: Project[] | undefined) =>
                [...(old || []), payload.new as Project]
              );
              break;
            case 'UPDATE':
              queryClient.setQueryData(key, (old: Project[] | undefined) =>
                (old || []).map((item) =>
                  item.id === (payload.new as Project).id
                    ? (payload.new as Project)
                    : item
                )
              );
              break;
            case 'DELETE':
              queryClient.setQueryData(key, (old: Project[] | undefined) =>
                (old || []).filter((item) => item.id !== (payload.old as Project).id)
              );
              break;
          }
        }
      )
      .subscribe();

    const tasksChannel = supabase
      .channel('project-tasks-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_tasks' },
        (payload) => {
          // Invalidate all project task queries since we don't know which project-specific key to update
          queryClient.invalidateQueries({ queryKey: ['projectTasks'] });

          // Also update specific project task list if we know the project_id
          const record = (payload.new ?? payload.old) as ProjectTask;
          if (record?.project_id) {
            const key = queryKeys.projectTasks.byProject(record.project_id);
            switch (payload.eventType) {
              case 'INSERT':
                queryClient.setQueryData(key, (old: ProjectTask[] | undefined) =>
                  [...(old || []), payload.new as ProjectTask]
                );
                break;
              case 'UPDATE':
                queryClient.setQueryData(key, (old: ProjectTask[] | undefined) =>
                  (old || []).map((item) =>
                    item.id === (payload.new as ProjectTask).id
                      ? (payload.new as ProjectTask)
                      : item
                  )
                );
                break;
              case 'DELETE':
                queryClient.setQueryData(key, (old: ProjectTask[] | undefined) =>
                  (old || []).filter((item) => item.id !== (payload.old as ProjectTask).id)
                );
                break;
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(projectsChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, [queryClient]);
}
