'use client';

import { ChevronDown, ChevronRight, Trash2, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PlatformManual } from '@/lib/types/database';

const MANUAL_TYPE_CONFIG: Record<string, { className: string }> = {
  '세팅가이드': { className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' },
  '운영가이드': { className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30' },
  'FAQ': { className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' },
  '트러블슈팅': { className: 'bg-red-100 text-red-700 dark:bg-red-900/30' },
};

/** Render inline markdown formatting: bold and links */
function InlineFormat({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\))/g;
  let lastIdx = 0;
  let m;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > lastIdx) {
      parts.push(text.slice(lastIdx, m.index));
    }
    if (m[2]) {
      parts.push(<strong key={m.index} className="font-semibold">{m[2]}</strong>);
    } else if (m[3] && m[4]) {
      parts.push(
        <a key={m.index} href={m[4]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{m[3]}</a>
      );
    }
    lastIdx = pattern.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return <>{parts}</>;
}

/** Render markdown content as safe React elements */
function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-sm font-semibold mt-4 mb-1.5">{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-base font-bold mt-5 mb-2">{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-lg font-bold mt-5 mb-2">{line.slice(2)}</h1>);
    } else if (/^\d+\. /.test(line)) {
      elements.push(
        <li key={i} className="ml-4 list-decimal text-[12px] leading-relaxed">
          <InlineFormat text={line.replace(/^\d+\. /, '')} />
        </li>
      );
    } else if (line.startsWith('- ')) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-[12px] leading-relaxed">
          <InlineFormat text={line.slice(2)} />
        </li>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-[12px] leading-relaxed">
          <InlineFormat text={line} />
        </p>
      );
    }
  }

  return <div className="space-y-0.5">{elements}</div>;
}

export function ManualViewer({
  manual,
  isExpanded,
  onToggle,
  onDelete,
}: {
  manual: PlatformManual;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete?: () => void;
}) {
  const typeConfig = MANUAL_TYPE_CONFIG[manual.manual_type] ?? MANUAL_TYPE_CONFIG['세팅가이드'];

  return (
    <div className={cn(
      'rounded-xl border bg-card transition-all duration-200',
      isExpanded && 'shadow-sm'
    )}>
      <div
        onClick={onToggle}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-xl"
      >
        {isExpanded ? (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium truncate">{manual.title}</h3>
            <Badge variant="secondary" className={cn('text-[9px] px-1.5 py-0 shrink-0', typeConfig.className)}>
              {manual.manual_type}
            </Badge>
            {manual.country && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 gap-0.5">
                <Globe className="size-2.5" />
                {manual.country}
              </Badge>
            )}
          </div>
        </div>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('이 매뉴얼을 삭제하시겠습니까?')) onDelete();
            }}
          >
            <Trash2 className="size-3.5 text-red-500" />
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t pt-3">
          <MarkdownContent text={manual.content} />
        </div>
      )}
    </div>
  );
}
