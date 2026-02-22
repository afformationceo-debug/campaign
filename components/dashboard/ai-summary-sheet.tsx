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
  Trash2,
  MessageCircle,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  MoreHorizontal,
  ArrowUp,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import type { SummaryDimension } from '@/lib/ai/types';

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

/* ─── Constants ─── */

const QUICK_ACTIONS: { label: string; message: string; dimension: SummaryDimension; emoji: string }[] = [
  { label: '전체 현황 요약', message: '전체현황 알려줘', dimension: 'all', emoji: '📊' },
  { label: '담당자별 현황', message: '담당자별로 알려줘', dimension: 'assignee', emoji: '👥' },
  { label: '캠페인별 현황', message: '캠페인별로 알려줘', dimension: 'campaign', emoji: '🏢' },
  { label: '업무 결과 현황', message: '업무 결과 알려줘', dimension: 'daily', emoji: '📋' },
  { label: '프로젝트 현황', message: '프로젝트별로 알려줘', dimension: 'project', emoji: '🗺️' },
  { label: 'QA 관리 현황', message: 'QA관리별로 알려줘', dimension: 'qa', emoji: '⚠️' },
  { label: '캠페인 세팅', message: '캠페인 세팅별로 알려줘', dimension: 'config', emoji: '⚙️' },
  { label: '이커머스/브랜드', message: '이커머스 브랜드 캠페인 현황 알려줘', dimension: 'ecommerce', emoji: '🛒' },
];

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

function formatRoomDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return '방금';
  if (diffMins < 60) return `${diffMins}분 전`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
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

/* ─── Component ─── */

