'use client';

import { useState, useCallback, useRef, memo } from 'react';
import { ChevronDown, Copy, Check, Pencil, Trash2, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { CsManualTemplate, CsManualTemplateVariable } from '@/lib/types/database';

const TAG_COLORS: Record<string, string> = {
  orange: 'bg-orange-50 text-orange-600 border-orange-200',
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  yellow: 'bg-amber-50 text-amber-600 border-amber-200',
  red: 'bg-red-50 text-red-600 border-red-200',
  purple: 'bg-violet-50 text-violet-600 border-violet-200',
};

function renderTemplate(content: string, values: Record<string, string>): string {
  return content.replace(/\{([^}]+)\}/g, (match, key) => {
    const val = values[key];
    return val && val.trim() ? val : match;
  });
}

function VariableInputs({
  variables,
  values,
  onChange,
}: {
  variables: CsManualTemplateVariable[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  if (variables.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3 p-3 rounded-lg bg-secondary/40 border border-border">
      <span className="text-[10px] font-semibold text-muted-foreground w-full mb-1">변수 입력</span>
      {variables.map((v) => (
        <div key={v.key} className="flex items-center gap-1.5">
          <Label className="text-[11px] text-muted-foreground whitespace-nowrap">{v.label}</Label>
          <Input
            className="h-7 text-xs w-[140px] bg-background border-border"
            placeholder={v.default || v.label}
            defaultValue={values[v.key] || ''}
            onChange={(e) => onChange(v.key, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

const TemplateMessage = memo(function TemplateMessage({
  template,
  onEdit,
  onDelete,
}: {
  template: CsManualTemplate;
  onEdit?: (t: CsManualTemplate) => void;
  onDelete?: (id: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const handleChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const rendered = renderTemplate(template.content, values);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(rendered);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [rendered]);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
          {template.label}
        </span>
        <div className="flex items-center gap-1">
          {onEdit && (
            <Button variant="ghost" size="icon" className="size-6" onClick={() => onEdit(template)}>
              <Pencil className="size-3 text-muted-foreground" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => {
                if (confirm('이 템플릿을 삭제하시겠습니까?')) onDelete(template.id);
              }}
            >
              <Trash2 className="size-3 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      <div className="relative rounded-md bg-secondary/30 border border-border p-4">
        <pre className="text-[12.5px] leading-[1.85] text-foreground/80 whitespace-pre-wrap font-[inherit]">
          {rendered}
        </pre>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'absolute top-2.5 right-2.5 h-7 text-[11px] gap-1 border-border',
            copied && 'bg-emerald-50 border-emerald-300 text-emerald-600'
          )}
          onClick={handleCopy}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? '완료' : '복사'}
        </Button>
      </div>

      {template.variables.length > 0 && (
        <VariableInputs variables={template.variables} values={values} onChange={handleChange} />
      )}

      {template.tip && (
        <div className="flex items-start gap-2 mt-2.5 p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
          <Lightbulb className="size-3.5 mt-0.5 shrink-0" />
          <span className="text-[11px] leading-relaxed">{template.tip}</span>
        </div>
      )}
    </div>
  );
});

export const CsFunnelStep = memo(function CsFunnelStep({
  stepNumber,
  title,
  tag,
  tagColor,
  templates,
  isOpen,
  onToggle,
  onEditTemplate,
  onDeleteTemplate,
}: {
  stepNumber: string;
  title: string;
  tag: string | null;
  tagColor: string;
  templates: CsManualTemplate[];
  isOpen: boolean;
  onToggle: () => void;
  onEditTemplate?: (t: CsManualTemplate) => void;
  onDeleteTemplate?: (id: string) => void;
}) {
  const badgeColorClass = TAG_COLORS[tagColor] || TAG_COLORS.orange;

  return (
    <div className={cn('rounded-lg border border-border bg-card overflow-hidden transition-shadow', isOpen && 'shadow-sm')}>
      <button
        onClick={onToggle}
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className={cn(
          'size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
          badgeColorClass
        )}>
          {stepNumber}
        </div>
        <span className="flex-1 text-sm font-semibold truncate">{title}</span>
        {tag && (
          <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 rounded-full border', badgeColorClass)}>
            {tag}
          </Badge>
        )}
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 border-t border-border">
          {templates.map((t) => (
            <TemplateMessage
              key={t.id}
              template={t}
              onEdit={onEditTemplate}
              onDelete={onDeleteTemplate}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export function CsTemplateEditDialog({
  template,
  open,
  onOpenChange,
  onSave,
}: {
  template: CsManualTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: { label: string; content: string; tip: string | null; variables: CsManualTemplateVariable[] }) => void;
}) {
  const labelRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const tipRef = useRef<HTMLTextAreaElement>(null);

  if (!template) return null;

  const handleSave = () => {
    const label = labelRef.current?.value.trim() || template.label;
    const content = contentRef.current?.value || template.content;
    const tip = tipRef.current?.value.trim() || null;

    // Auto-detect variables from content
    const varKeys = new Set<string>();
    const regex = /\{([^}]+)\}/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
      varKeys.add(m[1]);
    }
    const existingVars = new Map(template.variables.map((v) => [v.key, v]));
    const variables: CsManualTemplateVariable[] = Array.from(varKeys).map((key) => {
      const existing = existingVars.get(key);
      return existing || { key, label: key, default: '' };
    });

    onSave(template.id, { label, content, tip, variables });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>템플릿 수정</DialogTitle>
          <DialogDescription>메시지 내용을 수정합니다. {'{'}변수명{'}'} 형태로 변수를 삽입할 수 있습니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>라벨</Label>
            <Input ref={labelRef} defaultValue={template.label} className="border-border" />
          </div>
          <div className="space-y-2">
            <Label>내용</Label>
            <Textarea ref={contentRef} defaultValue={template.content} rows={14} className="border-border text-[13px] leading-relaxed font-mono" />
          </div>
          <div className="space-y-2">
            <Label>팁 (선택)</Label>
            <Textarea ref={tipRef} defaultValue={template.tip || ''} rows={2} className="border-border text-[13px]" placeholder="💡 핵심 포인트를 입력하세요" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">취소</Button>
          <Button onClick={handleSave} className="bg-foreground text-background hover:bg-foreground/90">저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
