import type { CheckStatus } from '@/lib/types/database';

export const STATUS_COLORS: Record<CheckStatus, {
  bg: string;
  text: string;
  darkBg: string;
  ring: string;
  dot: string;
}> = {
  '완료': {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    darkBg: 'dark:bg-emerald-950/20',
    ring: 'ring-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  '진행중': {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    darkBg: 'dark:bg-amber-950/20',
    ring: 'ring-amber-500/30',
    dot: 'bg-amber-500',
  },
  '미완료': {
    bg: 'bg-secondary',
    text: 'text-muted-foreground',
    darkBg: 'dark:bg-secondary',
    ring: 'ring-border',
    dot: 'bg-muted-foreground/30',
  },
  '해당없음': {
    bg: 'bg-secondary/50',
    text: 'text-muted-foreground/50',
    darkBg: 'dark:bg-secondary/30',
    ring: 'ring-border/50',
    dot: 'bg-muted-foreground/20',
  },
};

export const STATUS_LABELS: Record<CheckStatus, string> = {
  '완료': 'Done',
  '진행중': 'In Progress',
  '미완료': 'Pending',
  '해당없음': 'N/A',
};

export function getNextStatus(current: CheckStatus): CheckStatus {
  const cycle: CheckStatus[] = ['미완료', '진행중', '완료', '해당없음'];
  const idx = cycle.indexOf(current);
  if (idx === -1) return '미완료';
  return cycle[(idx + 1) % cycle.length];
}
