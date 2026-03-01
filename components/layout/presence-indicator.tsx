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
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground">
                {onlineUsers.length}
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border-[1.5px] border-background" />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <p className="font-semibold mb-1">접속 중 ({onlineUsers.length}명)</p>
          {onlineUsers.map((u) => (
            <p key={u.user_id} className="text-[11px]">{u.name}</p>
          ))}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground font-medium">
        접속 중 <span className="text-foreground font-semibold">{onlineUsers.length}명</span>
      </p>
      <div className="flex flex-wrap gap-0.5">
        {onlineUsers.slice(0, 6).map((u) => (
          <Tooltip key={u.user_id} delayDuration={0}>
            <TooltipTrigger asChild>
              <Avatar className={cn('h-6 w-6 border border-border')}>
                <AvatarFallback className="text-[9px] font-medium bg-secondary text-foreground">
                  {u.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent className="text-xs">{u.name}</TooltipContent>
          </Tooltip>
        ))}
        {onlineUsers.length > 6 && (
          <span className="text-[10px] text-muted-foreground self-center ml-0.5">
            +{onlineUsers.length - 6}
          </span>
        )}
      </div>
    </div>
  );
}
