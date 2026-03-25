'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Trash2, Pencil, Save, X, ChevronDown, ChevronRight } from 'lucide-react';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { useCreateProduct, useUpdateProduct, useDeleteProduct, useSaveProductDefaults } from '@/hooks/use-workflow-mutations';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import type { CollaborationProduct, WorkflowTask, ProductTaskDefault, WorkflowSection } from '@/lib/types/database';

const supabase = createClient();

const SECTION_COLORS: Record<WorkflowSection, string> = {
  'cms세팅': 'text-blue-700',
  '온보딩': 'text-amber-700',
  '인플루언서': 'text-purple-700',
  '일반고객 CS 대행': 'text-rose-700',
};

export default function ProductsPage() {
  const isAdmin = useIsAdmin();
  const [editingProduct, setEditingProduct] = useState<CollaborationProduct | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [mappingProduct, setMappingProduct] = useState<CollaborationProduct | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const saveDefaults = useSaveProductDefaults();

  const { data: products = [] } = useQuery({
    queryKey: queryKeys.collabProducts.all,
    queryFn: async () => {
      const { data } = await supabase.from('collaboration_products').select('*').order('sort_order');
      return (data || []) as CollaborationProduct[];
    },
  });

  const { data: workflowTasks = [] } = useQuery({
    queryKey: queryKeys.workflowTasks.all,
    queryFn: async () => {
      const { data } = await supabase.from('workflow_tasks').select('*').eq('is_active', true).order('sort_order');
      return (data || []) as WorkflowTask[];
    },
  });

  const { data: allDefaults = [] } = useQuery({
    queryKey: queryKeys.productDefaults.all,
    queryFn: async () => {
      const { data } = await supabase.from('product_task_defaults').select('*');
      return (data || []) as ProductTaskDefault[];
    },
  });

  const sections = useMemo(() => {
    const sectionOrder: WorkflowSection[] = ['cms세팅', '온보딩', '인플루언서', '일반고객 CS 대행'];
    return sectionOrder.map((sec) => ({
      section: sec,
      tasks: workflowTasks.filter((t) => t.section === sec),
    }));
  }, [workflowTasks]);

  const handleAddProduct = () => {
    if (!newProductName.trim()) return;
    createProduct.mutate({
      product_name: newProductName.trim(),
      description: newProductDesc.trim() || undefined,
      sort_order: products.length,
    }, {
      onSuccess: () => {
        setShowAddDialog(false);
        setNewProductName('');
        setNewProductDesc('');
      },
    });
  };

  const openMapping = (product: CollaborationProduct) => {
    const existing = allDefaults.filter((d) => d.product_id === product.id);
    setSelectedTaskIds(new Set(existing.map((d) => d.workflow_task_id)));
    setMappingProduct(product);
    setCollapsedSections(new Set());
  };

  const toggleTaskId = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

  const toggleSection = (section: WorkflowSection) => {
    const taskIds = workflowTasks.filter((t) => t.section === section).map((t) => t.id);
    const allSelected = taskIds.every((id) => selectedTaskIds.has(id));
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      taskIds.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const handleSaveMapping = () => {
    if (!mappingProduct) return;
    saveDefaults.mutate({
      productId: mappingProduct.id,
      taskIds: Array.from(selectedTaskIds),
    }, {
      onSuccess: () => setMappingProduct(null),
    });
  };

  const toggleCollapsed = (sec: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(sec) ? next.delete(sec) : next.add(sec);
      return next;
    });
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6 p-6">
      <motion.div variants={fadeUpItem} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">협업상품 설정</h1>
          <p className="text-sm text-stone-500 mt-1">협업상품 목록 관리 및 디폴트 TASK 맵핑 설정</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="size-4 mr-1" /> 상품 추가
          </Button>
        )}
      </motion.div>

      {/* Products List */}
      <motion.div variants={fadeUpItem} className="grid gap-3">
        {products.map((product) => {
          const defaultCount = allDefaults.filter((d) => d.product_id === product.id).length;
          return (
            <div
              key={product.id}
              className={cn(
                'flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 transition-all hover:shadow-sm',
                !product.is_active && 'opacity-50'
              )}
            >
              <div className="flex items-center gap-3">
                <div>
                  {editingProduct?.id === product.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editingProduct.product_name}
                        onChange={(e) => setEditingProduct({ ...editingProduct, product_name: e.target.value })}
                        className="h-8 w-[200px] text-sm"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => {
                          updateProduct.mutate({ id: editingProduct.id, product_name: editingProduct.product_name });
                          setEditingProduct(null);
                        }}
                      >
                        <Save className="size-3.5 text-emerald-600" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditingProduct(null)}>
                        <X className="size-3.5 text-stone-400" />
                      </Button>
                    </div>
                  ) : (
                    <span className="font-medium text-sm text-stone-800">{product.product_name}</span>
                  )}
                  {product.description && (
                    <p className="text-xs text-stone-400 mt-0.5">{product.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">디폴트 {defaultCount}개 TASK</Badge>
                {isAdmin && (
                  <>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openMapping(product)}>
                      맵핑 설정
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditingProduct(product)}>
                      <Pencil className="size-3.5 text-stone-400" />
                    </Button>
                    <Switch
                      checked={product.is_active}
                      onCheckedChange={(v) => updateProduct.mutate({ id: product.id, is_active: v })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => { if (confirm('삭제하시겠습니까?')) deleteProduct.mutate(product.id); }}
                    >
                      <Trash2 className="size-3.5 text-rose-400" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {products.length === 0 && (
          <div className="text-center py-12 text-stone-400">
            <p>등록된 협업상품이 없습니다.</p>
          </div>
        )}
      </motion.div>

      {/* Add Product Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>협업상품 추가</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">상품명 *</Label>
              <Input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="예: 인플루언서 마케팅" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">설명 (선택)</Label>
              <Input value={newProductDesc} onChange={(e) => setNewProductDesc(e.target.value)} placeholder="상품 설명" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowAddDialog(false)}>취소</Button>
            <Button size="sm" onClick={handleAddProduct} disabled={!newProductName.trim()}>추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Mapping Dialog */}
      <Dialog open={!!mappingProduct} onOpenChange={() => setMappingProduct(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {mappingProduct?.product_name} — 디폴트 TASK 맵핑
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-stone-500">이 협업상품을 캠페인에 연결할 때 자동으로 &quot;진행전&quot;이 되는 TASK를 선택하세요.</p>

          <div className="space-y-2 mt-2">
            {sections.map(({ section, tasks }) => {
              const sectionTaskIds = tasks.map((t) => t.id);
              const allChecked = sectionTaskIds.every((id) => selectedTaskIds.has(id));
              const someChecked = sectionTaskIds.some((id) => selectedTaskIds.has(id));
              const isCollapsed = collapsedSections.has(section);

              return (
                <div key={section} className="border border-stone-200 rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between px-3 py-2 bg-stone-50 cursor-pointer"
                    onClick={() => toggleCollapsed(section)}
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      <Checkbox
                        checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                        onCheckedChange={() => toggleSection(section)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className={cn('text-sm font-bold', SECTION_COLORS[section])}>[{section}]</span>
                      <span className="text-xs text-stone-400">
                        {sectionTaskIds.filter((id) => selectedTaskIds.has(id)).length}/{sectionTaskIds.length}
                      </span>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <div className="divide-y divide-stone-100">
                      {tasks.map((task) => (
                        <label
                          key={task.id}
                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-stone-50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedTaskIds.has(task.id)}
                            onCheckedChange={() => toggleTaskId(task.id)}
                          />
                          <span className="text-xs text-stone-400 w-5 text-right">{task.task_number}.</span>
                          <span className="text-sm text-stone-700">{task.task_name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500">선택됨: {selectedTaskIds.size}/{workflowTasks.length}</span>
              <Button variant="ghost" size="sm" onClick={() => setMappingProduct(null)}>취소</Button>
              <Button size="sm" onClick={handleSaveMapping}>저장</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
