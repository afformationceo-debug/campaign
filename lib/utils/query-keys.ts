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
    resultsByDate: (date: string) => ['checks', 'results', date] as const,
    resultsByDateAndUser: (date: string, userId: string) => ['checks', 'results', date, userId] as const,
    periodicResultsByMonth: (yearMonth: string) => ['checks', 'results', 'periodic', yearMonth] as const,
    periodicResultsByMonthAndUser: (yearMonth: string, userId: string) => ['checks', 'results', 'periodic', yearMonth, userId] as const,
    allResults: (userId?: string) => userId ? ['checks', 'results', 'all', userId] as const : ['checks', 'results', 'all'] as const,
    allPeriodicResults: (userId?: string) => userId ? ['checks', 'results', 'all-periodic', userId] as const : ['checks', 'results', 'all-periodic'] as const,
  },
  taskConfig: {
    all: ['taskConfig'] as const,
    byCampaign: (id: string) => ['taskConfig', id] as const,
  },
  configs: {
    all: ['configs'] as const,
    counts: ['configs', 'counts'] as const,
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
  qa: {
    all: ['qa'] as const,
    byCampaign: (campaignId: string) => ['qa', 'campaign', campaignId] as const,
    byStatus: (status: string) => ['qa', 'status', status] as const,
  },
  dashboard: {
    kpi: (date: string) => ['dashboard', 'kpi', date] as const,
    charts: (date: string) => ['dashboard', 'charts', date] as const,
  },
  platforms: {
    all: ['platforms'] as const,
    detail: (id: string) => ['platforms', id] as const,
  },
  manuals: {
    all: ['manuals'] as const,
    byPlatform: (platformId: string) => ['manuals', 'platform', platformId] as const,
  },
  onboardingManual: {
    all: ['onboardingManual'] as const,
  },
  campaignPlatforms: {
    all: ['campaignPlatforms'] as const,
    byCampaign: (campaignId: string) => ['campaignPlatforms', 'campaign', campaignId] as const,
  },
  taskSteps: {
    byTask: (taskId: string) => ['taskSteps', taskId] as const,
  },
  training: {
    all: ['training'] as const,
    byTask: (taskId: string) => ['training', 'task', taskId] as const,
    byUser: (userId: string) => ['training', 'user', userId] as const,
  },
  dailyReports: {
    byDate: (date: string) => ['dailyReports', date] as const,
    byDateAndUser: (date: string, userId: string) => ['dailyReports', date, userId] as const,
  },
  stepChecks: {
    byDailyCheck: (dailyCheckId: string) => ['stepChecks', dailyCheckId] as const,
    byDate: (date: string) => ['stepChecks', 'date', date] as const,
  },
  collabProducts: {
    all: ['collabProducts'] as const,
    detail: (id: string) => ['collabProducts', id] as const,
  },
  workflowTasks: {
    all: ['workflowTasks'] as const,
  },
  productDefaults: {
    all: ['productDefaults'] as const,
    byProduct: (productId: string) => ['productDefaults', productId] as const,
  },
  campaignProducts: {
    all: ['campaignProducts'] as const,
    byCampaign: (campaignId: string) => ['campaignProducts', campaignId] as const,
  },
  workflowChecks: {
    byCampaign: (campaignId: string) => ['workflowChecks', campaignId] as const,
    byCampaignProduct: (campaignId: string, productId: string) => ['workflowChecks', campaignId, productId] as const,
  },
};
