'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Target,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { PresenceIndicator } from './presence-indicator';

const mainNav = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
];

const viewNav = [
  { href: '/view/assignee', label: '담당자별', icon: Users },
  { href: '/view/campaign', label: '캠페인별', icon: Target },
  { href: '/view/results', label: '일일 결과값', icon: FileText },
];

const manageNav = [
  { href: '/manage/campaigns', label: '캠페인 관리', icon: Building2 },
  { href: '/manage/qa', label: 'QA 관리', icon: MessageSquareWarning },
  { href: '/manage/tasks', label: '행위 관리', icon: ListChecks },
  { href: '/manage/task-config', label: 'Task 적용설정', icon: Settings2 },
  { href: '/manage/users', label: '담당자 관리', icon: UserCog },
  { href: '/manage/configs', label: '캠페인 세팅', icon: Wrench },
];

const projectNav = [
  { href: '/roadmap', label: '프로젝트 로드맵', icon: Map },
];

const knowledgeNav = [
  { href: '/manuals', label: '매뉴얼/가이드', icon: BookOpen },
];

const logNav = [
  { href: '/logs', label: '활동 로그', icon: History },
];

function NavItem({
  href,
  label,
  icon: Icon,
  isCollapsed,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  isCollapsed: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  const content = (
    <Link
      href={href}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200',
        isActive
          ? 'bg-primary/10 text-primary font-semibold shadow-sm'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        isCollapsed && 'justify-center px-2.5'
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
      )}
      <Icon className={cn(
        'h-[18px] w-[18px] shrink-0 transition-transform duration-200',
        !isActive && 'group-hover:scale-110'
      )} />
      {!isCollapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">{label}</TooltipContent>
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
  items: typeof mainNav;
  isCollapsed: boolean;
}) {
  return (
    <div className="space-y-1">
      {title && !isCollapsed && (
        <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
          {title}
        </p>
      )}
      {isCollapsed && title && (
        <div className="mx-auto w-6 h-px bg-border my-2" />
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
        'flex items-center h-14 px-4 shrink-0',
        isCollapsed && 'justify-center px-2'
      )}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <span className="text-[11px] font-bold text-white tracking-tight">AF</span>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-[13px] leading-tight">어포메이션</span>
              <span className="text-[10px] text-muted-foreground leading-tight">Campaign CMS</span>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5 scrollbar-thin">
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
        'border-t p-3 shrink-0',
        isCollapsed && 'px-2'
      )}>
        <PresenceIndicator isCollapsed={isCollapsed} />
      </div>
    </div>
  );
}

export function Sidebar() {
  const { isCollapsed, toggle, isMobileOpen, setMobileOpen } = useSidebarStore();
  const pathname = usePathname();

  // Auto-close mobile Sheet on navigation so sidebar doesn't block content
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r bg-sidebar/80 backdrop-blur-xl transition-all duration-300 relative',
          isCollapsed ? 'w-[68px]' : 'w-[260px]'
        )}
      >
        <SidebarContent isCollapsed={isCollapsed} />
        <Button
          variant="outline"
          size="icon"
          className="absolute -right-3 top-[68px] h-6 w-6 rounded-full bg-background shadow-md border hover:bg-accent transition-transform duration-200 hover:scale-110"
          onClick={toggle}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>
      </aside>

      {/* Mobile */}
      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[260px] p-0">
          <SidebarContent isCollapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  );
}
