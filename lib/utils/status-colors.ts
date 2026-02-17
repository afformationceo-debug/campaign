import type { CheckStatus } from '@/lib/types/database';

export const STATUS_COLORS: Record<CheckStatus, {
  bg: string;
  text: string;
  darkBg: string;
  ring: string;
}> = {
  '완료': {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    darkBg: 'dark:bg-emerald-900/30',
    ring: 'ring-emerald-500',
  },
  '진행중': {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    darkBg: 'dark:bg-amber-900/30',
    ring: 'ring-amber-500',
  },
  '미완료': {
    bg: 'bg-red-100',
    text: 'text-red-700',
    darkBg: 'dark:bg-red-900/30',
    ring: 'ring-red-500',
  },
  '해당없음': {
    bg: 'bg-gray-100',
    text: 'text-gray-400',
    darkBg: 'dark:bg-gray-800/30',
    ring: 'ring-gray-300',
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
