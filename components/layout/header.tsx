'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, Moon, Sun, LogOut, ChevronRight } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/use-auth';
import { useSidebarStore } from '@/stores/sidebar-store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const breadcrumbMap: Record<string, string> = {
  dashboard: '대시보드',
  view: '일일 업무',
  assignee: '담당자별',
  campaign: '캠페인별',
  manage: '관리',
  campaigns: '캠페인 관리',
  tasks: '행위 관리',
  'task-config': 'Task 적용설정',
  users: '담당자 관리',
  configs: '캠페인 세팅',
  logs: '활동 로그',
};

export function Header() {
  const { profile, signOut } = useAuth();
  const { setMobileOpen } = useSidebarStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
    router.refresh();
  };

  // Build breadcrumb segments
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: breadcrumbMap[seg] || seg,
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/80 backdrop-blur-xl px-4 md:px-6">
      {/* Mobile menu */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden h-8 w-8"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-4.5 w-4.5" />
      </Button>

      {/* Breadcrumb + Date */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {breadcrumbs.map((crumb) => (
            <div key={crumb.href} className="flex items-center gap-1">
              {crumb.href !== breadcrumbs[0]?.href && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              )}
              {crumb.isLast ? (
                <span className="font-semibold text-foreground truncate">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
        <div className="md:hidden">
          <span className="font-semibold text-sm">
            {breadcrumbs[breadcrumbs.length - 1]?.label}
          </span>
        </div>
        <span className="hidden lg:block text-[11px] text-muted-foreground/70 ml-auto tabular-nums">
          {format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg hover:bg-accent"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">테마 변경</span>
        </Button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 gap-2 rounded-lg px-2 hover:bg-accent">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-[11px] font-semibold">
                  {profile?.name?.slice(0, 2) || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-sm font-medium truncate max-w-[100px]">
                {profile?.name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-sm font-semibold">
                    {profile?.name?.slice(0, 2) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-sm font-semibold truncate">{profile?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                  <Badge
                    variant="secondary"
                    className="w-fit mt-0.5 text-[10px] px-1.5 py-0"
                  >
                    {profile?.role === 'admin' ? '관리자' : '멤버'}
                  </Badge>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive cursor-pointer focus:text-destructive mx-1 rounded-md"
            >
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
