'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AiCommandCenter } from './ai-command-center';

type AiContext = 'dashboard' | 'roadmap' | 'campaign';

function detectContext(pathname: string): AiContext {
  if (pathname.includes('/roadmap')) return 'roadmap';
  if (pathname.includes('/campaign') || pathname.includes('/view/campaign')) return 'campaign';
  return 'dashboard';
}

export function AiCommandShortcut() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const context = detectContext(pathname);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <AiCommandCenter open={open} onOpenChange={setOpen} context={context} />
  );
}
