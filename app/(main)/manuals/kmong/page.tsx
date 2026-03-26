'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Headset, Bot } from 'lucide-react';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CsFunnelStep, CsTemplateEditDialog } from '@/components/manuals/cs-template-viewer';
import type {
  CsManualService,
  CsManualStepWithTemplates,
  CsManualTemplate,
  CsManualTemplateVariable,
} from '@/lib/types/database';

export default function KmongManualPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const [openStepIds, setOpenStepIds] = useState<Set<string>>(new Set());
  const [editTemplate, setEditTemplate] = useState<CsManualTemplate | null>(null);

  // Fetch services
  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: queryKeys.csManual.services,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_manual_services')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as CsManualService[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Auto-select first service
  const selectedServiceId = activeServiceId || services[0]?.id || null;
  const selectedService = services.find((s) => s.id === selectedServiceId);

  // Fetch steps + templates for selected service
  const { data: steps = [], isLoading: loadingSteps } = useQuery({
    queryKey: queryKeys.csManual.steps(selectedServiceId ?? ''),
    queryFn: async () => {
      if (!selectedServiceId) return [];
      const { data, error } = await supabase
        .from('cs_manual_steps')
        .select('*, cs_manual_templates(*)')
        .eq('service_id', selectedServiceId)
        .order('sort_order')
        .order('sort_order', { referencedTable: 'cs_manual_templates' });
      if (error) throw error;
      return data as CsManualStepWithTemplates[];
    },
    enabled: !!selectedServiceId,
  });

  const outboundSteps = steps.filter((s) => s.section_type === 'outbound');
  const funnelSteps = steps.filter((s) => s.section_type === 'funnel');

  // Toggle step open/close
  const toggleStep = useCallback((stepId: string) => {
    setOpenStepIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { label: string; content: string; tip: string | null; variables: CsManualTemplateVariable[] };
    }) => {
      const { error } = await supabase
        .from('cs_manual_templates')
        .update({
          label: data.label,
          content: data.content,
          tip: data.tip,
          variables: data.variables as unknown as Record<string, unknown>[],
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.csManual.steps(selectedServiceId ?? '') });
      setEditTemplate(null);
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cs_manual_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.csManual.steps(selectedServiceId ?? '') });
    },
  });

  const handleSaveTemplate = useCallback(
    (id: string, data: { label: string; content: string; tip: string | null; variables: CsManualTemplateVariable[] }) => {
      updateTemplateMutation.mutate({ id, data });
    },
    [updateTemplateMutation]
  );

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      {/* Header */}
      <motion.div variants={fadeUpItem} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">크몽 응대매뉴얼</h1>
          <p className="text-sm text-muted-foreground mt-1">
            고객 응대 · 아웃바운드 템플릿 키트 — 퍼널별 응대 스크립트
          </p>
        </div>
      </motion.div>

      {/* Guide Banner */}
      <motion.div variants={fadeUpItem}>
        <div className="relative rounded-lg border border-border bg-card px-4 py-3.5 overflow-hidden">
          <div className="flex gap-3 items-start relative">
            <div className="relative shrink-0 mt-0.5">
              <div className="size-9 rounded-full bg-foreground flex items-center justify-center">
                <Headset className="size-4 text-background" />
              </div>
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[12px] font-bold text-foreground">CS 플레이북 가이드</p>
                <span className="text-[9px] font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                  크몽 응대
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground leading-[1.7]">
                <p>
                  서비스 탭을 선택하고 퍼널 단계를 클릭하면 <strong className="text-foreground">응대 멘트 템플릿</strong>을 확인할 수 있습니다.
                  {' '}<strong className="text-foreground">{'{'}변수{'}'}</strong> 값을 입력하면 자동 치환되며, <strong className="text-foreground">복사</strong> 버튼으로 즉시 활용 가능합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Service Tabs */}
      <motion.div variants={fadeUpItem}>
        {loadingServices ? (
          <div className="flex items-center justify-center h-16">
            <div className="size-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {services.map((service) => (
              <button
                key={service.id}
                onClick={() => {
                  setActiveServiceId(service.id);
                  setOpenStepIds(new Set());
                }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg border whitespace-nowrap text-sm transition-all shrink-0',
                  service.id === selectedServiceId
                    ? 'border-foreground bg-foreground text-background font-semibold'
                    : 'hover:border-foreground/30 bg-card border-border text-muted-foreground hover:text-foreground'
                )}
              >
                <span>{service.icon}</span>
                <span>{service.name}</span>
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Punch Banner */}
      {selectedService && (
        <motion.div
          key={selectedService.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg p-6 text-white relative overflow-hidden"
          style={{ background: selectedService.punch_gradient || 'linear-gradient(135deg, #FF6B35 0%, #E85D2A 100%)' }}
        >
          <div className="absolute right-6 top-4 text-4xl opacity-10">✦</div>
          {selectedService.punch_label && (
            <p className="text-[11px] font-bold uppercase tracking-widest opacity-70 mb-2">
              {selectedService.punch_label}
            </p>
          )}
          {selectedService.punch_title && (
            <p className="text-lg font-bold leading-relaxed mb-2">{selectedService.punch_title}</p>
          )}
          {selectedService.punch_description && (
            <p className="text-[13px] opacity-85 leading-relaxed">{selectedService.punch_description}</p>
          )}
        </motion.div>
      )}

      {/* Steps Content */}
      {selectedServiceId && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Outbound Section */}
          {outboundSteps.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-bold flex items-center gap-2 pb-2 border-b-2 border-orange-100">
                아웃바운드 발송 멘트
                <Badge variant="secondary" className="text-[10px] rounded-full">채널별</Badge>
              </h2>
              <div className="space-y-2">
                {outboundSteps.map((step) => (
                  <CsFunnelStep
                    key={step.id}
                    stepNumber={step.step_number}
                    title={step.title}
                    tag={step.tag}
                    tagColor={step.tag_color}
                    templates={step.cs_manual_templates}
                    isOpen={openStepIds.has(step.id)}
                    onToggle={() => toggleStep(step.id)}
                    onEditTemplate={setEditTemplate}
                    onDeleteTemplate={(id) => deleteTemplateMutation.mutate(id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Funnel Section */}
          {funnelSteps.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-bold flex items-center gap-2 pb-2 border-b-2 border-orange-100">
                계약 전 응대 퍼널
                <Badge variant="secondary" className="text-[10px] rounded-full">
                  STEP 1 → {funnelSteps.length}
                </Badge>
              </h2>
              <div className="space-y-2">
                {loadingSteps ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="size-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
                  </div>
                ) : (
                  funnelSteps.map((step) => (
                    <CsFunnelStep
                      key={step.id}
                      stepNumber={step.step_number}
                      title={step.title}
                      tag={step.tag}
                      tagColor={step.tag_color}
                      templates={step.cs_manual_templates}
                      isOpen={openStepIds.has(step.id)}
                      onToggle={() => toggleStep(step.id)}
                      onEditTemplate={setEditTemplate}
                      onDeleteTemplate={(id) => deleteTemplateMutation.mutate(id)}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loadingSteps && steps.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground border border-border rounded-lg gap-2">
              <Bot className="size-8 text-muted-foreground/50" />
              <p className="text-sm">등록된 매뉴얼이 없습니다.</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Edit Dialog */}
      <CsTemplateEditDialog
        template={editTemplate}
        open={!!editTemplate}
        onOpenChange={(open) => !open && setEditTemplate(null)}
        onSave={handleSaveTemplate}
      />
    </motion.div>
  );
}
