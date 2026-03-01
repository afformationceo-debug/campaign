'use client';

import { useState, useEffect } from 'react';
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
  results: '일일 결과값',
  manage: '관리',
  campaigns: '캠페인 관리',
  qa: 'QA 관리',
  tasks: '행위 관리',
  'task-config': 'Task 적용설정',
  users: '담당자 관리',
  configs: '캠페인 세팅',
  logs: '활동 로그',
  roadmap: '프로젝트 로드맵',
  manuals: '매뉴얼/가이드',
};

export function Header() {
  const { profile, signOut } = useAuth();
  const { setMobileOpen } = useSidebarStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // Avoid hydration mismatch: render date only on client
  const [dateStr, setDateStr] = useState('');
  useEffect(() => {
    setDateStr(format(new Date(), 'yyyy.MM.dd (EEEE)', { locale: ko }));
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
    router.refresh();
  };

  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: breadcrumbMap[seg] || seg,
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center gap-3 border-b border-border bg-background px-4 md:px-5">
      {/* Mobile menu */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden h-7 w-7"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Breadcrumb */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <nav className="hidden md:flex items-center gap-1 text-[13px]">
          {breadcrumbs.map((crumb) => (
            <div key={crumb.href} className="flex items-center gap-1">
              {crumb.href !== breadcrumbs[0]?.href && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              )}
              {crumb.isLast ? (
                <span className="font-semibold text-foreground truncate">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground transition-colors duration-150 truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
        <div className="md:hidden">
          <span className="font-semibold text-[13px]">
            {breadcrumbs[breadcrumbs.length - 1]?.label}
          </span>
        </div>
        <span className="hidden lg:block text-[11px] text-muted-foreground/50 ml-auto tabular-nums font-medium">
          {dateStr}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">테마 변경</span>
        </Button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-7 gap-1.5 rounded-md px-1.5">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-foreground text-background text-[9px] font-bold">
                  {profile?.name?.slice(0, 2) || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-[12px] font-medium truncate max-w-[80px]">
                {profile?.name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="p-3">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-foreground text-background text-[11px] font-bold">
                    {profile?.name?.slice(0, 2) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-[13px] font-semibold truncate">{profile?.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
                  <Badge
                    variant="secondary"
                    className="w-fit mt-0.5 text-[9px] px-1.5 py-0 font-medium"
                  >
                    {profile?.role === 'admin' ? '관리자' : '멤버'}
                  </Badge>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive cursor-pointer focus:text-destructive mx-1 rounded-md text-[13px]"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
