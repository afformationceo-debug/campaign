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
        'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-150',
        isActive
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        isCollapsed && 'justify-center px-2'
      )}
    >
      <Icon className={cn(
        'h-4 w-4 shrink-0 transition-colors duration-150',
      )} />
      {!isCollapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium text-xs">{label}</TooltipContent>
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
    <div className="space-y-0.5">
      {title && !isCollapsed && (
        <p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.1em]">
          {title}
        </p>
      )}
      {isCollapsed && title && (
        <div className="mx-auto w-5 h-px bg-border my-2" />
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
        'flex items-center h-14 px-3 shrink-0 border-b border-border',
        isCollapsed && 'justify-center px-2'
      )}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center">
            <span className="text-[10px] font-black text-background tracking-tight">AF</span>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-[13px] leading-none text-foreground">어포메이션</span>
              <span className="text-[10px] text-muted-foreground leading-none mt-0.5">Campaign CMS</span>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1 scrollbar-thin">
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
        'border-t p-2 shrink-0',
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
          'hidden md:flex flex-col border-r border-border bg-background transition-all duration-200 relative',
          isCollapsed ? 'w-[60px]' : 'w-[240px]'
        )}
      >
        <SidebarContent isCollapsed={isCollapsed} />
        <Button
          variant="outline"
          size="icon"
          className="absolute -right-3 top-[68px] h-5 w-5 rounded-full bg-background shadow-sm border text-muted-foreground hover:text-foreground transition-all duration-150"
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
        <SheetContent side="left" className="w-[240px] p-0">
          <SidebarContent isCollapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  );
}
