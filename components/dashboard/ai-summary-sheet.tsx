'use client';

import { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, RefreshCw, Copy, Check, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { SummaryDimension } from '@/lib/ai/types';
import { DIMENSION_LABELS } from '@/lib/ai/types';

const DIMENSIONS: SummaryDimension[] = [
  'all', 'assignee', 'campaign', 'daily', 'project', 'qa', 'config',
];

export function AiSummarySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [dimension, setDimension] = useState<SummaryDimension>('all');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchSummary = useCallback(async (dim: SummaryDimension) => {
    // Abort previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setContent('');
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimension: dim }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });
        setContent(accumulated);

        // Auto-scroll
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '요약 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDimensionChange = (dim: SummaryDimension) => {
    setDimension(dim);
    fetchSummary(dim);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-fetch when sheet opens
  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (open && !content && !isLoading) {
      fetchSummary(dimension);
    }
    if (!open && abortRef.current) {
      abortRef.current.abort();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px] flex flex-col gap-0 p-0">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Bot className="size-5 text-primary" />
              AI 현황 요약
            </SheetTitle>
            <div className="flex items-center gap-1">
              {content && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleCopy}
                  className="size-7"
                >
                  {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => fetchSummary(dimension)}
                disabled={isLoading}
                className="size-7"
              >
                <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Dimension Tabs */}
        <div className="px-4 py-2 border-b shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1">
            {DIMENSIONS.map((dim) => (
              <button
                key={dim}
                type="button"
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all',
                  dimension === dim
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                onClick={() => handleDimensionChange(dim)}
                disabled={isLoading}
              >
                {DIMENSION_LABELS[dim]}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4"
        >
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm">
              <X className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading && !content && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="relative">
                <Sparkles className="size-8 text-primary animate-pulse" />
              </div>
              <p className="text-sm text-muted-foreground">데이터를 분석하고 있습니다...</p>
              <p className="text-[10px] text-muted-foreground">6개 영역의 데이터를 수집하여 요약합니다</p>
            </div>
          )}

          {content && (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-base prose-headings:font-bold prose-p:text-sm prose-li:text-sm prose-p:leading-relaxed prose-li:leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
              {isLoading && (
                <span className="inline-block w-1.5 h-4 bg-primary animate-pulse rounded-sm ml-0.5" />
              )}
            </div>
          )}

          {!isLoading && !content && !error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Bot className="size-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">AI 요약을 시작하려면 위의 탭을 선택하세요</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t shrink-0 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Powered by GPT-4o-mini
          </span>
          {content && (
            <Badge variant="secondary" className="text-[9px]">
              {content.length}자
            </Badge>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
