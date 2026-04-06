'use client';

import { useState, useRef } from 'react';
import { Expand, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ExpandableTextCell({
  value,
  name,
  label,
  placeholder,
  onSave,
}: {
  value: string;
  name: string;
  label: string;
  placeholder?: string;
  onSave: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [inlineEditing, setInlineEditing] = useState(false);
  const [popupEditing, setPopupEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inlineRef = useRef<HTMLTextAreaElement>(null);
  const popupRef = useRef<HTMLTextAreaElement>(null);

  const handleInlineSave = () => {
    setInlineEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== (value || '')) onSave(trimmed || null as unknown as string);
  };

  const handlePopupSave = () => {
    const trimmed = draft.trim();
    if (trimmed !== (value || '')) onSave(trimmed || null as unknown as string);
    setPopupEditing(false);
  };

  return (
    <>
      <div className="flex items-center gap-0.5 min-w-0">
        {inlineEditing ? (
          <textarea
            ref={inlineRef}
            className="flex-1 text-[11px] bg-orange-50/50 border border-orange-400 rounded px-1.5 py-0.5 outline-none resize-none leading-relaxed -mx-1 overflow-y-auto overflow-x-hidden"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleInlineSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) handleInlineSave();
              if (e.key === 'Escape') { setDraft(value); setInlineEditing(false); }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className={cn(
              'flex-1 cursor-text rounded px-1 -mx-1 hover:bg-orange-50/50 transition-colors min-h-[16px] max-h-[48px] overflow-y-auto overflow-x-hidden leading-tight text-[11px] break-words whitespace-pre-wrap',
              value ? 'text-foreground' : 'text-muted-foreground/30',
            )}
            onClick={(e) => { e.stopPropagation(); setDraft(value); setInlineEditing(true); setTimeout(() => inlineRef.current?.focus(), 0); }}
          >
            {value || placeholder || '-'}
          </div>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setDraft(value); setPopupEditing(false); setOpen(true); }}
          className={cn('shrink-0 p-0.5 rounded transition-colors', value ? 'text-stone-400 hover:text-orange-600 hover:bg-orange-50' : 'text-stone-200 hover:text-stone-400 hover:bg-stone-50')}
        >
          <Expand className="size-3" />
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setOpen(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[560px] max-w-[90vw] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50/80">
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] font-bold text-stone-800 truncate">{name}</h3>
                <span className="text-[10px] text-stone-400">{label}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!popupEditing && <button type="button" className="px-2.5 py-1 text-[11px] font-medium border border-stone-200 rounded-lg hover:bg-stone-50" onClick={() => { setPopupEditing(true); setTimeout(() => popupRef.current?.focus(), 50); }}>수정</button>}
                {popupEditing && <button type="button" className="px-2.5 py-1 text-[11px] font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600" onClick={handlePopupSave}>저장</button>}
                <button type="button" className="p-1.5 rounded-lg hover:bg-stone-200" onClick={() => setOpen(false)}>
                  <X className="size-4 text-stone-500" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {popupEditing ? (
                <textarea
                  ref={popupRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) handlePopupSave(); }}
                  className="w-full text-[13px] border border-orange-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-orange-200 resize-none leading-relaxed min-h-[200px]"
                  placeholder={placeholder || '내용을 입력하세요...'}
                />
              ) : (
                <div className="text-[13px] text-stone-800 whitespace-pre-wrap leading-relaxed bg-stone-50/50 rounded-xl p-4 border border-stone-100 min-h-[120px]">
                  {value || <span className="text-stone-300">내용이 없습니다</span>}
                </div>
              )}
              {popupEditing && <p className="text-[10px] text-stone-400 mt-2">Ctrl+Enter로 저장</p>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
