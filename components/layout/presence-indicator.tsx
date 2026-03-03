'use client';

import { usePresence } from '@/hooks/use-presence';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const AVATAR_COLORS = [
  'bg-orange-100 text-orange-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
];

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
              <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center text-[10px] font-bold text-orange-600">
                {onlineUsers.length}
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border-[1.5px] border-white" />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs rounded-xl">
          <p className="font-bold mb-1 text-stone-700">접속 중 ({onlineUsers.length}명)</p>
          {onlineUsers.map((u) => (
            <p key={u.user_id} className="text-[11px] text-stone-500">{u.name}</p>
          ))}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-stone-400 font-medium">
        지금 접속 중 <span className="text-orange-600 font-bold">{onlineUsers.length}명</span>
      </p>
      <div className="flex flex-wrap gap-0.5">
        {onlineUsers.slice(0, 6).map((u, i) => (
          <Tooltip key={u.user_id} delayDuration={0}>
            <TooltipTrigger asChild>
              <Avatar className="h-6 w-6 border border-stone-100">
                <AvatarFallback className={cn('text-[9px] font-bold', AVATAR_COLORS[i % AVATAR_COLORS.length])}>
                  {u.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent className="text-xs rounded-lg">{u.name}</TooltipContent>
          </Tooltip>
        ))}
        {onlineUsers.length > 6 && (
          <span className="text-[10px] text-stone-400 self-center ml-0.5">
            +{onlineUsers.length - 6}
          </span>
        )}
      </div>
    </div>
  );
}
