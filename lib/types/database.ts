export type CampaignStatus = 'active' | 'paused' | 'completed';
export type CampaignPhase = 'onboarding' | 'running' | 'scaling';
export type TaskFrequency = 'daily' | 'weekly' | 'monthly' | 'once' | 'as_needed';
export type CheckStatus = '완료' | '진행중' | '미완료' | '해당없음';
export type UserRole = 'admin' | 'member';
export type TaskCategory = '보고' | '영업' | '온보딩' | '발송' | 'CS-인플' | 'CS-고객' | 'CRM' | '컨텐츠' | '회계' | '이커머스';
export type TaskScope = 'campaign' | 'global';
export type TaskPriority = '긴급' | '높음' | '보통' | '낮음';
export type ProjectState = '진행전' | '진행중' | '완료';
export type InterpreterStatus = '통역 필요 없음' | '돈받고 지원 (상시)' | '돈받고 지원 (요청시)' | '무료로 지원(요청시)' | '무료로 지원(상시)';
export type CampaignType = '해외마케팅' | '국내챗닥' | '제품브랜드';
export type VatType = 'VAT별도' | 'VAT포함';
export type ChatdocStatus = '대기' | '온보딩중' | '운영중' | '종료';
export type BrandPhase = '기획' | '플랫폼세팅' | '인플루언서기획' | '운영' | '스케일링';
export type SetupStatus = '미시작' | '진행중' | '완료';
export type ManualType = '세팅가이드' | '운영가이드' | 'FAQ' | '트러블슈팅';

export interface Campaign {
  id: string;
  client_name: string;
  campaign_name: string;
  campaign_type: CampaignType;
  target_country: string | null;
  status: CampaignStatus;
  phase: CampaignPhase;
  monthly_fixed_cost: number | null;
  cost_per_influencer: number | null;
  influencer_fee_budget: number | null;
  commission_rate: number | null;
  vat_type: VatType | null;
  interpreter_status: InterpreterStatus | null;
  start_date: string | null;
  homepage_url: string | null;
  // 국내챗닥 전용
  chatdoc_onboarding_done: boolean | null;
  chatdoc_roas_target: number | null;
  chatdoc_status: ChatdocStatus | null;
  // 제품브랜드 전용
  target_countries: string[] | null;
  product_category: string | null;
  brand_budget: number | null;
  brand_phase: BrandPhase | null;
  created_at: string;
  updated_at: string;
}

export interface EcommercePlatform {
  id: string;
  platform_name: string;
  available_countries: string[];
  platform_url: string | null;
  seller_url: string | null;
  logo_emoji: string | null;
  description: string | null;
  fee_structure: string | null;
  setup_difficulty: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlatformManual {
  id: string;
  platform_id: string;
  title: string;
  content: string;
  manual_type: ManualType;
  country: string | null;
  author_id: string | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignPlatform {
  id: string;
  campaign_id: string;
  platform_id: string;
  country: string;
  setup_status: SetupStatus;
  shop_url: string | null;
  account_info: Record<string, unknown>;
  assigned_user_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformManualWithPlatform extends PlatformManual {
  ecommerce_platforms: EcommercePlatform;
}

export interface CampaignPlatformWithRelations extends CampaignPlatform {
  ecommerce_platforms: EcommercePlatform;
  users: User | null;
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
  parent_task_id: string | null;
  sub_order: number;
  priority: TaskPriority;
  estimated_minutes: number | null;
  instruction_url: string | null;
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
  target_count: number | null;
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
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ConfigValueType = 'text' | 'url' | 'status' | 'credentials';

export interface PlatformCredential {
  platform: string;
  username: string;
  password: string;
  owner?: string;
}

export interface CampaignConfig {
  id: string;
  campaign_id: string;
  config_type: string;
  config_key: string;
  config_value: string | null;
  value_type: ConfigValueType;
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
  result_value: string | null;
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
  start_date: string | null;
  due_date: string | null;
  sort_order: number;
  memo: string | null;
  result_value: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithTasks extends Project {
  project_tasks: ProjectTask[];
}

export interface ProjectWithAssignee extends Project {
  users: User | null;
}

export type QaType = '요청사항' | '불만사항' | '개선사항' | '버그' | '기타';
export type QaStatus = '미해결' | '진행중' | '해결완료';
export type QaPriority = '긴급' | '높음' | '보통' | '낮음';

export interface CampaignQa {
  id: string;
  campaign_id: string;
  qa_type: QaType;
  content: string;
  due_date: string | null;
  status: QaStatus;
  resolution: string | null;
  priority: QaPriority;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignQaWithCampaign extends CampaignQa {
  campaigns: Campaign;
}

export interface OnboardingManualSection {
  id: string;
  section_number: number;
  section_title: string;
  content: string;
  sort_order: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskStep {
  id: string;
  task_id: string;
  step_order: number;
  step_name: string;
  step_description: string | null;
  tool_url: string | null;
  created_at: string;
}

// ── 교육 이수 추적 ──
export interface TaskTraining {
  id: string;
  task_id: string;
  user_id: string;
  is_trained: boolean;
  trained_at: string | null;
  trainer_id: string | null;
  steps_confirmed: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

// ── 일일 보고서 ──
export type ReportStatus = '미제출' | '제출완료' | '확인완료';

export interface DailyReport {
  id: string;
  user_id: string;
  report_date: string;
  summary: string | null;
  impact_summary: string | null;
  issues: string | null;
  support_needed: string | null;
  tomorrow_plan: string | null;
  status: ReportStatus;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Step별 완료 추적 ──
export interface StepCheck {
  id: string;
  daily_check_id: string;
  step_id: string;
  is_completed: boolean;
  result_value: string | null;
  completed_at: string | null;
  created_at: string;
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

export interface TaskTrainingWithRelations extends TaskTraining {
  tasks: Task;
  users: User;
  trainer: User | null;
}

export interface DailyReportWithUser extends DailyReport {
  users: User;
}

// ── 협업상품 & 워크플로우 ──
export type WorkflowSection = '영업' | '온보딩' | '인플루언서' | '일반고객 CS 대행';
export type WorkflowCheckStatus = '진행전' | '진행중' | '완료' | '해당없음';

export interface CollaborationProduct {
  id: string;
  product_name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTask {
  id: string;
  task_number: number;
  section: WorkflowSection;
  task_name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ProductTaskDefault {
  id: string;
  product_id: string;
  workflow_task_id: string;
  is_required: boolean;
  created_at: string;
}

export interface CampaignProduct {
  id: string;
  campaign_id: string;
  product_id: string;
  created_at: string;
}

export interface CampaignWorkflowCheck {
  id: string;
  campaign_id: string;
  product_id: string;
  workflow_task_id: string;
  status: WorkflowCheckStatus;
  note: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignProductWithProduct extends CampaignProduct {
  collaboration_products: CollaborationProduct;
}

export interface CampaignWorkflowCheckWithTask extends CampaignWorkflowCheck {
  workflow_tasks: WorkflowTask;
}
