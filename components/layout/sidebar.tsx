'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  FileText,
  Building2,
  ListChecks,
  Settings2,
  UserCog,
  Wrench,
  History,
  Map,
  MessageSquareWarning,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Package,
  ClipboardList,
  Eye,
  Headset,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { PresenceIndicator } from './presence-indicator';

const mainNav = [
  { href: '/dashboard', label: '대시보드', desc: '전체 현황 한눈에', icon: LayoutDashboard, color: 'bg-orange-100 text-orange-600' },
];

const viewNav = [
  { href: '/view/must-check', label: '반드시 체크리스트', desc: '핵심 업무 일일 체크', icon: ShieldCheck, color: 'bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-sm shadow-orange-200/50' },
  { href: '/view/assignee', label: '담당자별', desc: '사람별 업무 현황', icon: Users, color: 'bg-blue-100 text-blue-600' },
  { href: '/view/results', label: '일일 결과값', desc: '오늘 실적 확인', icon: FileText, color: 'bg-emerald-100 text-emerald-600' },
  { href: '/view/daily-report', label: '일일 보고서', desc: '보고서 작성/확인', icon: ClipboardCheck, color: 'bg-violet-100 text-violet-600' },
];

const manageNav = [
  { href: '/manage/campaigns', label: '캠페인 관리', desc: '캠페인 생성/수정', icon: Building2, color: 'bg-sky-100 text-sky-600' },
  { href: '/manage/qa', label: 'QA 관리', desc: '품질 체크리스트', icon: MessageSquareWarning, color: 'bg-rose-100 text-rose-600' },
  { href: '/manage/tasks', label: '행위 관리', desc: '업무 항목 설정', icon: ListChecks, color: 'bg-amber-100 text-amber-600' },
  { href: '/manage/task-config', label: '캠페인별 적용', desc: 'Task-캠페인 연결', icon: Settings2, color: 'bg-slate-100 text-slate-600' },
  { href: '/manage/users', label: '담당자 관리', desc: '팀원 추가/수정', icon: UserCog, color: 'bg-teal-100 text-teal-600' },
  { href: '/manage/configs', label: '캠페인 세팅', desc: '상세 설정 관리', icon: Wrench, color: 'bg-indigo-100 text-indigo-600' },
  { href: '/manage/training', label: '교육 관리', desc: '교육 이수 현황', icon: GraduationCap, color: 'bg-pink-100 text-pink-600' },
  { href: '/manage/products', label: '협업상품 설정', desc: '상품 목록 및 맵핑', icon: Package, color: 'bg-cyan-100 text-cyan-600' },
  { href: '/manage/workflow', label: '캠페인별 워크플로우', desc: '세팅 체크리스트', icon: ClipboardList, color: 'bg-orange-100 text-orange-600' },
];

const projectNav = [
  { href: '/roadmap', label: '프로젝트 로드맵', desc: '장기 계획 관리', icon: Map, color: 'bg-purple-100 text-purple-600' },
];

const knowledgeNav = [
  { href: '/manuals', label: '매뉴얼/가이드', desc: '사용법 안내', icon: BookOpen, color: 'bg-lime-100 text-lime-600' },
  { href: '/manuals/kmong', label: '크몽 응대매뉴얼', desc: 'CS 템플릿 키트', icon: Headset, color: 'bg-orange-100 text-orange-600' },
];

const logNav = [
  { href: '/logs', label: '활동 로그', desc: '변경 이력 추적', icon: History, color: 'bg-stone-100 text-stone-600' },
];

type NavItemData = { href: string; label: string; desc: string; icon: React.ElementType; color: string };

