import type { TaskCategory } from '@/lib/types/database';

// bkit-style: Neutral-first color system with subtle differentiation
export const CATEGORY_COLORS: Record<TaskCategory, {
  bg: string;
  text: string;
  border: string;
  darkBg: string;
}> = {
  '보고': { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200', darkBg: 'dark:bg-neutral-800/40' },
  '영업': { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200', darkBg: 'dark:bg-neutral-800/40' },
  '온보딩': { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200', darkBg: 'dark:bg-neutral-800/40' },
  '발송': { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200', darkBg: 'dark:bg-neutral-800/40' },
  'CS-인플': { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200', darkBg: 'dark:bg-neutral-800/40' },
  'CS-고객': { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200', darkBg: 'dark:bg-neutral-800/40' },
  'CRM': { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200', darkBg: 'dark:bg-neutral-800/40' },
  '컨텐츠': { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200', darkBg: 'dark:bg-neutral-800/40' },
  '회계': { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200', darkBg: 'dark:bg-neutral-800/40' },
  '이커머스': { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200', darkBg: 'dark:bg-neutral-800/40' },
};

export const CATEGORY_ORDER: TaskCategory[] = [
  '보고', '영업', '온보딩', '발송', 'CS-인플', 'CS-고객', 'CRM', '컨텐츠', '회계', '이커머스',
];
