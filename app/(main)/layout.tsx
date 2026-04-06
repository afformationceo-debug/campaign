'use client';

import { useState, useEffect } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AiCommandShortcut } from '@/components/ai/ai-command-shortcut';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prevent hydration mismatch by deferring client-only components
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen overflow-hidden bg-background">
        {mounted && <Sidebar />}
        <div className="flex-1 flex flex-col overflow-hidden">
          {mounted && <Header />}
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="p-3 md:p-5 max-w-[1600px] mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
      {mounted && <AiCommandShortcut />}
    </TooltipProvider>
  );
}
