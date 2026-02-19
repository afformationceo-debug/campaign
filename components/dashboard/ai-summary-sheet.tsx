'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot,
  Send,
  Copy,
  Check,
  Sparkles,
  X,
  User,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { SummaryDimension } from '@/lib/ai/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  dimension?: SummaryDimension;
}

const QUICK_ACTIONS: { label: string; message: string; dimension: SummaryDimension }[] = [
  { label: '전체 현황', message: '전체현황 알려줘', dimension: 'all' },
  { label: '담당자별', message: '담당자별로 알려줘', dimension: 'assignee' },
  { label: '캠페인별', message: '캠페인별로 알려줘', dimension: 'campaign' },
  { label: '업무 결과', message: '업무 결과 알려줘', dimension: 'daily' },
  { label: '프로젝트', message: '프로젝트별로 알려줘', dimension: 'project' },
  { label: 'QA 관리', message: 'QA관리별로 알려줘', dimension: 'qa' },
  { label: '캠페인 세팅', message: '캠페인 세팅별로 알려줘', dimension: 'config' },
];

export function AiSummarySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef('');

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(async (userMessage: string, dimension: SummaryDimension) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      dimension,
    };

    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      dimension,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setError(null);
    setIsLoading(true);
    streamingRef.current = '';

    try {
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimension }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamingRef.current += decoder.decode(value, { stream: true });
        const currentText = streamingRef.current;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: currentText } : m
          )
        );
        scrollToBottom();
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const errorMsg = err instanceof Error ? err.message : '요약 생성에 실패했습니다.';
      setError(errorMsg);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsLoading(false);
    }
  }, [scrollToBottom]);

  const handleQuickAction = (action: typeof QUICK_ACTIONS[number]) => {
    if (isLoading) return;
    sendMessage(action.message, action.dimension);
  };

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setError(null);
    setIsLoading(false);
  };

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open && abortRef.current) {
      abortRef.current.abort();
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-[540px] flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b shrink-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2.5 text-base">
              <div className="relative">
                <div className="size-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Bot className="size-4.5 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-950" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">AI Agent</span>
                <span className="text-[10px] text-muted-foreground font-normal">어포메이션 휴먼인더루프</span>
              </div>
            </SheetTitle>
            <div className="flex items-center gap-1">
              {hasMessages && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleClearChat}
                  className="size-7 text-muted-foreground hover:text-foreground"
                  title="대화 초기화"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Chat Messages Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        >
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm">
              <X className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Welcome Screen */}
          {!hasMessages && !isLoading && (
            <div className="flex flex-col items-center justify-center py-8 gap-5">
              <div className="relative">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/25">
                  <Sparkles className="size-8 text-white" />
                </div>
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="text-sm font-semibold">어포메이션 AI Agent</h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px]">
                  캠페인 운영 현황을 실시간으로 분석하고<br />
                  인사이트를 제공합니다
                </p>
              </div>

              {/* Quick Actions Grid */}
              <div className="w-full space-y-2">
                <p className="text-[10px] text-muted-foreground text-center font-medium uppercase tracking-wider">
                  빠른 분석
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.dimension}
                      type="button"
                      onClick={() => handleQuickAction(action)}
                      disabled={isLoading}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all',
                        'bg-muted/50 hover:bg-muted border border-transparent hover:border-border',
                        'text-xs font-medium text-foreground/80 hover:text-foreground',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        action.dimension === 'all' && 'col-span-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/15 hover:to-purple-500/15 border-indigo-200/50 dark:border-indigo-800/50'
                      )}
                    >
                      <div className={cn(
                        'size-6 rounded-lg flex items-center justify-center shrink-0 text-[10px]',
                        action.dimension === 'all'
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                          : 'bg-muted-foreground/10 text-muted-foreground'
                      )}>
                        {action.dimension === 'all' ? '📊' :
                         action.dimension === 'assignee' ? '👥' :
                         action.dimension === 'campaign' ? '🏢' :
                         action.dimension === 'daily' ? '📋' :
                         action.dimension === 'project' ? '🗺️' :
                         action.dimension === 'qa' ? '⚠️' : '⚙️'}
                      </div>
                      <span>{action.message}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Message Bubbles */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex gap-2.5',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {/* Assistant Avatar */}
              {msg.role === 'assistant' && (
                <div className="shrink-0 mt-1">
                  <div className="size-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Bot className="size-3.5 text-white" />
                  </div>
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={cn(
                  'relative group max-w-[85%] rounded-2xl px-3.5 py-2.5',
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-md'
                    : 'bg-muted/70 border border-border/50 rounded-bl-md'
                )}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm">{msg.content}</p>
                ) : msg.content ? (
                  <div className="relative">
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-sm prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-1.5 prose-p:text-[13px] prose-li:text-[13px] prose-p:leading-relaxed prose-li:leading-relaxed prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {isLoading && msg.id === messages[messages.length - 1]?.id && (
                      <span className="inline-block w-1.5 h-4 bg-indigo-500 animate-pulse rounded-sm ml-0.5" />
                    )}
                    {/* Copy button */}
                    {!isLoading && msg.content && (
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="absolute -bottom-6 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        {copiedId === msg.id ? (
                          <><Check className="size-3 text-emerald-500" /> 복사됨</>
                        ) : (
                          <><Copy className="size-3" /> 복사</>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex gap-1">
                      <div className="size-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="size-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="size-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-muted-foreground">분석 중...</span>
                  </div>
                )}
              </div>

              {/* User Avatar */}
              {msg.role === 'user' && (
                <div className="shrink-0 mt-1">
                  <div className="size-7 rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-600 dark:to-gray-800 flex items-center justify-center">
                    <User className="size-3.5 text-white" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom Quick Actions (when messages exist) */}
        {hasMessages && (
          <div className="px-4 py-2 border-t shrink-0 bg-background/80 backdrop-blur-sm">
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.dimension}
                  type="button"
                  onClick={() => handleQuickAction(action)}
                  disabled={isLoading}
                  className={cn(
                    'shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all',
                    'bg-muted/50 hover:bg-muted border border-border/50 hover:border-border',
                    'text-muted-foreground hover:text-foreground',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2 border-t shrink-0 flex items-center justify-between bg-muted/30">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="size-3" />
            Powered by GPT-4o-mini
          </span>
          {hasMessages && (
            <span className="text-[10px] text-muted-foreground">
              {messages.filter((m) => m.role === 'assistant').length}개 응답
            </span>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
