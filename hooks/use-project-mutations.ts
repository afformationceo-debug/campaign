'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { logActivity } from '@/lib/utils/log-activity';
import { useAuth } from '@/hooks/use-auth';
import type { Project, ProjectTask, ProjectState } from '@/lib/types/database';

// ─── Project CRUD ───────────────────────────────────────

interface CreateProjectInput {
  project_name: string;
  url?: string | null;
  assignee_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  state?: ProjectState;
  memo?: string | null;
  sort_order?: number;
}

interface UpdateProjectInput {
  id: string;
  project_name?: string;
  url?: string | null;
  assignee_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  state?: ProjectState;
  memo?: string | null;
  sort_order?: number;
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const { data, error } = await supabase
        .from('projects')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      logActivity({
        userId: profile?.id,
        actionType: 'insert',
        targetTable: 'projects',
        targetId: data.id,
        newValue: { project_name: data.project_name, state: data.state },
      });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateProjectInput) => {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.all });
      const previous = queryClient.getQueryData<Project[]>(queryKeys.projects.all);
      queryClient.setQueryData(queryKeys.projects.all, (old: Project[] | undefined) =>
        (old || []).map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.projects.all, context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      logActivity({
        userId: profile?.id,
        actionType: 'update',
        targetTable: 'projects',
        targetId: data.id,
        newValue: { project_name: data.project_name, state: data.state },
      });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      logActivity({
        userId: profile?.id,
        actionType: 'delete',
        targetTable: 'projects',
        targetId: id,
      });
    },
  });
}

// ─── Project Task CRUD ──────────────────────────────────

interface CreateProjectTaskInput {
  project_id: string;
  title: string;
  state?: ProjectState;
  assignee_id?: string | null;
  due_date?: string | null;
  sort_order?: number;
  memo?: string | null;
}

interface UpdateProjectTaskInput {
  id: string;
  project_id: string;
  title?: string;
  state?: ProjectState;
  assignee_id?: string | null;
  due_date?: string | null;
  sort_order?: number;
  memo?: string | null;
}

export function useCreateProjectTask() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateProjectTaskInput) => {
      const { data, error } = await supabase
        .from('project_tasks')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as ProjectTask;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectTasks.byProject(data.project_id),
      });
      logActivity({
        userId: profile?.id,
        actionType: 'insert',
        targetTable: 'project_tasks',
        targetId: data.id,
        newValue: { title: data.title, project_id: data.project_id },
      });
    },
  });
}

export function useUpdateProjectTask() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ id, project_id, ...updates }: UpdateProjectTaskInput) => {
      const { data, error } = await supabase
        .from('project_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { ...data, project_id } as ProjectTask;
    },
    onMutate: async ({ id, project_id, ...updates }) => {
      const key = queryKeys.projectTasks.byProject(project_id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ProjectTask[]>(key);
      queryClient.setQueryData(key, (old: ProjectTask[] | undefined) =>
        (old || []).map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous && context.key) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectTasks.byProject(data.project_id),
      });
      logActivity({
        userId: profile?.id,
        actionType: 'update',
        targetTable: 'project_tasks',
        targetId: data.id,
        newValue: { title: data.title, state: data.state },
      });
    },
  });
}

export function useDeleteProjectTask() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase.from('project_tasks').delete().eq('id', id);
      if (error) throw error;
      return { id, project_id };
    },
    onSuccess: ({ id, project_id }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectTasks.byProject(project_id),
      });
      logActivity({
        userId: profile?.id,
        actionType: 'delete',
        targetTable: 'project_tasks',
        targetId: id,
      });
    },
  });
}
