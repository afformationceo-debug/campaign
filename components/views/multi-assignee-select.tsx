'use client';

import { useState, useCallback } from 'react';
import { Check, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { User } from '@/lib/types/database';

interface MultiAssigneeSelectProps {
  assigneeIds: string[];
  users: User[];
  onSave: (ids: string[]) => void;
  className?: string;
  triggerClassName?: string;
  size?: 'sm' | 'xs';
}

export function MultiAssigneeSelect({
  assigneeIds,
  users,
  onSave,
  className,
  triggerClassName,
  size = 'sm',
}: MultiAssigneeSelectProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(assigneeIds));

  const activeUsers = users.filter((u) => u.is_active);
  const displayNames = assigneeIds
    .map((id) => users.find((u) => u.id === id)?.name)
    .filter(Boolean);

  const handleOpen = useCallback((isOpen: boolean) => {
    if (isOpen) {
      setSelected(new Set(assigneeIds));
    } else {
      // 닫힐 때 변경사항 저장
      const newIds = Array.from(selected);
      const oldIds = [...assigneeIds].sort();
      const newSorted = [...newIds].sort();
      if (JSON.stringify(oldIds) !== JSON.stringify(newSorted)) {
        onSave(newIds);
      }
    }
    setOpen(isOpen);
  }, [assigneeIds, selected, onSave]);

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const isXs = size === 'xs';

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'text-left truncate transition-colors',
            isXs ? 'h-5 text-[10px] px-1' : 'h-6 text-[11px] px-1',
            'border-0 bg-transparent text-muted-foreground hover:text-foreground hover:bg-stone-50 rounded-md',
            triggerClassName
          )}
        >
          {displayNames.length > 0 ? (
            <span className="truncate">
              {displayNames.length <= 2
                ? displayNames.join(', ')
                : `${displayNames[0]} 외 ${displayNames.length - 1}명`}
            </span>
          ) : (
            <span className="text-muted-foreground/40">-</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[180px] p-1.5 rounded-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-[10px] font-bold text-stone-500 px-2 py-1">담당자 선택 (복수)</p>
        <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
          {activeUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => toggle(user.id)}
              className={cn(
                'flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[12px] transition-colors',
                selected.has(user.id) ? 'bg-orange-50 text-orange-700 font-medium' : 'text-stone-600 hover:bg-stone-50'
              )}
            >
              <div className={cn(
                'size-4 rounded border flex items-center justify-center shrink-0',
                selected.has(user.id) ? 'bg-orange-500 border-orange-500' : 'border-stone-300'
              )}>
                {selected.has(user.id) && <Check className="size-3 text-white" />}
              </div>
              {user.name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
