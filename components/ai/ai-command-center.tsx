'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot,
  Copy,
  Check,
  Sparkles,
  X,
  Trash2,
  Plus,
  ArrowUp,
  Loader2,
  ChevronDown,
  MessageSquarePlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { InsightCard } from './insight-card';
import type { SummaryDimension } from '@/lib/ai/types';
import type { Insight } from '@/lib/ai/insights';

/* ─── Types ─── */

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  dimension?: SummaryDimension;
}

interface ChatRoom {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

/* ─── Quick Actions (reduced to 4) ─── */

const QUICK_ACTIONS: { label: string; message: string; dimension: SummaryDimension; emoji: string }[] = [
  { label: '오늘의 브리핑', message: '오늘 전체 현황 브리핑해줘', dimension: 'all', emoji: '📊' },
  { label: '팀 현황', message: '담당자별 업무 현황 분석해줘', dimension: 'assignee', emoji: '👥' },
  { label: '위험 요소 확인', message: '마감 임박, 미완료 업무, 긴급 QA 등 위험 요소를 분석해줘', dimension: 'all', emoji: '🚨' },
  { label: '주간 트렌드', message: '이번 주 전체 업무 트렌드와 변화를 분석해줘', dimension: 'all', emoji: '📈' },
];

/* ─── Example Questions ─── */

const EXAMPLE_QUESTIONS = [
  '김정원님 이번 주 업무 어때?',
  'A사 캠페인 세팅 어디까지 됐어?',
  '가장 바쁜 사람이 누구야?',
  '마감 임박한 프로젝트 있어?',
];

/* ─── Context-aware suggestions ─── */

const CONTEXT_SUGGESTIONS: Record<string, { label: string; message: string; dimension: SummaryDimension }[]> = {
  dashboard: [
    { label: '오늘의 브리핑', message: '오늘 전체 현황 브리핑해줘', dimension: 'all' },
    { label: '팀 현황', message: '담당자별 업무 현황 분석해줘', dimension: 'assignee' },
    { label: '위험 요소', message: '마감 임박, 미완료, 긴급 QA 등 위험 요소 분석해줘', dimension: 'all' },
    { label: '주간 트렌드', message: '이번 주 전체 업무 트렌드 분석해줘', dimension: 'all' },
  ],
  roadmap: [
    { label: '마감 임박 프로젝트', message: '마감 임박한 프로젝트 상세 분석해줘', dimension: 'project' },
    { label: '지연 프로젝트', message: '지연되는 프로젝트와 병목 분석해줘', dimension: 'project' },
    { label: '담당자별 부하', message: '담당자별 프로젝트 부하 분석해줘', dimension: 'assignee' },
    { label: '전체 프로젝트 현황', message: '프로젝트 전체 현황 분석해줘', dimension: 'project' },
  ],
  campaign: [
    { label: '캠페인 세팅 진행률', message: '캠페인 세팅 진행률 분석해줘', dimension: 'config' },
    { label: '캠페인별 비교', message: '캠페인별 현황 비교 분석해줘', dimension: 'campaign' },
    { label: 'QA 현황', message: 'QA 관리 현황 분석해줘', dimension: 'qa' },
    { label: '이커머스 현황', message: '이커머스 브랜드 캠페인 현황 분석해줘', dimension: 'ecommerce' },
  ],
};

/* ─── Follow-up question map ─── */

const FOLLOWUP_QUESTIONS: Record<string, string[]> = {
  assignee: ['가장 바쁜 사람은?', '완료율 낮은 이유는?', '업무 재배분 제안해줘'],
  campaign: ['주의가 필요한 캠페인은?', '캠페인 세팅 지연 원인은?', '캠페인별 QA 현황은?'],
  daily: ['미완료 업무 담당자별 정리해줘', '반복 미완료 패턴 있어?', '카테고리별 완료율 비교해줘'],
  project: ['마감 연장해야 할 프로젝트는?', '리소스 재배분 제안해줘', '프로젝트별 병목 분석해줘'],
  qa: ['긴급 이슈 상세 알려줘', '반복되는 이슈 패턴 있어?', '캠페인별 이슈 집중도는?'],
  config: ['가장 지연된 세팅 항목은?', '세팅 미완료가 운영에 미치는 영향은?', '세팅 우선순위 제안해줘'],
  ecommerce: ['플랫폼별 세팅 현황은?', '미시작 세팅 왜 밀리고 있어?', '국가별 진출 현황은?'],
  all: ['가장 긴급한 사항은?', '오늘 우선 처리할 업무 Top 5는?', '팀 전체 건강 상태는?'],
};

/* ─── Dimension Detection ─── */

function detectDimension(text: string): SummaryDimension {
  const lower = text.toLowerCase();
  if (/이커머스|브랜드|플랫폼.*세팅|쇼피|아마존|큐텐|라쿠텐|틱톡샵|라자다/.test(lower)) return 'ecommerce';
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

/* ─── Typing Indicator ─── */

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <div className="size-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-sm">
        <Bot className="size-3.5 text-white" />
      </div>
      <div className="flex flex-col gap-1 pt-1">
        <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">AI Agent</span>
        <div className="flex items-center gap-2 bg-muted/50 rounded-2xl px-4 py-2.5">
          <div className="flex gap-1">
            <span className="size-2 rounded-full bg-indigo-400/80 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.8s' }} />
            <span className="size-2 rounded-full bg-indigo-400/80 animate-bounce" style={{ animationDelay: '200ms', animationDuration: '0.8s' }} />
            <span className="size-2 rounded-full bg-indigo-400/80 animate-bounce" style={{ animationDelay: '400ms', animationDuration: '0.8s' }} />
          </div>
          <span className="text-[11px] text-muted-foreground">데이터 분석 중...</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export function AiCommandCenter({
  open,
  onOpenChange,
  context = 'dashboard',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: 'dashboard' | 'roadmap' | 'campaign';
}) {
  const { user } = useAuth();
  const userId = user?.id;

  // Rooms
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [roomsLoaded, setRoomsLoaded] = useState(false);

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastDimension, setLastDimension] = useState<SummaryDimension>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingRef = useRef('');
  const prevOpenRef = useRef(open);

  // Insights
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  /* ─── Insights API ─── */

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const res = await fetch('/api/ai-insights');
      if (!res.ok) return;
      const data = await res.json();
      setInsights(data.insights ?? []);
    } catch {
      // silent
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  /* ─── Room API ─── */

  const loadRooms = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/ai-chat-rooms?userId=${userId}`);
      if (!res.ok) return;
      const data = await res.json();
      setRooms(data.rooms ?? []);
    } catch {
      // silent
    } finally {
      setRoomsLoaded(true);
    }
  }, [userId]);

  const createRoom = useCallback(async (title?: string) => {
    if (!userId) return null;
    try {
      const res = await fetch('/api/ai-chat-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const newRoom: ChatRoom = data.room;
      setRooms((prev) => [newRoom, ...prev]);
      return newRoom;
    } catch {
      return null;
    }
  }, [userId]);

  const deleteRoom = useCallback(async (roomId: string) => {
    try {
      await fetch(`/api/ai-chat-rooms?roomId=${roomId}`, { method: 'DELETE' });
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      if (activeRoomId === roomId) {
        setActiveRoomId(null);
        setMessages([]);
      }
    } catch {
      // silent
    }
  }, [activeRoomId]);

  /* ─── Chat API ─── */

  const loadHistory = useCallback(async (roomId: string | null) => {
    if (!userId) return;
    try {
      const params = new URLSearchParams({ userId });
      if (roomId) params.set('roomId', roomId);
      const res = await fetch(`/api/ai-summary?${params}`);
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
        // Track last dimension from loaded messages
        const lastUserMsg = loaded.filter((m) => m.role === 'user').pop();
        if (lastUserMsg?.dimension) setLastDimension(lastUserMsg.dimension);
        setTimeout(scrollToBottom, 100);
      } else {
        setMessages([]);
      }
    } catch {
      // silent
    }
  }, [userId, scrollToBottom]);

  // Load rooms & insights on first open
  useEffect(() => {
    if (open && userId && !roomsLoaded) {
      loadRooms();
    }
    if (open) {
      loadInsights();
    }
  }, [open, userId, roomsLoaded, loadRooms, loadInsights]);

  // Load history when room changes
  useEffect(() => {
    if (userId && !isLoading) {
      loadHistory(activeRoomId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, userId]);

  // Reload on reopen
  useEffect(() => {
    if (open && !prevOpenRef.current && userId && !isLoading) {
      loadHistory(activeRoomId);
      loadRooms();
    }
    prevOpenRef.current = open;
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open, userId, isLoading, activeRoomId, loadHistory, loadRooms]);

  const sendMessage = useCallback(async (userMessage: string, dimension: SummaryDimension) => {
    let roomId = activeRoomId;
    if (!roomId) {
      const shortTitle = userMessage.length > 20 ? userMessage.substring(0, 20) + '...' : userMessage;
      const newRoom = await createRoom(shortTitle);
      if (newRoom) {
        roomId = newRoom.id;
        setActiveRoomId(newRoom.id);
      }
    }

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
    setLastDimension(dimension);
    streamingRef.current = '';

    const history = messages
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimension, message: userMessage, userId, roomId, history }),
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

      if (roomId) {
        setRooms((prev) =>
          prev.map((r) => r.id === roomId ? { ...r, updated_at: new Date().toISOString() } : r)
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '요약 생성에 실패했습니다.');
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsLoading(false);
    }
  }, [messages, userId, activeRoomId, createRoom, scrollToBottom]);

  const handleQuickAction = (message: string, dimension: SummaryDimension) => {
    if (isLoading) return;
    sendMessage(message, dimension);
  };

  const handleSendInput = () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue('');
    sendMessage(text, detectDimension(text));
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
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
    setMessages([]);
    setError(null);
    if (userId) {
      const params = new URLSearchParams({ userId });
      if (activeRoomId) params.set('roomId', activeRoomId);
      fetch(`/api/ai-summary?${params}`, { method: 'DELETE' }).catch(() => {});
    }
  };

  const handleNewChat = () => {
    setActiveRoomId(null);
    setMessages([]);
    setError(null);
  };

  const handleSelectRoom = (roomId: string) => {
    if (roomId === activeRoomId) return;
    if (isLoading) return;
    setError(null);
    setActiveRoomId(roomId);
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const hasMessages = messages.length > 0;
  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const contextQuickActions = CONTEXT_SUGGESTIONS[context] ?? CONTEXT_SUGGESTIONS.dashboard;
  const followUps = FOLLOWUP_QUESTIONS[lastDimension] ?? FOLLOWUP_QUESTIONS.all;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-4xl w-[calc(100vw-2rem)] h-[85vh] max-h-[800px] flex flex-col gap-0 p-0 rounded-2xl border-0 overflow-hidden shadow-2xl bg-background/95 backdrop-blur-xl"
      >
        {/* ─── Header ─── */}
        <div className="px-5 py-3.5 border-b shrink-0 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="size-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shadow-indigo-500/20">
                  <Bot className="size-4.5 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 border-[1.5px] border-background" />
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-foreground">
                  AI Command Center
                </span>
                <span className="text-[10px] text-muted-foreground/60 font-normal flex items-center gap-1">
                  {isLoading ? (
                    <><Loader2 className="size-2.5 animate-spin" /> 분석 중...</>
                  ) : (
                    <>GPT-4o-mini · 실시간 데이터 분석</>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Room selector dropdown */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-[12px] max-w-[200px]">
                    <MessageSquarePlus className="size-3.5" />
                    <span className="truncate">{activeRoom?.title ?? '새 대화'}</span>
                    <ChevronDown className="size-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[240px] max-h-[300px] overflow-y-auto">
                  <DropdownMenuItem onClick={handleNewChat}>
                    <Plus className="size-3.5 mr-2" />
                    새 대화 시작
                  </DropdownMenuItem>
                  {rooms.length > 0 && <DropdownMenuSeparator />}
                  {rooms.map((room) => (
                    <DropdownMenuItem
                      key={room.id}
                      onClick={() => handleSelectRoom(room.id)}
                      className={cn(activeRoomId === room.id && 'bg-accent')}
                    >
                      <span className="truncate text-[12px]">{room.title}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {hasMessages && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearChat}
                  className="size-8 text-muted-foreground hover:text-foreground"
                  title="대화 초기화"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="size-8 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ─── Streaming indicator bar ─── */}
        {isLoading && (
          <div className="h-0.5 w-full bg-muted overflow-hidden shrink-0">
            <div className="h-full w-1/3 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 animate-shimmer rounded-full" />
          </div>
        )}

        {/* ─── Insight Cards Strip ─── */}
        {insights.length > 0 && !hasMessages && !insightsLoading && (
          <div className="px-5 pt-3 pb-1 shrink-0">
            <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1">
              {insights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onClick={() => {
                    if (insight.actionQuestion) {
                      handleQuickAction(insight.actionQuestion, detectDimension(insight.actionQuestion));
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ─── Messages Area ─── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scrollbar-thin"
        >
          {error && (
            <div className="mx-5 mt-3 flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
              <X className="size-4 shrink-0" />
              <span className="text-[12px]">{error}</span>
            </div>
          )}

          {/* ─── Welcome Screen ─── */}
          {!hasMessages && !isLoading && (
            <div className="flex flex-col items-center justify-center gap-7 pt-8 pb-6 px-5">
              <div className="flex flex-col items-center gap-3">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Sparkles className="size-8 text-white" />
                </div>
                <div className="text-center">
                  <h3 className="text-[18px] font-bold text-foreground">오늘 어포메이션은 어떤가요?</h3>
                  <p className="text-[13px] text-muted-foreground mt-1.5 max-w-[360px]">
                    실시간 데이터 기반으로 업무, 프로젝트, 캠페인을 깊이 분석합니다
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="w-full max-w-[480px] grid grid-cols-2 gap-2.5">
                {contextQuickActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => handleQuickAction(action.message, action.dimension)}
                    disabled={isLoading}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all',
                      'bg-muted/40 hover:bg-muted border border-transparent hover:border-border/50',
                      'hover:shadow-sm active:scale-[0.98]',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    <span className="text-[14px] leading-none text-foreground/80 font-medium">{action.label}</span>
                  </button>
                ))}
              </div>

              {/* Example Questions */}
              <div className="w-full max-w-[480px]">
                <p className="text-[11px] text-muted-foreground/60 font-medium mb-2.5 px-1">예시 질문</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleQuickAction(q, detectDimension(q))}
                      disabled={isLoading}
                      className="px-3 py-1.5 rounded-full text-[12px] text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted border border-border/30 hover:border-border/60 transition-all"
                    >
                      &ldquo;{q}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── Chat Messages ─── */}
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isLast = idx === messages.length - 1;
            const isStreaming = isLoading && isLast && !isUser;
            const isEmpty = !msg.content;

            if (!isUser && isEmpty && isStreaming) {
              return <TypingIndicator key={msg.id} />;
            }
            if (!isUser && isEmpty) return null;

            return (
              <div
                key={msg.id}
                className={cn(
                  'px-5 py-4',
                  isUser && 'bg-transparent',
                  !isUser && 'bg-muted/20'
                )}
              >
                <div className="max-w-[680px] mx-auto">
                  <div className="flex items-start gap-3">
                    {isUser ? (
                      <div className="size-7 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shrink-0 shadow-sm text-[11px] font-bold text-white">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    ) : (
                      <div className="size-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-sm">
                        <Bot className="size-3.5 text-white" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 group">
                      <span className={cn(
                        'text-[11px] font-semibold block mb-1',
                        isUser ? 'text-blue-600 dark:text-blue-400' : 'text-indigo-600 dark:text-indigo-400'
                      )}>
                        {isUser ? '나' : 'AI Agent'}
                      </span>

                      {isUser ? (
                        <p className="text-[14px] leading-[1.7] text-foreground">{msg.content}</p>
                      ) : (
                        <div className="relative">
                          <div className="prose prose-sm dark:prose-invert max-w-none
                            prose-headings:text-[14px] prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-1.5
                            prose-p:text-[14px] prose-li:text-[14px]
                            prose-p:leading-[1.8] prose-li:leading-[1.8]
                            prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5
                            prose-strong:text-foreground prose-strong:font-semibold
                            prose-a:text-indigo-600 dark:prose-a:text-indigo-400
                            prose-code:text-[12px] prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-normal
                            prose-pre:bg-slate-900 prose-pre:rounded-xl prose-pre:shadow-sm">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                          {isStreaming && (
                            <span className="inline-block w-0.5 h-4 bg-indigo-500 animate-pulse rounded-full ml-0.5 align-middle" />
                          )}
                          {!isLoading && msg.content && (
                            <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleCopy(msg.content, msg.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              >
                                {copiedId === msg.id ? (
                                  <><Check className="size-3 text-emerald-500" /> 복사됨</>
                                ) : (
                                  <><Copy className="size-3" /> 복사</>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <span className="text-[9px] text-muted-foreground/40 mt-1 block">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Follow-up Questions ─── */}
        {hasMessages && !isLoading && (
          <div className="px-5 py-2 border-t shrink-0 bg-background/80 backdrop-blur-sm">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none max-w-[680px] mx-auto">
              {followUps.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleQuickAction(q, detectDimension(q))}
                  disabled={isLoading}
                  className={cn(
                    'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                    'bg-muted/40 hover:bg-muted border border-transparent hover:border-border/50',
                    'text-muted-foreground hover:text-foreground',
                    'disabled:opacity-40 disabled:cursor-not-allowed'
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Input Area ─── */}
        <div className="px-5 pt-2 pb-4 shrink-0 bg-background border-t">
          <div className="max-w-[680px] mx-auto">
            <div className={cn(
              'relative flex items-end gap-2 rounded-2xl border bg-muted/30 px-4 py-2.5 transition-all',
              'focus-within:border-indigo-400/50 focus-within:bg-background focus-within:shadow-md focus-within:shadow-indigo-500/10',
              'dark:focus-within:border-indigo-600/50'
            )}>
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder={isLoading ? '분석 중입니다. 잠시 기다려주세요...' : '무엇이든 질문해 보세요...'}
                disabled={isLoading}
                rows={1}
                className={cn(
                  'flex-1 resize-none bg-transparent text-[14px] leading-[1.6] outline-none min-h-[24px] max-h-[120px] py-1',
                  'placeholder:text-muted-foreground/50',
                  'disabled:opacity-60'
                )}
              />
              <button
                type="button"
                onClick={handleSendInput}
                disabled={!inputValue.trim() || isLoading}
                className={cn(
                  'size-8 rounded-xl flex items-center justify-center shrink-0 transition-all mb-0.5',
                  inputValue.trim() && !isLoading
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white hover:opacity-90 active:scale-95 shadow-sm'
                    : 'bg-muted text-muted-foreground/40 cursor-not-allowed'
                )}
              >
                {isLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </button>
            </div>
            <p className="text-center text-[9px] text-muted-foreground/40 mt-1.5">
              GPT-4o-mini · Cmd+J로 열기 · 대화는 자동 저장됩니다
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
