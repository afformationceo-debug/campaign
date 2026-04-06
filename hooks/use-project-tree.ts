'use client';

import { useMemo } from 'react';
import type { Project, ProjectTask } from '@/lib/types/database';

// parent_project_id는 3단계 계층 구조 지원을 위해 추후 DB 마이그레이션으로 추가 예정
type ProjectWithParent = Project & { parent_project_id?: string | null };

export interface ProjectTreeNode {
  project: ProjectWithParent;
  subProjects: ProjectTreeNode[];
  tasks: ProjectTask[];
  stats: {
    totalTasks: number;
    completedTasks: number;
    progressPct: number;
    deepTotalTasks: number;
    deepCompletedTasks: number;
  };
}

export function useProjectTree(projects: ProjectWithParent[], tasks: ProjectTask[]) {
  return useMemo(() => {
    const tasksByProject = new Map<string, ProjectTask[]>();
    tasks.forEach((t) => {
      const existing = tasksByProject.get(t.project_id) || [];
      existing.push(t);
      tasksByProject.set(t.project_id, existing);
    });

    // Build tree nodes
    const nodeMap = new Map<string, ProjectTreeNode>();

    // First pass: create all nodes
    projects.forEach((p) => {
      const projectTasks = tasksByProject.get(p.id) || [];
      const completedTasks = projectTasks.filter((t) => t.state === '완료').length;
      nodeMap.set(p.id, {
        project: p,
        subProjects: [],
        tasks: projectTasks,
        stats: {
          totalTasks: projectTasks.length,
          completedTasks,
          progressPct: projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0,
          deepTotalTasks: projectTasks.length,
          deepCompletedTasks: completedTasks,
        },
      });
    });

    // Second pass: build parent-child relationships
    const roots: ProjectTreeNode[] = [];
    projects.forEach((p) => {
      const node = nodeMap.get(p.id)!;
      if (p.parent_project_id && nodeMap.has(p.parent_project_id)) {
        nodeMap.get(p.parent_project_id)!.subProjects.push(node);
      } else {
        roots.push(node);
      }
    });

    // Third pass: compute deep stats (bottom-up)
    const computeDeepStats = (node: ProjectTreeNode) => {
      node.subProjects.forEach(computeDeepStats);
      node.subProjects.forEach((child) => {
        node.stats.deepTotalTasks += child.stats.deepTotalTasks;
        node.stats.deepCompletedTasks += child.stats.deepCompletedTasks;
      });
      const total = node.stats.deepTotalTasks;
      node.stats.progressPct = total > 0 ? Math.round((node.stats.deepCompletedTasks / total) * 100) : 0;
    };
    roots.forEach(computeDeepStats);

    // Sort by sort_order
    roots.sort((a, b) => a.project.sort_order - b.project.sort_order);
    roots.forEach((root) => {
      root.subProjects.sort((a, b) => a.project.sort_order - b.project.sort_order);
    });

    return { roots, nodeMap, tasksByProject };
  }, [projects, tasks]);
}
