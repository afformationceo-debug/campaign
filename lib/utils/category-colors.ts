import type { TaskCategory } from '@/lib/types/database';

export const CATEGORY_COLORS: Record<TaskCategory, {
  bg: string;
  text: string;
  border: string;
  darkBg: string;
}> = {
  '보고': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', darkBg: 'dark:bg-blue-950/40' },
  '영업': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', darkBg: 'dark:bg-purple-950/40' },
  '온보딩': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', darkBg: 'dark:bg-orange-950/40' },
  '발송': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', darkBg: 'dark:bg-cyan-950/40' },
  'CS-인플': { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', darkBg: 'dark:bg-pink-950/40' },
  'CS-고객': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', darkBg: 'dark:bg-rose-950/40' },
  'CRM': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', darkBg: 'dark:bg-indigo-950/40' },
  '컨텐츠': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', darkBg: 'dark:bg-teal-950/40' },
  '회계': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', darkBg: 'dark:bg-yellow-950/40' },
  '이커머스': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', darkBg: 'dark:bg-emerald-950/40' },
};

export const CATEGORY_ORDER: TaskCategory[] = [
  '보고', '영업', '온보딩', '발송', 'CS-인플', 'CS-고객', 'CRM', '컨텐츠', '회계', '이커머스',
];
