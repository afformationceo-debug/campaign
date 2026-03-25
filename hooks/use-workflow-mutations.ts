'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { logActivity } from '@/lib/utils/log-activity';
import type { WorkflowCheckStatus } from '@/lib/types/database';

const supabase = createClient();

// ── 협업상품 CRUD ──
export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { product_name: string; description?: string; sort_order?: number }) => {
      const { data: row, error } = await supabase.from('collaboration_products').insert(data).select().single();
      if (error) throw error;
      return row;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.collabProducts.all }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; product_name?: string; description?: string; sort_order?: number; is_active?: boolean }) => {
      const { error } = await supabase.from('collaboration_products').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.collabProducts.all }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('collaboration_products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.collabProducts.all }),
  });
}

// ── 캠페인-상품 연결 ──
export function useLinkCampaignProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, productIds, userId }: { campaignId: string; productIds: string[]; userId?: string }) => {
      // 1. 기존 연결 삭제
      await supabase.from('campaign_products').delete().eq('campaign_id', campaignId);
      // 기존 워크플로우 체크도 삭제 (새로 생성)
      await supabase.from('campaign_workflow_checks').delete().eq('campaign_id', campaignId);

      if (productIds.length === 0) return;

      // 2. 새 연결 삽입
      const links = productIds.map((pid) => ({ campaign_id: campaignId, product_id: pid }));
      const { error: linkError } = await supabase.from('campaign_products').insert(links);
      if (linkError) throw linkError;

      // 3. 디폴트 맵핑 조회
      const { data: defaults } = await supabase
        .from('product_task_defaults')
        .select('product_id, workflow_task_id')
        .in('product_id', productIds);

      // 4. 전체 워크플로우 TASK 조회
      const { data: allTasks } = await supabase.from('workflow_tasks').select('id').eq('is_active', true);
      if (!allTasks) return;

      const requiredSet = new Set((defaults || []).map((d) => `${d.product_id}:${d.workflow_task_id}`));

      // 5. 캠페인×상품×TASK 체크 레코드 생성
      const checks: { campaign_id: string; product_id: string; workflow_task_id: string; status: WorkflowCheckStatus }[] = [];
      for (const pid of productIds) {
        for (const task of allTasks) {
          const isRequired = requiredSet.has(`${pid}:${task.id}`);
          checks.push({
            campaign_id: campaignId,
            product_id: pid,
            workflow_task_id: task.id,
            status: isRequired ? '진행전' : '해당없음',
          });
        }
      }

      if (checks.length > 0) {
        const { error: checkError } = await supabase.from('campaign_workflow_checks').insert(checks);
        if (checkError) throw checkError;
      }

      await logActivity({ userId, actionType: 'update', targetTable: 'campaign_products', targetId: campaignId, newValue: { productIds } });
    },
    onSuccess: (_, { campaignId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.campaignProducts.byCampaign(campaignId) });
      qc.invalidateQueries({ queryKey: queryKeys.workflowChecks.byCampaign(campaignId) });
    },
  });
}

// ── 워크플로우 상태 변경 ──
export function useUpdateWorkflowCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note, userId, campaignId }: {
      id: string; status: WorkflowCheckStatus; note?: string | null; userId?: string; campaignId: string;
    }) => {
      const { error } = await supabase
        .from('campaign_workflow_checks')
        .update({ status, note: note ?? null, updated_by: userId ?? null, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await logActivity({ userId, actionType: 'update', targetTable: 'campaign_workflow_checks', targetId: id, newValue: { status, note } });
    },
    onSuccess: (_, { campaignId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.workflowChecks.byCampaign(campaignId) });
    },
  });
}

// ── 일괄 상태 변경 ──
export function useBulkUpdateWorkflowChecks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status, excludeNA, userId, campaignId }: {
      ids: string[]; status: WorkflowCheckStatus; excludeNA: boolean; userId?: string; campaignId: string;
    }) => {
      let targetIds = ids;
      if (excludeNA) {
        const { data } = await supabase
          .from('campaign_workflow_checks')
          .select('id, status')
          .in('id', ids);
        targetIds = (data || []).filter((c) => c.status !== '해당없음').map((c) => c.id);
      }
      if (targetIds.length === 0) return;

      const { error } = await supabase
        .from('campaign_workflow_checks')
        .update({ status, updated_by: userId ?? null, updated_at: new Date().toISOString() })
        .in('id', targetIds);
      if (error) throw error;
      await logActivity({ userId, actionType: 'bulk_update', targetTable: 'campaign_workflow_checks', newValue: { count: targetIds.length, status } });
    },
    onSuccess: (_, { campaignId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.workflowChecks.byCampaign(campaignId) });
    },
  });
}

// ── 디폴트 맵핑 저장 ──
export function useSaveProductDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, taskIds }: { productId: string; taskIds: string[] }) => {
      await supabase.from('product_task_defaults').delete().eq('product_id', productId);
      if (taskIds.length > 0) {
        const rows = taskIds.map((tid) => ({ product_id: productId, workflow_task_id: tid, is_required: true }));
        const { error } = await supabase.from('product_task_defaults').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.productDefaults.all });
    },
  });
}

// ── 워크플로우 Task CRUD ──
export function useCreateWorkflowTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { task_number: number; section: string; task_name: string; sort_order: number; manual_text?: string; manual_url?: string }) => {
      const { data: row, error } = await supabase.from('workflow_tasks').insert(data).select().single();
      if (error) throw error;
      return row;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workflowTasks.all }),
  });
}

export function useUpdateWorkflowTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; task_name?: string; section?: string; task_number?: number; sort_order?: number; is_active?: boolean; manual_text?: string | null; manual_url?: string | null }) => {
      const { error } = await supabase.from('workflow_tasks').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workflowTasks.all }),
  });
}

export function useDeleteWorkflowTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // FK cascade: product_task_defaults, campaign_workflow_checks 자동 삭제
      const { error } = await supabase.from('workflow_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflowTasks.all });
      qc.invalidateQueries({ queryKey: queryKeys.productDefaults.all });
    },
  });
}
