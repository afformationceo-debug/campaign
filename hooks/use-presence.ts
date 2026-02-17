'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface PresenceUser {
  user_id: string;
  name: string;
  avatar_url?: string;
  online_at: string;
}

export function usePresence(room: string, currentUser?: { id: string; name: string; avatar_url?: string }) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase.channel(`presence-${room}`, {
      config: { presence: { key: currentUser.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>();
        const allUsers = Object.values(state).flat();
        // Deduplicate by user_id (same user may have multiple presence entries)
        const seen = new Set<string>();
        const users = allUsers.filter((u) => {
          if (seen.has(u.user_id)) return false;
          seen.add(u.user_id);
          return true;
        });
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUser.id,
            name: currentUser.name,
            avatar_url: currentUser.avatar_url,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, currentUser?.id]);

  return { onlineUsers };
}