export function AiSummarySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const userId = user?.id;

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingRef = useRef('');
  const prevOpenRef = useRef(open);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
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

  const renameRoom = useCallback(async (roomId: string, title: string) => {
    try {
      await fetch('/api/ai-chat-rooms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, title }),
      });
      setRooms((prev) => prev.map((r) => r.id === roomId ? { ...r, title } : r));
    } catch {
      // silent
    }
  }, []);

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
        setTimeout(scrollToBottom, 100);
      } else {
        setMessages([]);
      }
    } catch {
      // silent
    }
  }, [userId, scrollToBottom]);

  // Load rooms on first open
  useEffect(() => {
    if (open && userId && !roomsLoaded) {
      loadRooms();
    }
  }, [open, userId, roomsLoaded, loadRooms]);

  // Load history when room changes
  useEffect(() => {
    if (userId && !isLoading) {
      loadHistory(activeRoomId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, userId]);

  // Reload history when sheet reopens (in case streaming finished in background)
  useEffect(() => {
    if (open && !prevOpenRef.current && userId && !isLoading) {
      loadHistory(activeRoomId);
      loadRooms();
    }
    prevOpenRef.current = open;
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open, userId, isLoading, activeRoomId, loadHistory, loadRooms]);

  const sendMessage = useCallback(async (userMessage: string, dimension: SummaryDimension) => {
    // Auto-create room if none selected
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
    streamingRef.current = '';

    const history = messages
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimension, message: userMessage, userId, roomId, history }),
        // NO abort signal - let it finish even if sheet closes
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

      // Update room's updated_at in local state
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

  const handleQuickAction = (action: typeof QUICK_ACTIONS[number]) => {
    if (isLoading) return;
    sendMessage(action.message, action.dimension);
  };

  const handleSendInput = () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue('');
    sendMessage(text, detectDimension(text));
    // Reset textarea height
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
    if (isLoading) return; // Don't switch while streaming
    setError(null);
    setActiveRoomId(roomId);
  };

  const handleOpenChange = (val: boolean) => {
    // NEVER abort streaming on close - let it finish in background
    onOpenChange(val);
  };

  const handleRenameSubmit = (roomId: string) => {
    const trimmed = editTitle.trim();
    if (trimmed) renameRoom(roomId, trimmed);
    setEditingRoomId(null);
  };

  // Auto-resize textarea
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const hasMessages = messages.length > 0;
  const activeRoom = rooms.find((r) => r.id === activeRoomId);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        className="w-full sm:max-w-[780px] flex flex-row gap-0 p-0 border-l-0 sm:border-l"
        onInteractOutside={(e) => {
          // Prevent sheet from closing when interacting with dropdown portals
          if ((e.target as HTMLElement)?.closest?.('[role="menu"]')) {
            e.preventDefault();
          }
        }}
      >
        {/* ─── Sidebar ─── */}
        <div
          className={cn(
            'shrink-0 flex flex-col bg-gradient-to-b from-slate-950 to-slate-900 border-r border-white/[0.06] transition-all duration-300 overflow-hidden',
            sidebarOpen ? 'w-[240px]' : 'w-0'
          )}
        >
          {/* Sidebar Header */}
          <div className="px-3 pt-4 pb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium text-white/40 uppercase tracking-[0.08em]">대화 목록</span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="size-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/80 hover:bg-white/5 transition-colors"
              title="사이드바 닫기"
            >
              <PanelLeftClose className="size-3.5" />
            </button>
          </div>

          {/* New Chat Button */}
          <div className="px-2 pb-2">
            <button
              type="button"
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium text-white/70 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              <Plus className="size-3.5" />
              새 대화
            </button>
          </div>

          {/* Room List */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 scrollbar-none">
            {rooms.map((room) => (
              <div
                key={room.id}
                className={cn(
                  'group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer',
                  activeRoomId === room.id
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04]'
                )}
                onClick={() => handleSelectRoom(room.id)}
              >
                <MessageCircle className="size-3.5 shrink-0 opacity-40" />
                {editingRoomId === room.id ? (
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleRenameSubmit(room.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        handleRenameSubmit(room.id);
                      }
                      if (e.key === 'Escape') setEditingRoomId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 bg-white/5 border border-white/20 rounded px-1.5 py-0.5 text-[12px] text-white outline-none"
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] block truncate leading-tight">{room.title}</span>
                    <span className="text-[9px] text-white/25 leading-tight">{formatRoomDate(room.updated_at)}</span>
                  </div>
                )}

                {/* Room actions */}
                {editingRoomId !== room.id && (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="size-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 text-white/30 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <MoreHorizontal className="size-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32" sideOffset={4}>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTitle(room.title);
                          setEditingRoomId(room.id);
                        }}
                      >
                        <Pencil className="size-3 mr-2" />
                        이름 변경
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRoom(room.id);
                        }}
                        className="text-red-500 focus:text-red-500"
                      >
                        <Trash2 className="size-3 mr-2" />
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ─── Main Chat Area ─── */}
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          {/* ─── Header ─── */}
          <SheetHeader className="px-4 py-3 border-b shrink-0 bg-background/95 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {!sidebarOpen && (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="사이드바 열기"
                  >
                    <PanelLeftOpen className="size-4" />
                  </button>
                )}
                <SheetTitle className="flex items-center gap-2.5 text-base">
                  <div className="relative">
                    <div className="size-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shadow-indigo-500/20">
                      <Bot className="size-4 text-white" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 border-[1.5px] border-background" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-semibold text-foreground truncate max-w-[220px]">
                      {activeRoom ? activeRoom.title : '어포메이션 AI'}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 font-normal flex items-center gap-1">
                      {isLoading ? (
                        <><Loader2 className="size-2.5 animate-spin" /> 분석 중...</>
                      ) : (
                        <>GPT-4o-mini · 온라인</>
                      )}
                    </span>
                  </div>
                </SheetTitle>
              </div>
              <div className="flex items-center gap-1">
                {hasMessages && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleClearChat}
                    className="size-8 text-muted-foreground hover:text-foreground"
                    title="대화 초기화"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* ─── Streaming indicator bar ─── */}
          {isLoading && (
            <div className="h-0.5 w-full bg-muted overflow-hidden shrink-0">
              <div className="h-full w-1/3 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 animate-shimmer rounded-full" />
            </div>
          )}

          {/* ─── Messages ─── */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto"
          >
            {error && (
              <div className="mx-4 mt-3 flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
                <X className="size-4 shrink-0" />
                <span className="text-[12px]">{error}</span>
              </div>
            )}

            {/* ─── Welcome ─── */}
            {!hasMessages && !isLoading && (
              <div className="flex flex-col items-center justify-center gap-6 pt-12 pb-6 px-5">
                <div className="flex flex-col items-center gap-3">
                  <div className="size-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Sparkles className="size-8 text-white" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-[16px] font-bold text-foreground">무엇이든 물어보세요</h3>
                    <p className="text-[12px] text-muted-foreground mt-1 max-w-[280px]">
                      캠페인, 담당자, 프로젝트 등 실시간 데이터를 분석합니다
                    </p>
                  </div>
                </div>

                <div className="w-full max-w-[420px] grid grid-cols-2 gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.dimension}
                      type="button"
                      onClick={() => handleQuickAction(action)}
                      disabled={isLoading}
                      className={cn(
                        'flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-left transition-all',
                        'bg-muted/50 hover:bg-muted border border-transparent hover:border-border/50',
                        'hover:shadow-sm active:scale-[0.98]',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      <span className="text-base">{action.emoji}</span>
                      <span className="text-[12px] font-medium text-foreground/80">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Chat Messages (ChatGPT-style full width) ─── */}
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const isLast = idx === messages.length - 1;
              const isStreaming = isLoading && isLast && !isUser;
              const isEmpty = !msg.content;

              // Show typing indicator for empty streaming message
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
                    !isUser && 'bg-muted/30'
                  )}
                >
                  <div className="max-w-[620px] mx-auto">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      {isUser ? (
                        <div className="size-7 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shrink-0 shadow-sm text-[11px] font-bold text-white">
                          {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      ) : (
                        <div className="size-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-sm">
                          <Bot className="size-3.5 text-white" />
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0 group">
                        <span className={cn(
                          'text-[11px] font-semibold block mb-1',
                          isUser ? 'text-blue-600 dark:text-blue-400' : 'text-indigo-600 dark:text-indigo-400'
                        )}>
                          {isUser ? '나' : 'AI Agent'}
                        </span>

                        {isUser ? (
                          <p className="text-[13px] leading-[1.7] text-foreground">{msg.content}</p>
                        ) : (
                          <div className="relative">
                            <div className="prose prose-sm dark:prose-invert max-w-none
                              prose-headings:text-[13px] prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-1.5
                              prose-p:text-[13px] prose-li:text-[13px]
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
                            {/* Streaming cursor */}
                            {isStreaming && (
                              <span className="inline-block w-0.5 h-4 bg-indigo-500 animate-pulse rounded-full ml-0.5 align-middle" />
                            )}
                            {/* Copy button */}
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

                        {/* Timestamp */}
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

          {/* ─── Quick Actions (in-chat) ─── */}
          {hasMessages && !isLoading && (
            <div className="px-4 py-2 border-t shrink-0 bg-background/80 backdrop-blur-sm">
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none max-w-[620px] mx-auto">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.dimension}
                    type="button"
                    onClick={() => handleQuickAction(action)}
                    disabled={isLoading}
                    className={cn(
                      'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                      'bg-muted/50 hover:bg-muted border border-transparent hover:border-border/50',
                      'text-muted-foreground hover:text-foreground',
                      'disabled:opacity-40 disabled:cursor-not-allowed'
                    )}
                  >
                    <span className="text-xs">{action.emoji}</span>
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── Input Area ─── */}
          <div className="px-4 pt-2 pb-3 shrink-0 bg-background border-t">
            <div className="max-w-[620px] mx-auto">
              <div className={cn(
                'relative flex items-end gap-2 rounded-2xl border bg-muted/30 px-4 py-2 transition-all',
                'focus-within:border-indigo-300 focus-within:bg-background focus-within:shadow-sm focus-within:shadow-indigo-500/5',
                'dark:focus-within:border-indigo-700'
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
                    'flex-1 resize-none bg-transparent text-[13px] leading-[1.6] outline-none min-h-[24px] max-h-[120px] py-1',
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
                      ? 'bg-foreground text-background hover:opacity-80 active:scale-95'
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
                GPT-4o-mini · 대화는 자동 저장됩니다
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
