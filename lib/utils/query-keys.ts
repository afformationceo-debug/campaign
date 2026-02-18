export const queryKeys = {
  campaigns: {
    all: ['campaigns'] as const,
    active: ['campaigns', 'active'] as const,
    detail: (id: string) => ['campaigns', id] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    byCategory: (cat: string) => ['tasks', 'category', cat] as const,
  },
  users: {
    all: ['users'] as const,
    active: ['users', 'active'] as const,
  },
  checks: {
    byDate: (date: string) => ['checks', date] as const,
    byDateAndUser: (date: string, userId: string) => ['checks', date, userId] as const,
    byMonth: (yearMonth: string) => ['checks', 'month', yearMonth] as const,
    byMonthAndUser: (yearMonth: string, userId: string) => ['checks', 'month', yearMonth, userId] as const,
    onceCompleted: ['checks', 'once-completed'] as const,
  },
  taskConfig: {
    all: ['taskConfig'] as const,
    byCampaign: (id: string) => ['taskConfig', id] as const,
  },
  configs: {
    all: ['configs'] as const,
    byCampaign: (id: string) => ['configs', id] as const,
  },
  logs: {
    all: ['logs'] as const,
    filtered: (filters: object) => ['logs', filters] as const,
  },
  projects: {
    all: ['projects'] as const,
    detail: (id: string) => ['projects', id] as const,
    withTasks: (id: string) => ['projects', id, 'tasks'] as const,
  },
  projectTasks: {
    byProject: (projectId: string) => ['projectTasks', projectId] as const,
  },
  dashboard: {
    kpi: (date: string) => ['dashboard', 'kpi', date] as const,
    charts: (date: string) => ['dashboard', 'charts', date] as const,
  },
};
