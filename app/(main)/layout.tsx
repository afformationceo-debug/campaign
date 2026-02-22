import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AiCommandShortcut } from '@/components/ai/ai-command-shortcut';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
      <AiCommandShortcut />
    </TooltipProvider>
  );
}