function NavItem({
  href,
  label,
  desc,
  icon: Icon,
  color,
  isCollapsed,
}: NavItemData & { isCollapsed: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  const content = (
    <Link
      href={href}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
        isActive
          ? 'bg-orange-50 text-orange-700 shadow-sm shadow-orange-100/50'
          : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900',
        isCollapsed && 'justify-center px-2 py-2.5'
      )}
    >
      <div className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
        // 반드시 체크리스트: 항상 강조 색상 유지
        href === '/view/must-check'
          ? color
          : isActive ? color : 'bg-stone-50 text-stone-400 group-hover:bg-stone-100 group-hover:text-stone-600',
        isCollapsed && 'size-8 rounded-xl'
      )}>
        <Icon className="size-3.5" />
      </div>
      {!isCollapsed && (
        <div className="min-w-0 flex-1">
          <span className="block truncate font-semibold leading-tight">{label}</span>
          <span className={cn(
            'block truncate text-[10px] font-normal leading-tight mt-0.5',
            isActive ? 'text-orange-500/70' : 'text-stone-400'
          )}>{desc}</span>
        </div>
      )}
      {!isCollapsed && isActive && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-orange-500" />
      )}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium text-xs">
          <p>{label}</p>
          <p className="text-muted-foreground text-[10px] font-normal">{desc}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function NavGroup({
  title,
  items,
  isCollapsed,
}: {
  title?: string;
  items: NavItemData[];
  isCollapsed: boolean;
}) {
  return (
    <div className="space-y-0.5">
      {title && !isCollapsed && (
        <p className="px-3 pt-4 pb-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-[0.12em]">
          {title}
        </p>
      )}
      {isCollapsed && title && (
        <div className="mx-auto w-6 h-px bg-stone-200 my-2.5" />
      )}
      {items.map((item) => (
        <NavItem key={item.href} {...item} isCollapsed={isCollapsed} />
      ))}
    </div>
  );
}

// All menu items for visibility settings
const ALL_MENU_ITEMS: { href: string; label: string; group: string }[] = [
  ...mainNav.map((m) => ({ href: m.href, label: m.label, group: '' })),
  ...viewNav.map((m) => ({ href: m.href, label: m.label, group: '일일 업무' })),
  ...projectNav.map((m) => ({ href: m.href, label: m.label, group: '프로젝트' })),
  ...knowledgeNav.map((m) => ({ href: m.href, label: m.label, group: '지식베이스' })),
  ...manageNav.map((m) => ({ href: m.href, label: m.label, group: '관리' })),
  ...logNav.map((m) => ({ href: m.href, label: m.label, group: '' })),
];

