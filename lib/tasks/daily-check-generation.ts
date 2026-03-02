type CampaignLike = {
  id: string;
  status: string;
};

type TaskLike = {
  id: string;
  frequency: string;
  day_of_week: number[] | null;
  scope: string | null;
  parent_task_id: string | null;
  is_applicable_default: boolean | null;
};

type ConfigLike = {
  campaign_id: string;
  task_id: string;
  is_applicable: boolean;
};

type DailyCheckRecord = {
  campaign_id: string;
  task_id: string;
  check_date: string;
  status: '미완료';
};

type ExistingDailyCheckLike = {
  campaign_id: string | null;
  task_id: string;
  check_date: string;
};

interface BuildDailyCheckRecordsInput {
  today: string;
  dayOfWeek: number;
  currentDayOfMonth?: number;
  campaigns: CampaignLike[];
  tasks: TaskLike[];
  configs: ConfigLike[];
}

const SEOUL_WEEKDAY_TO_NUMBER: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function getSeoulDateContext(now: Date): {
  today: string;
  dayOfWeek: number;
  currentDayOfMonth: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  const today = `${year}-${month}-${day}`;

  const weekdayLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
  }).format(now);
  const dayOfWeek = SEOUL_WEEKDAY_TO_NUMBER[weekdayLabel] ?? 0;

  return {
    today,
    dayOfWeek,
    currentDayOfMonth: Number(day),
  };
}

export function excludeExistingDailyCheckRecords(
  records: DailyCheckRecord[],
  existingRows: ExistingDailyCheckLike[]
): DailyCheckRecord[] {
  const existingKeys = new Set(
    existingRows
      .filter((row) => row.campaign_id)
      .map((row) => `${row.campaign_id}:${row.task_id}:${row.check_date}`)
  );

  return records.filter(
    (record) => !existingKeys.has(`${record.campaign_id}:${record.task_id}:${record.check_date}`)
  );
}

export function buildDailyCheckRecords({
  today,
  dayOfWeek,
  currentDayOfMonth,
  campaigns,
  tasks,
  configs,
}: BuildDailyCheckRecordsInput): DailyCheckRecord[] {
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active');
  const applicableConfigMap = new Map<string, boolean>();

  configs.forEach((config) => {
    applicableConfigMap.set(`${config.campaign_id}:${config.task_id}`, config.is_applicable);
  });

  const currentDate = currentDayOfMonth ?? new Date(today).getDate();
  const todayTasks = tasks.filter((task) => {
    if (task.scope === 'global') return false;
    if (task.parent_task_id) return false;

    switch (task.frequency) {
      case 'daily':
        return true;
      case 'weekly':
        return task.day_of_week?.includes(dayOfWeek) ?? false;
      case 'monthly':
        return currentDate === 1;
      default:
        return false;
    }
  });

  return activeCampaigns.flatMap((campaign) => {
    return todayTasks.flatMap((task) => {
      const configValue = applicableConfigMap.get(`${campaign.id}:${task.id}`);
      const isApplicable = configValue ?? (task.is_applicable_default ?? true);

      if (!isApplicable) return [];

      return [{
        campaign_id: campaign.id,
        task_id: task.id,
        check_date: today,
        status: '미완료' as const,
      }];
    });
  });
}
