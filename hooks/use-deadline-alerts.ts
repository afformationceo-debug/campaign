'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Project, ProjectTask } from '@/lib/types/database';

export interface DeadlineAlert {
  id: string;
  name: string;
  dueDate: string;
  type: 'project' | 'task';
  status: 'overdue' | 'imminent' | 'ok';
  daysRemaining: number;
}

const EMPTY = { overdue: [] as DeadlineAlert[], imminent: [] as DeadlineAlert[], ok: [] as DeadlineAlert[], counts: { overdue: 0, imminent: 0, ok: 0 } };

export function useDeadlineAlerts(projects: Project[], tasks: ProjectTask[]) {
  // Client-only: prevent hydration mismatch from new Date()
  const [todayMs, setTodayMs] = useState(0);
  useEffect(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setTodayMs(now.getTime());
  }, []);

  return useMemo(() => {
    if (todayMs === 0) return EMPTY;

    const alerts: DeadlineAlert[] = [];

    projects.forEach((p) => {
      if (p.due_date && p.state !== '완료') {
        const due = new Date(p.due_date);
        due.setHours(0, 0, 0, 0);
        const diff = Math.ceil((due.getTime() - todayMs) / (1000 * 60 * 60 * 24));
        alerts.push({
          id: p.id,
          name: p.project_name,
          dueDate: p.due_date,
          type: 'project',
          status: diff < 0 ? 'overdue' : diff <= 3 ? 'imminent' : 'ok',
          daysRemaining: diff,
        });
      }
    });

    tasks.forEach((t) => {
      if (t.due_date && t.state !== '완료') {
        const due = new Date(t.due_date);
        due.setHours(0, 0, 0, 0);
        const diff = Math.ceil((due.getTime() - todayMs) / (1000 * 60 * 60 * 24));
        alerts.push({
          id: t.id,
          name: t.title,
          dueDate: t.due_date,
          type: 'task',
          status: diff < 0 ? 'overdue' : diff <= 3 ? 'imminent' : 'ok',
          daysRemaining: diff,
        });
      }
    });

    const overdue = alerts.filter((a) => a.status === 'overdue').sort((a, b) => a.daysRemaining - b.daysRemaining);
    const imminent = alerts.filter((a) => a.status === 'imminent').sort((a, b) => a.daysRemaining - b.daysRemaining);
    const ok = alerts.filter((a) => a.status === 'ok');

    return {
      overdue,
      imminent,
      ok,
      counts: { overdue: overdue.length, imminent: imminent.length, ok: ok.length },
    };
  }, [projects, tasks, todayMs]);
}
