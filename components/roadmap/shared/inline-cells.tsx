'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function InlineTextCell({
  value,
  isEditing,
  onStartEdit,
  onSave,
  className,
  placeholder,
}: {
  value: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (isEditing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [isEditing, value]);

  if (!isEditing) {
    return (
      <span
        className={cn(
          'cursor-text rounded px-1 -mx-1 hover:bg-orange-50/50 transition-colors truncate block min-h-[16px] leading-tight',
          !value && 'text-muted-foreground/30',
          className,
        )}
        onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
      >
        {value || placeholder || '-'}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      className={cn(
        'w-full bg-background border border-primary/40 rounded px-1.5 py-0.5 text-sm outline-none ring-1 ring-primary/20 -mx-1',
        className,
      )}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { onSave(draft); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) { onSave(draft); }
        if (e.key === 'Escape') { onSave(value); }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export function InlineDateCell({
  value,
  isEditing,
  onStartEdit,
  onSave,
}: {
  value: string | null;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (v: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing]);

  if (!isEditing) {
    return (
      <span
        className="cursor-text rounded px-1 -mx-1 hover:bg-orange-50/50 transition-colors text-xs min-h-[16px] leading-tight block"
        onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
      >
        {value || '-'}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      type="date"
      className="w-full bg-background border border-primary/40 rounded px-1 py-0.5 text-xs outline-none ring-1 ring-primary/20 -mx-1"
      value={value ?? ''}
      onChange={(e) => onSave(e.target.value || null)}
      onBlur={() => onSave(value)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export function InlineMemoCell({
  value,
  isEditing,
  onStartEdit,
  onSave,
}: {
  value: string | null;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (v: string | null) => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    if (isEditing) {
      setDraft(value ?? '');
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [isEditing, value]);

  if (!isEditing) {
    return (
      <span
        className="cursor-text rounded px-1 -mx-1 hover:bg-orange-50/50 transition-colors text-xs truncate block min-h-[16px] leading-tight"
        onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
        title={value ?? ''}
      >
        {value || '-'}
      </span>
    );
  }

  return (
    <textarea
      ref={inputRef}
      className="w-[200px] bg-background border border-primary/40 rounded px-1.5 py-1 text-xs outline-none ring-1 ring-primary/20 -mx-1 resize-none"
      rows={3}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onSave(draft || null)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onSave(value);
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
