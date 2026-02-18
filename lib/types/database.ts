export type CampaignStatus = 'active' | 'paused' | 'completed';
export type CampaignPhase = 'onboarding' | 'running' | 'scaling';
export type TaskFrequency = 'daily' | 'weekly' | 'monthly' | 'once' | 'as_needed';
export type CheckStatus = '완료' | '진행중' | '미완료' | '해당없음';
export type UserRole = 'admin' | 'member';
export type TaskCategory = '보고' | '영업' | '온보딩' | '발송' | 'CS-인플' | 'CS-고객' | 'CRM' | '컨텐츠' | '회계';
export type TaskScope = 'campaign' | 'global';
export type ProjectState = '진행전' | '진행중' | '완료';
export type InterpreterStatus = '통역 필요 없음' | '돈받고 지원 (상시)' | '돈받고 지원 (요청시)' | '무료로 지원(요청시)' | '무료로 지원(상시)';

export interface Campaign {
  id: string;
  client_name: string;
  campaign_name: string;
  target_country: string | null;
  status: CampaignStatus;
  phase: CampaignPhase;
  budget: number | null;
  monthly_fixed_cost: number | null;
  cost_per_influencer: number | null;
  influencer_fee_budget: number | null;
  interpreter_status: InterpreterStatus | null;
  start_date: string | null;
  homepage_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  loop_order: number;
  task_name: string;
  description: string | null;
  tool: string | null;
  category: TaskCategory;
  default_assignees: string[] | null;
  frequency: TaskFrequency;
  day_of_week: number[] | null;
  is_applicable_default: boolean;
  scope: TaskScope;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  position: string | null;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CampaignTaskConfig {
  id: string;
  campaign_id: string;
  task_id: string;
  is_applicable: boolean;
  override_assignee: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyCheck {
  id: string;
  campaign_id: string | null;
  task_id: string;
  check_date: string;
  status: CheckStatus;
  assigned_user_id: string | null;
  note: string | null;
  result_value: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignConfig {
  id: string;
  campaign_id: string;
  config_type: string;
  config_key: string;
  config_value: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action_type: string;
  target_table: string | null;
  target_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface Project {
  id: string;
  project_name: string;
  url: string | null;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  state: ProjectState;
  memo: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  state: ProjectState;
  assignee_id: string | null;
  due_date: string | null;
  sort_order: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithTasks extends Project {
  project_tasks: ProjectTask[];
}

export interface ProjectWithAssignee extends Project {
  users: User | null;
}

// Join 타입
export interface DailyCheckWithRelations extends DailyCheck {
  campaigns: Campaign;
  tasks: Task;
  users: User | null;
}

export interface CampaignTaskConfigWithRelations extends CampaignTaskConfig {
  campaigns: Campaign;
  tasks: Task;
}
