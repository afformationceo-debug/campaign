'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  GripVertical,
  FileText,
  ExternalLink,
  Copy,
  ClipboardCheck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import type { OnboardingManualSection } from '@/lib/types/database';

const SECTION_ICONS: Record<number, string> = {
  1: '📋',
  2: '📘',
  3: '💬',
  4: '🔗',
};

const SECTION_COLORS: Record<number, string> = {
  1: 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
  2: 'from-indigo-500/10 to-indigo-600/5 border-indigo-500/20',
  3: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
  4: 'from-amber-500/10 to-amber-600/5 border-amber-500/20',
};

const SECTION_ACCENT: Record<number, string> = {
  1: 'bg-blue-500',
  2: 'bg-indigo-500',
  3: 'bg-emerald-500',
  4: 'bg-amber-500',
};

export function OnboardingManual() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const { profile } = useAuth();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);

  // Fetch sections
  const { data: sections = [], isLoading } = useQuery({
    queryKey: queryKeys.onboardingManual.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_manual_sections')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as OnboardingManualSection[];
    },
  });

  // Update section
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      title,
      content,
    }: {
      id: string;
      title: string;
      content: string;
    }) => {
      const { error } = await supabase
        .from('onboarding_manual_sections')
        .update({
          section_title: title,
          content,
          updated_by: profile?.id ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingManual.all });
      setEditingId(null);
    },
  });

  // Create section
  const createMutation = useMutation({
    mutationFn: async ({ title, content }: { title: string; content: string }) => {
      const nextOrder = sections.length > 0
        ? Math.max(...sections.map((s) => s.sort_order)) + 1
        : 1;
      const nextNumber = sections.length > 0
        ? Math.max(...sections.map((s) => s.section_number)) + 1
        : 1;
      const { error } = await supabase
        .from('onboarding_manual_sections')
        .insert({
          section_number: nextNumber,
          section_title: title,
          content,
          sort_order: nextOrder,
          updated_by: profile?.id ?? null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingManual.all });
      setIsAddDialogOpen(false);
      setNewTitle('');
      setNewContent('');
    },
  });

  // Delete section
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('onboarding_manual_sections')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingManual.all });
    },
  });

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (expandAll) {
      setExpandedSections(new Set());
    } else {
      setExpandedSections(new Set(sections.map((s) => s.id)));
    }
    setExpandAll(!expandAll);
  };

  const startEdit = (section: OnboardingManualSection) => {
    setEditingId(section.id);
    setEditTitle(section.section_title);
    setEditContent(section.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
  };

  const saveEdit = () => {
    if (!editingId || !editTitle.trim()) return;
    updateMutation.mutate({ id: editingId, title: editTitle.trim(), content: editContent });
  };

  const handleCopySection = async (section: OnboardingManualSection) => {
    const text = `[${section.section_number}] ${section.section_title}\n${section.content}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(section.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = async () => {
    const text = sections
      .map((s) => `[${s.section_number}] ${s.section_title}\n${s.content}`)
      .join('\n\n-----------------\n\n');
    await navigator.clipboard.writeText(text);
    setCopiedId('all');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Render content with links highlighted
  const renderContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      // Detect URLs
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = line.split(urlRegex);

      return (
        <div key={i} className={cn('leading-relaxed', line.trim() === '' && 'h-3')}>
          {parts.map((part, j) => {
            if (urlRegex.test(part)) {
              // Reset lastIndex since we used .test
              urlRegex.lastIndex = 0;
              return (
                <a
                  key={j}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 underline underline-offset-2 break-all"
                >
                  {part.length > 60 ? part.slice(0, 60) + '...' : part}
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              );
            }
            // Highlight step numbers (e.g. "1.", "2.")
            const stepMatch = part.match(/^(\s*\d+\.\s)/);
            if (stepMatch) {
              return (
                <span key={j}>
                  <span className="font-semibold text-foreground">{stepMatch[1]}</span>
                  {part.slice(stepMatch[1].length)}
                </span>
              );
            }
            // Highlight lines starting with ✅ or *
            if (part.trim().startsWith('✅')) {
              return (
                <span key={j} className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {part}
                </span>
              );
            }
            if (part.trim().startsWith('*')) {
              return (
                <span key={j} className="text-muted-foreground italic text-sm">
                  {part}
                </span>
              );
            }
            return <span key={j}>{part}</span>;
          })}
        </div>
      );
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-4"
    >
      {/* Header */}
      <motion.div variants={fadeUpItem} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">온보딩 매뉴얼</h2>
            <p className="text-sm text-muted-foreground">
              거래처에 요청하는 온보딩 자료 및 설정 가이드
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAll}
            className="gap-1.5"
          >
            {copiedId === 'all' ? (
              <>
                <ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" />
                복사됨
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                전체 복사
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleExpandAll}
            className="gap-1.5"
          >
            {expandAll ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                모두 접기
              </>
            ) : (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                모두 펼치기
              </>
            )}
          </Button>
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              섹션 추가
            </Button>
          )}
        </div>
      </motion.div>

      {/* Section count badge */}
      <motion.div variants={fadeUpItem} className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          총 {sections.length}개 섹션
        </Badge>
        <span className="text-xs text-muted-foreground">
          클릭하여 펼치거나 접을 수 있습니다
        </span>
      </motion.div>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const isEditing = editingId === section.id;
          const colorClass = SECTION_COLORS[section.section_number] || SECTION_COLORS[1];
          const accentClass = SECTION_ACCENT[section.section_number] || SECTION_ACCENT[1];
          const icon = SECTION_ICONS[section.section_number] || '📄';

          return (
            <motion.div
              key={section.id}
              variants={fadeUpItem}
              className={cn(
                'rounded-xl border bg-gradient-to-br transition-all duration-200',
                colorClass,
                isExpanded && 'shadow-sm'
              )}
            >
              {/* Section Header */}
              <button
                onClick={() => !isEditing && toggleSection(section.id)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
                  !isEditing && 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                )}
                disabled={isEditing}
              >
                <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', accentClass)} />
                <span className="text-lg flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                      {section.section_number}
                    </Badge>
                    <span className="font-semibold text-sm truncate">
                      {section.section_title}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!isEditing && (
                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </motion.div>
                  )}
                </div>
              </button>

              {/* Section Content */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border/50 px-4 py-4">
                      {isEditing ? (
                        /* Edit Mode */
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">
                              섹션 제목
                            </label>
                            <Input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              placeholder="섹션 제목"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">
                              내용
                            </label>
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              placeholder="섹션 내용을 입력하세요..."
                              rows={12}
                              className="text-sm font-mono leading-relaxed"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEdit}
                              className="gap-1.5"
                            >
                              <X className="h-3.5 w-3.5" />
                              취소
                            </Button>
                            <Button
                              size="sm"
                              onClick={saveEdit}
                              disabled={updateMutation.isPending}
                              className="gap-1.5"
                            >
                              <Check className="h-3.5 w-3.5" />
                              {updateMutation.isPending ? '저장중...' : '저장'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* View Mode */
                        <div className="space-y-3">
                          <div className="text-sm text-foreground/90 whitespace-pre-wrap font-[inherit]">
                            {renderContent(section.content)}
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center justify-between pt-2 border-t border-border/30">
                            <span className="text-[10px] text-muted-foreground">
                              마지막 수정: {new Date(section.updated_at).toLocaleDateString('ko-KR')}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopySection(section);
                                }}
                                className="h-7 gap-1.5 text-xs"
                              >
                                {copiedId === section.id ? (
                                  <>
                                    <ClipboardCheck className="h-3 w-3 text-emerald-500" />
                                    복사됨
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" />
                                    복사
                                  </>
                                )}
                              </Button>
                              {isAdmin && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEdit(section);
                                    }}
                                    className="h-7 gap-1.5 text-xs"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    수정
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm(`"${section.section_title}" 섹션을 삭제하시겠습니까?`)) {
                                        deleteMutation.mutate(section.id);
                                      }
                                    }}
                                    className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    삭제
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {sections.length === 0 && (
        <motion.div
          variants={fadeUpItem}
          className="text-center py-12 text-muted-foreground"
        >
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">등록된 온보딩 매뉴얼이 없습니다.</p>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              첫 섹션 추가하기
            </Button>
          )}
        </motion.div>
      )}

      {/* Add Section Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>온보딩 매뉴얼 섹션 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">섹션 제목</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="예: 추가 요청 사항"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">내용</label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="매뉴얼 내용을 입력하세요..."
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              onClick={() => createMutation.mutate({ title: newTitle.trim(), content: newContent })}
              disabled={!newTitle.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? '추가 중...' : '추가'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
