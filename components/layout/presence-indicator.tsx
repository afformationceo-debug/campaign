'use client';

import { usePresence } from '@/hooks/use-presence';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function PresenceIndicator({ isCollapsed }: { isCollapsed: boolean }) {
  const { profile } = useAuth();
  const { onlineUsers } = usePresence(
    'global',
    profile ? { id: profile.id, name: profile.name, avatar_url: profile.avatar_url ?? undefined } : undefined
  );

  if (onlineUsers.length === 0) return null;

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-medium text-emerald-700 dark:text-emerald-300">
                {onlineUsers.length}
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-background" />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="font-medium mb-1">접속 중 ({onlineUsers.length}명)</p>
          {onlineUsers.map((u) => (
            <p key={u.user_id} className="text-xs">{u.name}</p>
          ))}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        접속 중 <span className="text-emerald-600 font-medium">{onlineUsers.length}명</span>
      </p>
      <div className="flex flex-wrap gap-1">
        {onlineUsers.slice(0, 6).map((u) => (
          <Tooltip key={u.user_id} delayDuration={0}>
            <TooltipTrigger asChild>
              <Avatar className={cn('h-7 w-7 border-2 border-emerald-400')}>
                <AvatarFallback className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {u.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{u.name}</TooltipContent>
          </Tooltip>
        ))}
        {onlineUsers.length > 6 && (
          <span className="text-xs text-muted-foreground self-center ml-1">
            +{onlineUsers.length - 6}
          </span>
        )}
      </div>
    </div>
  );
}