function MenuVisibilityPopover({ isCollapsed, hiddenMenus, onToggle }: {
  isCollapsed: boolean;
  hiddenMenus: Set<string>;
  onToggle: (href: string) => void;
}) {
  const trigger = (
    <button
      type="button"
      className={cn(
        'flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium text-stone-400 hover:bg-stone-50 hover:text-stone-600 transition-colors w-full',
        isCollapsed && 'justify-center px-2'
      )}
    >
      <Eye className="size-3.5" />
      {!isCollapsed && <span>메뉴 표시 설정</span>}
    </button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        {isCollapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="right" className="text-xs">메뉴 표시 설정</TooltipContent>
          </Tooltip>
        ) : trigger}
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-[220px] p-3 rounded-xl">
        <p className="text-[11px] font-bold text-stone-700 mb-2">메뉴 표시/숨김</p>
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {ALL_MENU_ITEMS.map((item) => (
            <label key={item.href} className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-stone-50 cursor-pointer">
              <Checkbox
                checked={!hiddenMenus.has(item.href)}
                onCheckedChange={() => onToggle(item.href)}
              />
              <span className="text-[12px] text-stone-700">{item.label}</span>
              {item.group && <span className="text-[10px] text-stone-400 ml-auto">{item.group}</span>}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SidebarContent({ isCollapsed }: { isCollapsed: boolean }) {
  const isAdmin = useIsAdmin();
  const { profile } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const hiddenMenus = useMemo(() => new Set(profile?.hidden_menus ?? []), [profile?.hidden_menus]);

  const filterItems = useCallback((items: NavItemData[]) => {
    return items.filter((item) => !hiddenMenus.has(item.href));
  }, [hiddenMenus]);

  const toggleMenu = useCallback(async (href: string) => {
    if (!profile) return;
    const current = new Set(profile.hidden_menus ?? []);
    if (current.has(href)) current.delete(href); else current.add(href);
    const newHidden = Array.from(current);
    // Optimistic update
    queryClient.setQueryData(['auth', 'profile'], { ...profile, hidden_menus: newHidden });
    await supabase.from('users').update({ hidden_menus: newHidden }).eq('id', profile.id);
  }, [profile, supabase, queryClient]);

  const filteredMainNav = useMemo(() => filterItems(mainNav), [filterItems]);
  const filteredViewNav = useMemo(() => filterItems(viewNav), [filterItems]);
  const filteredProjectNav = useMemo(() => filterItems(projectNav), [filterItems]);
  const filteredKnowledgeNav = useMemo(() => filterItems(knowledgeNav), [filterItems]);
  const filteredManageNav = useMemo(() => filterItems(manageNav), [filterItems]);
  const filteredLogNav = useMemo(() => filterItems(logNav), [filterItems]);

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 px-4 shrink-0 border-b border-stone-100',
        isCollapsed && 'justify-center px-2'
      )}>
        <div className="flex items-center gap-2.5">
          <img
            src="/characters/afformation-thumbsup.png"
            alt="어포메이션"
            className="size-8 rounded-xl object-contain"
          />
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-[14px] leading-none text-stone-900">어포메이션</span>
              <span className="text-[10px] text-stone-400 leading-none mt-1">캠페인 관리 솔루션</span>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5 scrollbar-thin">
        {filteredMainNav.length > 0 && <NavGroup items={filteredMainNav} isCollapsed={isCollapsed} />}
        {filteredViewNav.length > 0 && <NavGroup title="일일 업무" items={filteredViewNav} isCollapsed={isCollapsed} />}
        {filteredProjectNav.length > 0 && <NavGroup title="프로젝트" items={filteredProjectNav} isCollapsed={isCollapsed} />}
        {filteredKnowledgeNav.length > 0 && <NavGroup title="지식베이스" items={filteredKnowledgeNav} isCollapsed={isCollapsed} />}
        {isAdmin && filteredManageNav.length > 0 && (
          <NavGroup title="관리" items={filteredManageNav} isCollapsed={isCollapsed} />
        )}
        {isAdmin && filteredLogNav.length > 0 && (
          <NavGroup items={filteredLogNav} isCollapsed={isCollapsed} />
        )}
      </div>

      {/* Menu visibility settings */}
      <div className={cn('px-2.5 pb-1', isCollapsed && 'px-1.5')}>
        <MenuVisibilityPopover isCollapsed={isCollapsed} hiddenMenus={hiddenMenus} onToggle={toggleMenu} />
      </div>

      {/* Presence */}
      <div className={cn(
        'border-t border-stone-100 p-2.5 shrink-0',
        isCollapsed && 'px-1.5'
      )}>
        <PresenceIndicator isCollapsed={isCollapsed} />
      </div>
    </div>
  );
}

export function Sidebar() {
  const { isCollapsed, toggle, isMobileOpen, setMobileOpen } = useSidebarStore();
  const pathname = usePathname();

  useEffect(() => { setMobileOpen(false); }, [pathname, setMobileOpen]);

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-stone-100 bg-white transition-all duration-200 relative',
          isCollapsed ? 'w-[60px]' : 'w-[250px]'
        )}
      >
        <SidebarContent isCollapsed={isCollapsed} />
        <Button
          variant="outline"
          size="icon"
          className="absolute -right-3 top-[72px] h-5 w-5 rounded-full bg-white shadow-sm border-stone-200 text-stone-400 hover:text-orange-600 hover:border-orange-200 transition-all duration-200"
          onClick={toggle}
        >
          {isCollapsed ? (
            <ChevronRight className="h-2.5 w-2.5" />
          ) : (
            <ChevronLeft className="h-2.5 w-2.5" />
          )}
        </Button>
      </aside>

      {/* Mobile */}
      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[250px] p-0">
          <SidebarContent isCollapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  );
}
