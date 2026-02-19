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
  Trash2,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuth } from '@/hooks/use-auth';
import type { SummaryDimension } from '@/lib/ai/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  dimension?: SummaryDimension;
}

const QUICK_ACTIONS: { label: string; message: string; dimension: SummaryDimension; emoji: string; color: string }[] = [
  { label: '전체 현황 요약', message: '전체현황 알려줘', dimension: 'all', emoji: '📊', color: 'from-violet-500 to-indigo-500' },
  { label: '담당자별 현황', message: '담당자별로 알려줘', dimension: 'assignee', emoji: '👥', color: 'from-blue-500 to-cyan-500' },
  { label: '캠페인별 현황', message: '캠페인별로 알려줘', dimension: 'campaign', emoji: '🏢', color: 'from-emerald-500 to-teal-500' },
  { label: '업무 결과 현황', message: '업무 결과 알려줘', dimension: 'daily', emoji: '📋', color: 'from-amber-500 to-orange-500' },
  { label: '프로젝트 현황', message: '프로젝트별로 알려줘', dimension: 'project', emoji: '🗺️', color: 'from-pink-500 to-rose-500' },
  { label: 'QA 관리 현황', message: 'QA관리별로 알려줘', dimension: 'qa', emoji: '⚠️', color: 'from-red-500 to-orange-500' },
  { label: '캠페인 세팅', message: '캠페인 세팅별로 알려줘', dimension: 'config', emoji: '⚙️', color: 'from-gray-500 to-slate-500' },
];

