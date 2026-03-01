'use client';

import { ChevronDown, ChevronRight, Trash2, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PlatformManual } from '@/lib/types/database';

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
        <a key={m.index} href={m[4]} target="_blank" rel="noopener noreferrer" className="text-foreground underline hover:text-foreground/80">{m[3]}</a>
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
  return (
    <div className={cn(
      'rounded-lg border border-border bg-card transition-all duration-200',
      isExpanded && 'shadow-sm'
    )}>
      <div
        onClick={onToggle}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/30 transition-colors rounded-lg"
      >
        {isExpanded ? (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium truncate">{manual.title}</h3>
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0 rounded-full">
              {manual.manual_type}
            </Badge>
            {manual.country && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 gap-0.5 border-border">
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
            <Trash2 className="size-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border pt-3">
          <MarkdownContent text={manual.content} />
        </div>
      )}
    </div>
  );
}
