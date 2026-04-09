'use client';

import { useState, useCallback, useMemo, useRef, useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  motion,
  AnimatePresence,
  Reorder,
  useDragControls,
  useMotionValue,
  useTransform,
  useSpring,
} from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  GripVertical,
  Sparkles,
  Shield,
  CalendarDays,
  BarChart3,
  Ban,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { queryKeys } from '@/lib/utils/query-keys';

// ─── KST Date Utility ─────────────────────────────────────────────────
// 브라우저 타임존과 무관하게 항상 KST(UTC+9) 기준 날짜를 반환
function getKSTDate(date?: Date): Date {
  const d = date ?? new Date();
  // KST offset: UTC+9 → UTC 시간에 9시간을 더한 후 날짜만 추출
  const kstMs = d.getTime() + 9 * 60 * 60 * 1000;
  const kstDate = new Date(kstMs);
  // yyyy-mm-dd 문자열로 변환 후 다시 Date로 (시간 제거)
  const year = kstDate.getUTCFullYear();
  const month = kstDate.getUTCMonth();
  const day = kstDate.getUTCDate();
  return new Date(year, month, day);
}

function formatKSTDateStr(date: Date): string {
  // 선택된 Date 객체에서 yyyy-MM-dd 추출 (로컬 기준 — 이미 KST로 보정된 Date)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Types ────────────────────────────────────────────────────────────
interface Section {
  id: string;
  name: string;
  sort_order: number;
}

interface CheckItem {
  id: string;
  section_id: string;
  label: string;
  has_data_field: boolean;
  sort_order: number;
}

interface CheckRecord {
  id: string;
  item_id: string;
  check_date: string;
  checked: boolean;
  data_value: string | null;
  data_status: 'pending' | 'filled' | 'not_applicable';
  checked_by: string | null;
  checked_at: string | null;
}

// ─── Section Colors + Emoji ───────────────────────────────────────────
const SECTION_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; glow: string; emoji: string; completedEmoji: string }> = {
  '영업': { bg: 'from-blue-50 to-indigo-50', border: 'border-blue-200/60', text: 'text-blue-700', badge: 'bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/20', glow: 'shadow-blue-300/40', emoji: '💼', completedEmoji: '🏆' },
  '인플루언서': { bg: 'from-violet-50 to-purple-50', border: 'border-violet-200/60', text: 'text-violet-700', badge: 'bg-violet-500/10 text-violet-700 ring-1 ring-violet-500/20', glow: 'shadow-violet-300/40', emoji: '🌟', completedEmoji: '✨' },
  '광고': { bg: 'from-amber-50 to-orange-50', border: 'border-amber-200/60', text: 'text-amber-700', badge: 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20', glow: 'shadow-amber-300/40', emoji: '📢', completedEmoji: '🎯' },
  'CS': { bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-200/60', text: 'text-emerald-700', badge: 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20', glow: 'shadow-emerald-300/40', emoji: '🎧', completedEmoji: '💚' },
};

const DEFAULT_COLOR = { bg: 'from-stone-50 to-stone-100', border: 'border-stone-200/60', text: 'text-stone-700', badge: 'bg-stone-500/10 text-stone-700 ring-1 ring-stone-500/20', glow: 'shadow-stone-300/40', emoji: '📋', completedEmoji: '✅' };

function getSectionColor(name: string) {
  return SECTION_COLORS[name] || DEFAULT_COLOR;
}

// ─── Progress Character ──────────────────────────────────────────────
function getProgressCharacter(progress: number) {
  if (progress === 0) return { emoji: '😴', label: '아직 시작 전...' };
  if (progress < 25) return { emoji: '🏃', label: '시작했어요!' };
  if (progress < 50) return { emoji: '💪', label: '힘내세요!' };
  if (progress < 75) return { emoji: '🔥', label: '불타오르는 중!' };
  if (progress < 100) return { emoji: '🚀', label: '거의 다 왔어요!' };
  return { emoji: '🎉', label: 'ALL CLEAR!' };
}

// ─── Celebration Overlay ─────────────────────────────────────────────
function CelebrationOverlay({ show, onClose }: { show: boolean; onClose: () => void }) {
  const emojis = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        emoji: ['🎉', '🎊', '✨', '🌟', '💫', '🏆', '🥳', '🎯', '💪', '🔥', '⭐', '💎'][i % 12],
        x: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 1.5 + Math.random() * 1,
        size: 20 + Math.random() * 24,
      })),
    []
  );

  if (!show) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* Falling emojis */}
      {emojis.map((e) => (
        <motion.div
          key={e.id}
          className="fixed pointer-events-none select-none"
          style={{ left: `${e.x}%`, fontSize: e.size, top: -50 }}
          animate={{ y: [0, typeof window !== 'undefined' ? window.innerHeight + 100 : 900], rotate: [0, 360] }}
          transition={{ duration: e.duration, delay: e.delay, ease: 'easeIn' }}
        >
          {e.emoji}
        </motion.div>
      ))}

      {/* Center card */}
      <motion.div
        className="relative rounded-3xl bg-white/95 backdrop-blur-xl shadow-2xl px-10 py-8 text-center border border-white/50"
        initial={{ scale: 0, rotateY: -90 }}
        animate={{ scale: 1, rotateY: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        style={{ perspective: 1000 }}
      >
        <motion.img
          src="/characters/afformation-thumbsup.png"
          alt="축하!"
          className="w-40 h-40 object-contain drop-shadow-2xl mb-3 mx-auto"
          animate={{ scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
        />
        <h2 className="text-[24px] font-black text-stone-900 mb-1">ALL CLEAR!</h2>
        <p className="text-[14px] text-stone-500 mb-4">오늘 할 일을 모두 완료했습니다!</p>
        <motion.div
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-2.5 text-white text-[14px] font-bold shadow-lg shadow-green-200/50 cursor-pointer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
        >
          <span>🏆</span> 수고하셨습니다!
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ─── Emoji + Confetti Burst ───────────────────────────────────────────
function ConfettiBurst({ x, y }: { x: number; y: number }) {
  const particles = useMemo(
    () => [
      // Color dots
      ...Array.from({ length: 10 }, (_, i) => ({
        id: i,
        type: 'dot' as const,
        angle: (i * 36 * Math.PI) / 180,
        color: ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#e11d48'][i],
        distance: 25 + Math.random() * 30,
        size: 3 + Math.random() * 5,
        emoji: '',
      })),
      // Emoji particles
      ...Array.from({ length: 4 }, (_, i) => ({
        id: 10 + i,
        type: 'emoji' as const,
        angle: ((i * 90 + 45) * Math.PI) / 180,
        color: '',
        distance: 35 + Math.random() * 15,
        size: 14,
        emoji: ['✨', '⭐', '💫', '🌟'][i],
      })),
    ],
    []
  );

  return (
    <div className="pointer-events-none fixed z-[9999]" style={{ left: x, top: y }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.type === 'dot' ? p.color : undefined,
            borderRadius: p.type === 'dot' ? '50%' : undefined,
            fontSize: p.type === 'emoji' ? p.size : undefined,
            lineHeight: 1,
            left: -p.size / 2,
            top: -p.size / 2,
          }}
          initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
          animate={{
            scale: [0, 1.4, 0],
            x: Math.cos(p.angle) * p.distance,
            y: Math.sin(p.angle) * p.distance - (p.type === 'emoji' ? 10 : 0),
            opacity: [1, 1, 0],
            rotate: p.type === 'emoji' ? [0, 180] : [0, 0],
          }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {p.type === 'emoji' ? p.emoji : null}
        </motion.div>
      ))}
    </div>
  );
}

// ─── Effects Context (renders via portal on document.body) ───────────
type EffectPos = { x: number; y: number };
const EffectsContext = createContext<(pos: EffectPos) => void>(() => {});

// ─── Character Pop ───────────────────────────────────────────────────
function CharacterPop({ x, y }: { x: number; y: number }) {
  return (
    <motion.div
      className="pointer-events-none fixed z-[9998]"
      style={{ left: x - 56, top: y - 130 }}
      initial={{ scale: 0, y: 30, opacity: 0 }}
      animate={{ scale: [0, 1.15, 1], y: [30, -15, 0], opacity: [0, 1, 1] }}
      exit={{ scale: 0, y: -40, opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="relative">
        <img
          src="/characters/afformation-thumbsup.png"
          alt="Good job!"
          className="w-28 h-28 object-contain drop-shadow-xl"
        />
        <motion.div
          className="absolute -top-1 -right-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[11px] font-bold px-2 py-0.5 shadow-lg"
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 400 }}
        >
          NICE!
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── 3D Check Animation ──────────────────────────────────────────────
function AnimatedCheckbox({
  checked,
  onToggle,
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const triggerEffects = useContext(EffectsContext);
  const ref = useRef<HTMLButtonElement>(null);
  const rotateY = useMotionValue(0);
  const scale = useMotionValue(1);
  const springRotate = useSpring(rotateY, { stiffness: 300, damping: 20 });
  const springScale = useSpring(scale, { stiffness: 400, damping: 15 });
  const background = useTransform(
    springRotate,
    [-180, 0],
    ['rgb(34, 197, 94)', 'rgb(229, 231, 235)']
  );

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    if (!checked) {
      triggerEffects({ x: e.clientX, y: e.clientY });
    }
    rotateY.set(checked ? 0 : -180);
    scale.set(1.3);
    setTimeout(() => scale.set(1), 150);
    onToggle();
  }, [checked, onToggle, disabled, rotateY, scale, triggerEffects]);

  useEffect(() => {
    rotateY.set(checked ? -180 : 0);
  }, [checked, rotateY]);

  return (
    <>
      <motion.button
        ref={ref}
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          'relative flex size-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500',
          checked
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-stone-300 bg-white hover:border-stone-400',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        style={{
          rotateY: springRotate,
          scale: springScale,
          perspective: 600,
        }}
        whileHover={!disabled ? { scale: 1.1 } : undefined}
        whileTap={!disabled ? { scale: 0.9 } : undefined}
      >
        <AnimatePresence mode="wait">
          {checked && (
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 45 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            >
              <Check className="size-3.5 stroke-[3]" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}

// ─── Data Status Badge ────────────────────────────────────────────────
function DataStatusBadge({
  status,
  onToggleNA,
}: {
  status: 'pending' | 'filled' | 'not_applicable';
  onToggleNA: () => void;
}) {
  if (status === 'not_applicable') {
    return (
      <button
        type="button"
        onClick={onToggleNA}
        className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-500 hover:bg-stone-200 transition-colors"
      >
        <Ban className="size-3" />
        해당없음
      </button>
    );
  }
  return null;
}

// ─── Check Item Row ──────────────────────────────────────────────────
function CheckItemRow({
  item,
  record,
  onToggleCheck,
  onUpdateData,
  onToggleNA,
  onEditItem,
  onDeleteItem,
  dragControls,
}: {
  item: CheckItem;
  record?: CheckRecord;
  onToggleCheck: (itemId: string) => void;
  onUpdateData: (itemId: string, value: string) => void;
  onToggleNA: (itemId: string) => void;
  onEditItem: (item: CheckItem) => void;
  onDeleteItem: (itemId: string) => void;
  dragControls: ReturnType<typeof useDragControls>;
}) {
  const isChecked = record?.checked ?? false;
  const dataStatus = record?.data_status ?? 'pending';
  const dataValue = record?.data_value ?? '';
  const [localValue, setLocalValue] = useState(dataValue);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    setLocalValue(record?.data_value ?? '');
  }, [record?.data_value]);

  const handleDataChange = useCallback(
    (val: string) => {
      setLocalValue(val);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdateData(item.id, val);
      }, 500);
    },
    [item.id, onUpdateData]
  );

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-xl px-2 py-2.5 transition-all duration-200',
        isChecked
          ? 'bg-green-50/60 border border-green-100'
          : 'bg-white border border-stone-100 hover:border-stone-200 hover:shadow-sm'
      )}
    >
      {/* Drag handle */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="flex items-center justify-center size-6 shrink-0 cursor-grab active:cursor-grabbing rounded-md text-stone-300 hover:text-stone-500 hover:bg-stone-100 transition-colors touch-none"
      >
        <GripVertical className="size-3.5" />
      </div>

      <AnimatedCheckbox
        checked={isChecked}
        onToggle={() => onToggleCheck(item.id)}
      />

      <span
        className={cn(
          'flex-1 text-[13px] font-medium transition-all duration-300 min-w-0',
          isChecked ? 'text-green-700 line-through opacity-70' : 'text-stone-800'
        )}
      >
        {item.label}
      </span>

      {/* Data input area */}
      {item.has_data_field && dataStatus !== 'not_applicable' && (
        <div className="flex items-center gap-1.5 shrink-0">
          <Input
            type="text"
            placeholder="데이터 입력"
            value={localValue}
            onChange={(e) => handleDataChange(e.target.value)}
            className="h-7 w-28 text-[12px] rounded-lg border-stone-200 bg-stone-50 focus:bg-white transition-colors"
          />
        </div>
      )}

      {/* Data status toggle */}
      {item.has_data_field && (
        <DataStatusBadge status={dataStatus} onToggleNA={() => onToggleNA(item.id)} />
      )}

      {/* N/A toggle button when not already N/A */}
      {item.has_data_field && dataStatus !== 'not_applicable' && (
        <button
          type="button"
          onClick={() => onToggleNA(item.id)}
          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-all"
          title="해당없음으로 변경"
        >
          <Ban className="size-3" />
        </button>
      )}

      {/* Edit / Delete */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={() => onEditItem(item)}
          className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
        >
          <Pencil className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => onDeleteItem(item.id)}
          className="rounded-md p-1 text-stone-400 hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────
function ReorderableItem({ item, record, onToggleCheck, onUpdateData, onToggleNA, onEditItem, onDeleteItem }: {
  item: CheckItem;
  record?: CheckRecord;
  onToggleCheck: (itemId: string) => void;
  onUpdateData: (itemId: string, value: string) => void;
  onToggleNA: (itemId: string) => void;
  onEditItem: (item: CheckItem) => void;
  onDeleteItem: (itemId: string) => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="list-none"
      whileDrag={{ scale: 1.02, boxShadow: '0 8px 25px rgba(0,0,0,0.12)', zIndex: 50 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <CheckItemRow
        item={item}
        record={record}
        onToggleCheck={onToggleCheck}
        onUpdateData={onUpdateData}
        onToggleNA={onToggleNA}
        onEditItem={onEditItem}
        onDeleteItem={onDeleteItem}
        dragControls={controls}
      />
    </Reorder.Item>
  );
}

function SectionCard({
  section,
  items,
  records,
  onToggleCheck,
  onUpdateData,
  onToggleNA,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onReorderItems,
  onEditSection,
  onDeleteSection,
}: {
  section: Section;
  items: CheckItem[];
  records: Map<string, CheckRecord>;
  onToggleCheck: (itemId: string) => void;
  onUpdateData: (itemId: string, value: string) => void;
  onToggleNA: (itemId: string) => void;
  onAddItem: (sectionId: string) => void;
  onEditItem: (item: CheckItem) => void;
  onDeleteItem: (itemId: string) => void;
  onReorderItems: (sectionId: string, reorderedItems: CheckItem[]) => void;
  onEditSection: (section: Section) => void;
  onDeleteSection: (sectionId: string) => void;
}) {
  const color = getSectionColor(section.name);
  // Local state for drag reorder — syncs from props, updated on drag
  const [sortedItems, setSortedItems] = useState<CheckItem[]>([]);
  useEffect(() => {
    setSortedItems([...items].sort((a, b) => a.sort_order - b.sort_order));
  }, [items]);
  const checkedCount = items.filter((i) => records.get(i.id)?.checked).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;
  const isComplete = totalCount > 0 && checkedCount === totalCount;

  // Section total data count
  const filledDataCount = items.filter(
    (i) => i.has_data_field && records.get(i.id)?.data_status === 'filled'
  ).length;

  // Empty section — compact inline row instead of full card
  if (totalCount === 0) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          'col-span-1 lg:col-span-2 flex items-center gap-3 rounded-xl border bg-gradient-to-r px-4 py-2.5',
          color.border,
          color.bg
        )}
      >
        <div className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1', color.badge)}>
          <span className="text-[14px]">{color.emoji}</span>
          <span className="text-[12px] font-bold">{section.name}</span>
        </div>
        <span className="text-[11px] text-stone-400">항목 없음</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAddItem(section.id)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-stone-500 hover:bg-white/60 transition-colors"
          >
            <Plus className="size-3" />
            추가
          </button>
          <button type="button" onClick={() => onEditSection(section)} className="rounded-md p-1 text-stone-400 hover:text-stone-600 transition-colors">
            <Pencil className="size-3" />
          </button>
          <button type="button" onClick={() => onDeleteSection(section.id)} className="rounded-md p-1 text-stone-400 hover:text-red-500 transition-colors">
            <Trash2 className="size-3" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'rounded-2xl border bg-gradient-to-br p-0.5 transition-shadow duration-300',
        color.border,
        color.bg,
        isComplete && `shadow-lg ${color.glow}`
      )}
    >
      <div className="rounded-[14px] bg-white/80 backdrop-blur-sm">
        {/* Section Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2.5">
            <div className={cn('flex items-center gap-1.5 rounded-xl px-3 py-1.5', color.badge)}>
              <span className="text-[15px]">{isComplete ? color.completedEmoji : color.emoji}</span>
              <span className="text-[13px] font-bold">{section.name}</span>
            </div>
            <span className="text-[12px] text-stone-400 font-medium tabular-nums">
              {checkedCount}/{totalCount}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {isComplete && (
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: [1, 1.1, 1], rotate: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 12 }}
                className="flex items-center gap-1 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 px-3 py-1 text-[11px] font-bold text-white shadow-md shadow-green-200/50"
              >
                <span className="text-[13px]">🎊</span>
                완료!
              </motion.div>
            )}
            <button
              type="button"
              onClick={() => onEditSection(section)}
              className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteSection(section.id)}
              className="rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-4 pb-3">
          <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
            <motion.div
              className={cn(
                'h-full rounded-full',
                isComplete ? 'bg-green-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'
              )}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            />
          </div>
        </div>

        {/* Items */}
        <div className="px-3 pb-2 space-y-1.5">
          <Reorder.Group
            axis="y"
            values={sortedItems}
            onReorder={(newOrder) => {
              setSortedItems(newOrder);
              onReorderItems(section.id, newOrder);
            }}
            className="space-y-1.5"
          >
            {sortedItems.map((item) => (
              <ReorderableItem
                key={item.id}
                item={item}
                record={records.get(item.id)}
                onToggleCheck={onToggleCheck}
                onUpdateData={onUpdateData}
                onToggleNA={onToggleNA}
                onEditItem={onEditItem}
                onDeleteItem={onDeleteItem}
              />
            ))}
          </Reorder.Group>
        </div>

        {/* Add Item Button */}
        <div className="px-3 pb-4">
          <button
            type="button"
            onClick={() => onAddItem(section.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-stone-200 py-2 text-[12px] font-medium text-stone-400 hover:border-stone-300 hover:text-stone-600 hover:bg-stone-50 transition-all"
          >
            <Plus className="size-3.5" />
            항목 추가
          </button>
        </div>

        {/* Section Summary */}
        {totalCount > 0 && (
          <div className="border-t border-stone-100 px-4 py-2.5 flex items-center justify-between">
            <span className="text-[11px] text-stone-400">
              금일 체크: <span className="font-bold text-stone-600">{checkedCount}</span>/{totalCount}
            </span>
            {items.some((i) => i.has_data_field) && (
              <span className="text-[11px] text-stone-400">
                데이터 입력: <span className="font-bold text-stone-600">{filledDataCount}</span>건
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Dialogs ──────────────────────────────────────────────────────────
function SectionDialog({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  initial?: string;
}) {
  const [name, setName] = useState(initial ?? '');
  useEffect(() => setName(initial ?? ''), [initial, open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-[15px]">
            {initial ? '섹션 수정' : '새 섹션 추가'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Input
            placeholder="섹션 이름 (예: 영업, 마케팅)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                onSave(name.trim());
                onClose();
              }
            }}
            className="rounded-xl"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl">
              취소
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (name.trim()) {
                  onSave(name.trim());
                  onClose();
                }
              }}
              className="rounded-xl"
            >
              {initial ? '수정' : '추가'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (label: string, hasDataField: boolean) => void;
  initial?: { label: string; has_data_field: boolean };
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [hasData, setHasData] = useState(initial?.has_data_field ?? true);
  useEffect(() => {
    setLabel(initial?.label ?? '');
    setHasData(initial?.has_data_field ?? true);
  }, [initial, open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-[15px]">
            {initial ? '항목 수정' : '새 항목 추가'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Input
            placeholder="체크리스트 항목명"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && label.trim()) {
                onSave(label.trim(), hasData);
                onClose();
              }
            }}
            className="rounded-xl"
            autoFocus
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasData}
              onChange={(e) => setHasData(e.target.checked)}
              className="rounded"
            />
            <span className="text-[13px] text-stone-600">데이터 입력란 표시</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl">
              취소
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (label.trim()) {
                  onSave(label.trim(), hasData);
                  onClose();
                }
              }}
              className="rounded-xl"
            >
              {initial ? '수정' : '추가'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────
export default function MustCheckPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => getKSTDate());
  const dateStr = formatKSTDateStr(selectedDate);

  // Dialog state
  const [sectionDialog, setSectionDialog] = useState<{ open: boolean; section?: Section }>({ open: false });
  const [itemDialog, setItemDialog] = useState<{ open: boolean; sectionId?: string; item?: CheckItem }>({ open: false });

  // ─── Queries ──────────────────────────────────────────────────────
  const { data: sections = [] } = useQuery({
    queryKey: queryKeys.mustCheck.sections,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('must_check_sections')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as Section[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: queryKeys.mustCheck.items,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('must_check_items')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as CheckItem[];
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: queryKeys.mustCheck.records(dateStr),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('must_check_records')
        .select('*')
        .eq('check_date', dateStr);
      if (error) throw error;
      return data as CheckRecord[];
    },
  });

  // Records map
  const recordsMap = useMemo(() => {
    const map = new Map<string, CheckRecord>();
    records.forEach((r) => map.set(r.item_id, r));
    return map;
  }, [records]);

  // Items by section
  const itemsBySection = useMemo(() => {
    const map = new Map<string, CheckItem[]>();
    sections.forEach((s) => map.set(s.id, []));
    items.forEach((i) => {
      const arr = map.get(i.section_id);
      if (arr) arr.push(i);
    });
    return map;
  }, [sections, items]);

  // ─── Mutations ────────────────────────────────────────────────────
  const upsertRecord = useMutation({
    mutationFn: async (params: {
      item_id: string;
      checked?: boolean;
      data_value?: string;
      data_status?: 'pending' | 'filled' | 'not_applicable';
    }) => {
      const existing = recordsMap.get(params.item_id);
      const payload: Record<string, unknown> = {
        item_id: params.item_id,
        check_date: dateStr,
      };
      if (params.checked !== undefined) {
        payload.checked = params.checked;
        payload.checked_by = user?.id;
        payload.checked_at = params.checked ? new Date().toISOString() : null;
      }
      if (params.data_value !== undefined) {
        payload.data_value = params.data_value;
        payload.data_status = params.data_value ? 'filled' : 'pending';
      }
      if (params.data_status !== undefined) {
        payload.data_status = params.data_status;
        if (params.data_status === 'not_applicable') {
          payload.data_value = null;
        }
      }

      if (existing) {
        const { error } = await supabase
          .from('must_check_records')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('must_check_records')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mustCheck.records(dateStr) });
    },
  });

  const toggleCheck = useCallback(
    (itemId: string) => {
      const existing = recordsMap.get(itemId);
      upsertRecord.mutate({ item_id: itemId, checked: !(existing?.checked ?? false) });
    },
    [recordsMap, upsertRecord]
  );

  const updateData = useCallback(
    (itemId: string, value: string) => {
      upsertRecord.mutate({ item_id: itemId, data_value: value });
    },
    [upsertRecord]
  );

  const toggleNA = useCallback(
    (itemId: string) => {
      const existing = recordsMap.get(itemId);
      const currentStatus = existing?.data_status ?? 'pending';
      const newStatus = currentStatus === 'not_applicable' ? 'pending' : 'not_applicable';
      upsertRecord.mutate({ item_id: itemId, data_status: newStatus });
    },
    [recordsMap, upsertRecord]
  );

  // Section CRUD
  const addSection = useMutation({
    mutationFn: async (name: string) => {
      const maxOrder = Math.max(0, ...sections.map((s) => s.sort_order));
      const { error } = await supabase
        .from('must_check_sections')
        .insert({ name, sort_order: maxOrder + 1 });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mustCheck.sections }),
  });

  const updateSection = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('must_check_sections')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mustCheck.sections }),
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('must_check_sections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mustCheck.sections });
      queryClient.invalidateQueries({ queryKey: queryKeys.mustCheck.items });
    },
  });

  // Item CRUD
  const addItem = useMutation({
    mutationFn: async ({
      sectionId,
      label,
      hasDataField,
    }: {
      sectionId: string;
      label: string;
      hasDataField: boolean;
    }) => {
      const sectionItems = itemsBySection.get(sectionId) ?? [];
      const maxOrder = Math.max(0, ...sectionItems.map((i) => i.sort_order));
      const { error } = await supabase
        .from('must_check_items')
        .insert({ section_id: sectionId, label, has_data_field: hasDataField, sort_order: maxOrder + 1 });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mustCheck.items }),
  });

  const updateItem = useMutation({
    mutationFn: async ({
      id,
      label,
      hasDataField,
    }: {
      id: string;
      label: string;
      hasDataField: boolean;
    }) => {
      const { error } = await supabase
        .from('must_check_items')
        .update({ label, has_data_field: hasDataField, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mustCheck.items }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('must_check_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mustCheck.items }),
  });

  // Item reorder (drag & drop)
  const reorderItems = useMutation({
    mutationFn: async ({ sectionId, reorderedItems }: { sectionId: string; reorderedItems: CheckItem[] }) => {
      // Assign new sort_order based on array index
      const updates = reorderedItems.map((item, idx) => ({
        id: item.id,
        sort_order: idx,
      }));

      // Batch update all items in the section
      const results = await Promise.all(
        updates.map(({ id, sort_order }) =>
          supabase.from('must_check_items').update({ sort_order }).eq('id', id)
        )
      );
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mustCheck.items }),
  });

  const reorderDebounceRef = useRef<NodeJS.Timeout>(undefined);
  const handleReorderItems = useCallback(
    (sectionId: string, reorderedItems: CheckItem[]) => {
      // Debounce DB save — only persist after drag settles
      clearTimeout(reorderDebounceRef.current);
      reorderDebounceRef.current = setTimeout(() => {
        reorderItems.mutate({ sectionId, reorderedItems });
      }, 400);
    },
    [reorderItems]
  );

  // ─── Stats ────────────────────────────────────────────────────────
  const totalItems = items.length;
  const totalChecked = items.filter((i) => recordsMap.get(i.id)?.checked).length;
  const overallProgress = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0;

  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const prevProgressRef = useRef(overallProgress);
  useEffect(() => {
    if (overallProgress === 100 && prevProgressRef.current < 100 && totalItems > 0) {
      setShowCelebration(true);
    }
    prevProgressRef.current = overallProgress;
  }, [overallProgress, totalItems]);

  // ─── Handlers ─────────────────────────────────────────────────────
  const handleSaveSection = useCallback(
    (name: string) => {
      if (sectionDialog.section) {
        updateSection.mutate({ id: sectionDialog.section.id, name });
      } else {
        addSection.mutate(name);
      }
    },
    [sectionDialog.section, updateSection, addSection]
  );

  const handleSaveItem = useCallback(
    (label: string, hasDataField: boolean) => {
      if (itemDialog.item) {
        updateItem.mutate({ id: itemDialog.item.id, label, hasDataField });
      } else if (itemDialog.sectionId) {
        addItem.mutate({ sectionId: itemDialog.sectionId, label, hasDataField });
      }
    },
    [itemDialog, updateItem, addItem]
  );

  const handleDeleteSection = useCallback(
    (id: string) => {
      if (confirm('이 섹션과 모든 체크리스트 항목이 삭제됩니다. 계속하시겠습니까?')) {
        deleteSection.mutate(id);
      }
    },
    [deleteSection]
  );

  const handleDeleteItem = useCallback(
    (id: string) => {
      if (confirm('이 항목을 삭제하시겠습니까?')) {
        deleteItem.mutate(id);
      }
    },
    [deleteItem]
  );

  // ─── Effects (confetti + character) rendered via portal ──────────
  const [effectBurst, setEffectBurst] = useState<EffectPos | null>(null);
  const [effectChar, setEffectChar] = useState<EffectPos | null>(null);
  const [portalMounted, setPortalMounted] = useState(false);
  useEffect(() => setPortalMounted(true), []);

  const triggerCheckEffects = useCallback((pos: EffectPos) => {
    setEffectBurst(pos);
    setEffectChar(pos);
    setTimeout(() => setEffectBurst(null), 600);
    setTimeout(() => setEffectChar(null), 1200);
  }, []);

  return (
    <EffectsContext.Provider value={triggerCheckEffects}>
    <div className="space-y-5">
      {/* Effects portal — renders on document.body to escape all transform contexts */}
      {portalMounted && createPortal(
        <>
          <AnimatePresence>
            {effectBurst && <ConfettiBurst x={effectBurst.x} y={effectBurst.y} />}
          </AnimatePresence>
          <AnimatePresence>
            {effectChar && <CharacterPop x={effectChar.x} y={effectChar.y} />}
          </AnimatePresence>
        </>,
        document.body
      )}

      {/* Celebration Overlay */}
      <AnimatePresence>
        {showCelebration && (
          <CelebrationOverlay show={showCelebration} onClose={() => setShowCelebration(false)} />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            className="text-[28px]"
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
          >
            🛡️
          </motion.div>
          <div>
            <h1 className="text-[20px] font-bold text-stone-900 tracking-tight">
              반드시 체크리스트
            </h1>
            <p className="text-[12px] text-stone-400 mt-0.5">
              매일 확인해야 할 핵심 업무 체크리스트
            </p>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded-xl"
            onClick={() => setSelectedDate((d) => subDays(d, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-8 rounded-xl px-3 text-[13px] font-medium min-w-[140px]"
              >
                <CalendarDays className="size-3.5 mr-1.5" />
                {format(selectedDate, 'yyyy.MM.dd (EEE)', { locale: ko })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-2xl" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                locale={ko}
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded-xl"
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-xl text-[12px]"
            onClick={() => setSelectedDate(getKSTDate())}
          >
            오늘
          </Button>
        </div>
      </div>

      {/* Overall Progress */}
      {(() => {
        const character = getProgressCharacter(overallProgress);
        return (
          <motion.div
            className={cn(
              'rounded-2xl border p-5 transition-all duration-500 relative overflow-hidden',
              overallProgress === 100
                ? 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border-green-200/60 shadow-xl shadow-green-100/40'
                : 'bg-gradient-to-br from-white via-stone-50/50 to-orange-50/30 border-stone-200/60'
            )}
          >
            {/* Shimmer effect */}
            {overallProgress === 100 && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              />
            )}

            <div className="flex items-center justify-between mb-4 relative">
              <div className="flex items-center gap-4">
                <motion.div
                  className="text-[40px] leading-none"
                  animate={overallProgress === 100
                    ? { scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] }
                    : { scale: [1, 1.05, 1] }
                  }
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                >
                  {character.emoji}
                </motion.div>
                <div>
                  <p className="text-[12px] text-stone-400 font-medium">{character.label}</p>
                  <p className="text-[28px] font-black text-stone-900 leading-tight tabular-nums">
                    {overallProgress}%
                    <span className="text-[13px] font-medium text-stone-400 ml-2">
                      ({totalChecked}/{totalItems})
                    </span>
                  </p>
                </div>
              </div>

              {overallProgress === 100 && (
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 px-5 py-2.5 text-white text-[14px] font-bold shadow-lg shadow-green-200/50"
                >
                  <span className="text-[18px]">🏆</span>
                  ALL CLEAR!
                </motion.div>
              )}
            </div>

            {/* Progress bar with character indicator */}
            <div className="relative">
              <div className="h-3 w-full rounded-full bg-stone-100/80 overflow-hidden backdrop-blur-sm">
                <motion.div
                  className={cn(
                    'h-full rounded-full relative',
                    overallProgress === 100
                      ? 'bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400'
                      : 'bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${overallProgress}%` }}
                  transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                >
                  {/* Shimmer on bar */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                  />
                </motion.div>
              </div>
              {/* Floating emoji on progress edge */}
              {overallProgress > 0 && overallProgress < 100 && (
                <motion.div
                  className="absolute -top-3 text-[18px]"
                  style={{ left: `${Math.min(overallProgress, 95)}%` }}
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {character.emoji}
                </motion.div>
              )}
            </div>

            {/* Per-section quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
              {sections.map((section) => {
                const sItems = itemsBySection.get(section.id) ?? [];
                const sChecked = sItems.filter((i) => recordsMap.get(i.id)?.checked).length;
                const sTotal = sItems.length;
                const sColor = getSectionColor(section.name);
                const sComplete = sChecked === sTotal && sTotal > 0;
                return (
                  <motion.div
                    key={section.id}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-3 py-2.5 border transition-all duration-300',
                      sComplete
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200/60 shadow-sm shadow-green-100/50'
                        : 'bg-white/80 border-stone-100 hover:border-stone-200'
                    )}
                    animate={sComplete ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    <span className="text-[14px]">{sComplete ? sColor.completedEmoji : sColor.emoji}</span>
                    <span className={cn('text-[11px] font-bold', sColor.text)}>{section.name}</span>
                    <span className="text-[11px] text-stone-400 ml-auto tabular-nums font-medium">
                      {sChecked}/{sTotal}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        );
      })()}

      {/* Section Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {sections
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                items={itemsBySection.get(section.id) ?? []}
                records={recordsMap}
                onToggleCheck={toggleCheck}
                onUpdateData={updateData}
                onToggleNA={toggleNA}
                onAddItem={(sectionId) => setItemDialog({ open: true, sectionId })}
                onEditItem={(item) => setItemDialog({ open: true, item })}
                onDeleteItem={handleDeleteItem}
                onReorderItems={handleReorderItems}
                onEditSection={(s) => setSectionDialog({ open: true, section: s })}
                onDeleteSection={handleDeleteSection}
              />
            ))}
        </AnimatePresence>
      </div>

      {/* Add Section Button */}
      <motion.button
        type="button"
        onClick={() => setSectionDialog({ open: true })}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-200 py-4 text-[13px] font-medium text-stone-400 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50/30 transition-all"
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
      >
        <Plus className="size-4" />
        새 섹션 추가
      </motion.button>

      {/* Dialogs */}
      <SectionDialog
        open={sectionDialog.open}
        onClose={() => setSectionDialog({ open: false })}
        onSave={handleSaveSection}
        initial={sectionDialog.section?.name}
      />
      <ItemDialog
        open={itemDialog.open}
        onClose={() => setItemDialog({ open: false })}
        onSave={handleSaveItem}
        initial={itemDialog.item ? { label: itemDialog.item.label, has_data_field: itemDialog.item.has_data_field } : undefined}
      />
    </div>
    </EffectsContext.Provider>
  );
}
