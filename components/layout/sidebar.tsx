'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { PresenceIndicator } from './presence-indicator';

const mainNav = [
  { href: '/dashboard', label: '대시보드', desc: '전체 현황 한눈에', icon: LayoutDashboard, color: 'bg-orange-100 text-orange-600' },
];

const viewNav = [
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
];

const projectNav = [
  { href: '/roadmap', label: '프로젝트 로드맵', desc: '장기 계획 관리', icon: Map, color: 'bg-purple-100 text-purple-600' },
];

const knowledgeNav = [
  { href: '/manuals', label: '매뉴얼/가이드', desc: '사용법 안내', icon: BookOpen, color: 'bg-lime-100 text-lime-600' },
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
        isActive ? color : 'bg-stone-50 text-stone-400 group-hover:bg-stone-100 group-hover:text-stone-600',
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

function SidebarContent({ isCollapsed }: { isCollapsed: boolean }) {
  const isAdmin = useIsAdmin();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 px-4 shrink-0 border-b border-stone-100',
        isCollapsed && 'justify-center px-2'
      )}>
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-sm shadow-orange-200/50">
            <span className="text-[11px] font-black text-white tracking-tight">AF</span>
          </div>
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
        <NavGroup items={mainNav} isCollapsed={isCollapsed} />
        <NavGroup title="일일 업무" items={viewNav} isCollapsed={isCollapsed} />
        <NavGroup title="프로젝트" items={projectNav} isCollapsed={isCollapsed} />
        <NavGroup title="지식베이스" items={knowledgeNav} isCollapsed={isCollapsed} />
        {isAdmin && (
          <NavGroup title="관리" items={manageNav} isCollapsed={isCollapsed} />
        )}
        {isAdmin && (
          <NavGroup items={logNav} isCollapsed={isCollapsed} />
        )}
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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

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
