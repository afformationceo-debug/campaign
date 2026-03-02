export const DAILY_OPS_FLOW = [
  {
    title: '담당자별 업무에서 실행',
    description: '업무를 시작하면 상태를 바꾸고, Step와 결과값으로 오늘의 근거를 쌓습니다.',
  },
  {
    title: '결과값으로 사실 남기기',
    description: '완료, 발송, 공유, 검수, 승인처럼 실제로 남은 산출물이나 상태 변화를 적습니다.',
  },
  {
    title: '일일 보고서에서 의미 정리',
    description: '자동 수집된 근거를 보고 결과, 영향, 리스크, 지원 요청, 내일 집중만 작성합니다.',
  },
] as const;

export const TASK_LINKAGE_RULES = [
  'Task 관리에서 업무를 등록하면 담당자별 업무와 일일 보고서 집계 대상에 포함됩니다.',
  '캠페인 업무는 기본 적용값 또는 업무 적용 설정에 따라 활성 캠페인에 노출됩니다.',
  '전역 업무는 저장 즉시 담당자별 업무에서 담당자 기준으로 노출됩니다.',
] as const;

export const RESULT_VALUE_GUIDE = [
  '나쁜 예시: 확인함, 응대함, 작업중',
  '좋은 예시: 광고 세팅 QA 완료, 고객 공유 링크 전달',
  '좋은 예시: 고객 피드백 3건 반영 후 최종안 검토 요청',
] as const;

export const DAILY_REPORT_WRITING_GUIDE = [
  {
    label: '오늘 나온 결과',
    description: '오늘 실제로 완료되거나 확정된 결과를 적습니다.',
  },
  {
    label: '영향 / 변화',
    description: '일정, 고객, 매출, 품질에 어떤 변화가 생겼는지 적습니다.',
  },
  {
    label: '막힌 이슈 / 리스크',
    description: '내일 병목이 될 수 있는 대기, 지연, 품질 이슈를 적습니다.',
  },
  {
    label: '지원 필요 / 의사결정 요청',
    description: '누가 어떤 결정을 해주면 되는지 구체적으로 적습니다.',
  },
  {
    label: '내일 집중',
    description: '다음 날 가장 중요한 한두 가지에 집중점을 둡니다.',
  },
] as const;

export const MANAGER_REVIEW_CHECKLIST = [
  '오늘 나온 결과가 한 문장 이상 분명한가',
  '자동 근거와 서술 보고가 어긋나지 않는가',
  '진행중/미완료 항목의 대기 사유가 보이는가',
  '지원 필요가 있으면 누가 무엇을 결정해야 하는지 적혀 있는가',
  '내일 집중 항목이 비어 있지 않은가',
] as const;

export const EXAMPLE_DAY_SCENARIO = {
  taskEntry: '광고 세팅 QA 완료, 고객 공유 링크 전달',
  reportSummary: 'Alpha Launch 광고 세팅 QA를 마무리하고 고객에게 최종 링크를 전달했습니다.',
  reportImpact: '내일부터 운영 집행 가능한 상태가 되었고 일정 지연 리스크가 해소되었습니다.',
  reportRisk: 'Beta Retention은 고객 최종 회신 대기 중이라 수정 반영이 내일 오전으로 밀릴 수 있습니다.',
  reportSupport: '내일 오전 10시까지 회신이 없으면 AM 리마인드 지원이 필요합니다.',
} as const;