function detectDimension(text: string): SummaryDimension {
  const lower = text.toLowerCase();
  if (/담당자/.test(lower)) return 'assignee';
  if (/캠페인.*세팅|세팅/.test(lower)) return 'config';
  if (/캠페인/.test(lower)) return 'campaign';
  if (/업무|결과|일일/.test(lower)) return 'daily';
  if (/프로젝트|로드맵/.test(lower)) return 'project';
  if (/qa|이슈|질문/.test(lower)) return 'qa';
  return 'all';
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export function AiSummarySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const userId = user?.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamingRef = useRef('');

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    if (open && userId && !historyLoaded) {
      loadHistory();
    }
  }, [open, userId, historyLoaded]);

  const loadHistory = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/ai-summary?userId=${userId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.messages?.length > 0) {
        const loaded: ChatMessage[] = data.messages.map((m: { id: string; role: 'user' | 'assistant'; content: string; dimension?: string; created_at: string }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          dimension: m.dimension as SummaryDimension | undefined,
          timestamp: new Date(m.created_at),
        }));
        setMessages(loaded);
        setTimeout(scrollToBottom, 100);
      }
    } catch {
      // silent
    } finally {
      setHistoryLoaded(true);
    }
  };

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

    const history = messages
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimension, message: userMessage, userId, history }),
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
          prev.map((m) => m.id === assistantId ? { ...m, content: currentText } : m)
        );
        scrollToBottom();
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '요약 생성에 실패했습니다.');
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsLoading(false);
    }
  }, [messages, userId, scrollToBottom]);

  const handleQuickAction = (action: typeof QUICK_ACTIONS[number]) => {
    if (isLoading) return;
    sendMessage(action.message, action.dimension);
  };

  const handleSendInput = () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue('');
    sendMessage(text, detectDimension(text));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendInput();
    }
  };

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = async () => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setError(null);
    setIsLoading(false);
    if (userId) {
      fetch(`/api/ai-summary?userId=${userId}`, { method: 'DELETE' }).catch(() => {});
    }
  };

  const handleOpenChange = (val: boolean) => {
    onOpenChange(val);
    if (!val && abortRef.current) abortRef.current.abort();
    if (val) setTimeout(() => inputRef.current?.focus(), 300);
  };

  const hasMessages = messages.length > 0;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-[560px] flex flex-col gap-0 p-0 border-l-0 sm:border-l">
        {/* ─── Header ─── */}
        <SheetHeader className="px-5 py-3.5 border-b shrink-0 bg-gradient-to-r from-slate-900 to-indigo-950 dark:from-slate-950 dark:to-indigo-950">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-3 text-base">
              <div className="relative">
                <div className="size-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center ring-2 ring-white/20">
                  <Bot className="size-5 text-white" />
                </div>
                <div className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-400 border-2 border-slate-900 dark:border-slate-950" />
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-bold text-white">어포메이션 AI Agent</span>
                <span className="text-[10px] text-white/50 font-normal">Human-in-the-Loop · 온라인</span>
              </div>
            </SheetTitle>
            {hasMessages && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleClearChat}
                className="size-8 text-white/40 hover:text-white/80 hover:bg-white/10"
                title="대화 초기화"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* ─── Messages ─── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-[#f0f2f5] dark:bg-gray-950/50"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}
        >
          <div className="px-4 py-4 space-y-3 min-h-full">
            {error && (
              <div className="mx-2 flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm shadow-sm">
                <X className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* ─── Welcome ─── */}
            {!hasMessages && !isLoading && (
              <div className="flex flex-col gap-4 pt-4">
                {/* Welcome card */}
                <div className="mx-auto max-w-[340px] rounded-2xl bg-white dark:bg-gray-900 shadow-sm border border-black/5 dark:border-white/5 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-6 text-center">
                    <div className="size-14 mx-auto rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3">
                      <Sparkles className="size-7 text-white" />
                    </div>
                    <h3 className="text-[15px] font-bold text-white">어포메이션 AI Agent</h3>
                    <p className="text-[11px] text-white/70 mt-1">
                      캠페인 운영 데이터를 실시간 분석합니다
                    </p>
                  </div>
                  <div className="px-4 py-3 text-center">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      아래 버튼을 누르거나 직접 질문을 입력해주세요
                    </p>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="space-y-1.5">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.dimension}
                      type="button"
                      onClick={() => handleQuickAction(action)}
                      disabled={isLoading}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all',
                        'bg-white dark:bg-gray-900 shadow-sm border border-black/5 dark:border-white/5',
                        'hover:shadow-md hover:scale-[1.01] active:scale-[0.99]',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      <div className={cn(
                        'size-9 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 text-sm shadow-sm',
                        action.color
                      )}>
                        <span>{action.emoji}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-semibold text-foreground block">{action.label}</span>
                        <span className="text-[10px] text-muted-foreground">{action.message}</span>
                      </div>
                      <Send className="size-3.5 text-muted-foreground/40 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Chat Bubbles ─── */}
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const showTime = idx === messages.length - 1 ||
                messages[idx + 1]?.role !== msg.role;

              return (
                <div key={msg.id} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                  <div className={cn('flex gap-2 max-w-[88%]', isUser ? 'flex-row-reverse' : 'flex-row')}>
                    {/* Avatar */}
                    {!isUser && (
                      <div className="shrink-0 self-end mb-5">
                        <div className="size-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shadow-sm">
                          <Bot className="size-4 text-white" />
                        </div>
                      </div>
                    )}

                    {/* Bubble */}
                    <div className="flex flex-col gap-0.5">
                      <div
                        className={cn(
                          'relative group rounded-2xl shadow-sm',
                          isUser
                            ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-br-md px-4 py-2.5'
                            : 'bg-white dark:bg-gray-900 border border-black/5 dark:border-white/5 rounded-bl-md px-4 py-3'
                        )}
                      >
                        {isUser ? (
                          <p className="text-[13px] leading-relaxed">{msg.content}</p>
                        ) : msg.content ? (
                          <div className="relative">
                            <div className="prose prose-sm dark:prose-invert max-w-none
                              prose-headings:text-[13px] prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-1
                              prose-p:text-[12.5px] prose-li:text-[12.5px]
                              prose-p:leading-[1.7] prose-li:leading-[1.7]
                              prose-p:my-1 prose-ul:my-1 prose-ol:my-1
                              prose-strong:text-foreground
                              prose-a:text-indigo-600 dark:prose-a:text-indigo-400">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                            {isLoading && msg.id === messages[messages.length - 1]?.id && (
                              <span className="inline-block w-0.5 h-4 bg-indigo-500 animate-pulse rounded-full ml-0.5 align-middle" />
                            )}
                            {!isLoading && msg.content && (
                              <button
                                type="button"
                                onClick={() => handleCopy(msg.content, msg.id)}
                                className="absolute -bottom-5 right-0 opacity-0 group-hover:opacity-100 transition-opacity
                                  flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
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
                          <div className="flex items-center gap-2.5 py-0.5">
                            <div className="flex gap-1">
                              <span className="size-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="size-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="size-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-[11px] text-muted-foreground">데이터 분석 중...</span>
                          </div>
                        )}
                      </div>
                      {/* Timestamp */}
                      {showTime && msg.content && (
                        <span className={cn(
                          'text-[9px] text-muted-foreground/60 px-1',
                          isUser ? 'text-right' : 'text-left'
                        )}>
                          {formatTime(msg.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Quick Actions (in-chat) ─── */}
        {hasMessages && (
          <div className="px-3 py-2 border-t shrink-0 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.dimension}
                  type="button"
                  onClick={() => handleQuickAction(action)}
                  disabled={isLoading}
                  className={cn(
                    'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all',
                    'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700',
                    'text-gray-600 dark:text-gray-300',
                    'disabled:opacity-40 disabled:cursor-not-allowed'
                  )}
                >
                  <span className="text-[10px]">{action.emoji}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Input ─── */}
        <div className="px-3 py-2.5 border-t shrink-0 bg-white dark:bg-gray-950">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요..."
                disabled={isLoading}
                className={cn(
                  'w-full px-4 py-2.5 rounded-full text-[13px]',
                  'bg-gray-100 dark:bg-gray-800 border-0',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500/30',
                  'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                  'disabled:opacity-50'
                )}
              />
            </div>
            <button
              type="button"
              onClick={handleSendInput}
              disabled={!inputValue.trim() || isLoading}
              className={cn(
                'size-10 rounded-full flex items-center justify-center shrink-0 transition-all',
                inputValue.trim()
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 active:scale-95'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              )}
            >
              <Send className={cn('size-4', inputValue.trim() && 'translate-x-[1px] -translate-y-[1px]')} />
            </button>
          </div>
          <div className="flex items-center justify-center mt-1.5">
            <span className="text-[9px] text-gray-400 flex items-center gap-1">
              <MessageCircle className="size-2.5" />
              GPT-4o-mini · 대화 내용은 자동 저장됩니다
            </span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
