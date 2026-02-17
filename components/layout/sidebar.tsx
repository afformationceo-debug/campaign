'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Target,
  Building2,
  ListChecks,
  Settings2,
  UserCog,
  Wrench,
  History,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { PresenceIndicator } from './presence-indicator';

const mainNav = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
];

const viewNav = [
  { href: '/view/assignee', label: '담당자별', icon: Users },
  { href: '/view/campaign', label: '캠페인별', icon: Target },
];

const manageNav = [
  { href: '/manage/campaigns', label: '캠페인 관리', icon: Building2 },
  { href: '/manage/tasks', label: '행위 관리', icon: ListChecks },
  { href: '/manage/task-config', label: 'Task 적용설정', icon: Settings2 },
  { href: '/manage/users', label: '담당자 관리', icon: UserCog },
  { href: '/manage/configs', label: '캠페인 세팅', icon: Wrench },
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
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent',
        isActive
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground',
        isCollapsed && 'justify-center px-2'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!isCollapsed && <span>{label}</span>}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function SidebarContent({ isCollapsed }: { isCollapsed: boolean }) {
  const isAdmin = useIsAdmin();

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex items-center h-14 px-4', isCollapsed && 'justify-center px-2')}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
            <span className="text-xs font-bold text-white">AF</span>
          </div>
          {!isCollapsed && (
            <span className="font-semibold tracking-tight text-sm">어포메이션 CMS</span>
          )}
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-6">
        <div className="space-y-1">
          {mainNav.map((item) => (
            <NavItem key={item.href} {...item} isCollapsed={isCollapsed} />
          ))}
        </div>

        <div className="space-y-1">
          {!isCollapsed && (
            <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              일일 업무
            </p>
          )}
          {viewNav.map((item) => (
            <NavItem key={item.href} {...item} isCollapsed={isCollapsed} />
          ))}
        </div>

        {isAdmin && (
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                관리
              </p>
            )}
            {manageNav.map((item) => (
              <NavItem key={item.href} {...item} isCollapsed={isCollapsed} />
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="space-y-1">
            {logNav.map((item) => (
              <NavItem key={item.href} {...item} isCollapsed={isCollapsed} />
            ))}
          </div>
        )}
      </div>

      <Separator />
      <div className={cn('p-3', isCollapsed && 'px-2')}>
        <PresenceIndicator isCollapsed={isCollapsed} />
      </div>
    </div>
  );
}

export function Sidebar() {
  const { isCollapsed, toggle, isMobileOpen, setMobileOpen } = useSidebarStore();

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r bg-card transition-all duration-300 relative',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent isCollapsed={isCollapsed} />
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-16 h-6 w-6 rounded-full border bg-background shadow-sm"
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
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent isCollapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  );
}
