export type SummaryDimension =
  | 'all'
  | 'assignee'
  | 'campaign'
  | 'daily'
  | 'project'
  | 'qa'
  | 'config';

export interface SummaryRequest {
  dimension: SummaryDimension;
  date?: string; // YYYY-MM-DD, defaults to today
}

export const DIMENSION_LABELS: Record<SummaryDimension, string> = {
  all: '전체',
  assignee: '담당자별',
  campaign: '캠페인별',
  daily: '업무 결과',
  project: '프로젝트',
  qa: 'QA 관리',
  config: '캠페인 세팅',
};
