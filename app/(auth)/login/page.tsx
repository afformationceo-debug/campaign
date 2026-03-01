'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, Mail, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      setIsLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Brand */}
      <div className="hidden lg:flex lg:w-[55%] bg-foreground text-background flex-col justify-between p-12 xl:p-16 relative overflow-hidden">
        {/* Decorative grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center">
              <span className="text-[11px] font-black text-foreground tracking-tight">AF</span>
            </div>
            <span className="text-sm font-bold tracking-tight">어포메이션</span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="text-sm font-medium text-background/50 mb-4">Campaign Management Solution</p>
          <h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.1]">
            캠페인 관리,<br />
            이제 내가<br />
            다 해줄게.
          </h1>
          <p className="mt-6 text-base text-background/60 leading-relaxed max-w-md">
            의료관광 캠페인의 기획부터 실행까지. 실시간 데이터 기반의 통합 관리 플랫폼으로 팀 협업과 자동화를 경험하세요.
          </p>

          {/* Feature tags */}
          <div className="mt-10 flex flex-wrap gap-2">
            {['실시간 동기화', '팀 협업', 'AI 인사이트', '캠페인 자동화'].map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-3 py-1.5 rounded-full bg-background/10 text-background/70 text-xs font-medium border border-background/10"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-background/30 text-xs">
          &copy; 2026 어포메이션 (Afformation). All rights reserved.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 lg:p-16 bg-background">
        <div className="w-full max-w-sm">
          {/* Logo (mobile) */}
          <div className="mb-10 text-center">
            <div className="lg:hidden mx-auto w-10 h-10 rounded-xl bg-foreground flex items-center justify-center mb-4">
              <span className="text-sm font-black text-background tracking-tight">AF</span>
            </div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">
              로그인
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              어포메이션에 로그인하세요
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-foreground font-medium text-[13px]">
                이메일
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@afformation.co"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="pl-10 h-10 bg-secondary/50 border-border focus-visible:bg-background text-[13px]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-foreground font-medium text-[13px]">
                비밀번호
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 h-10 bg-secondary/50 border-border focus-visible:bg-background text-[13px]"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[13px] text-destructive bg-destructive/5 border border-destructive/10 rounded-lg px-3 py-2.5">
                <div className="w-1 h-1 rounded-full bg-destructive shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-10 bg-foreground text-background hover:bg-foreground/90 font-semibold rounded-lg transition-all duration-150 text-[13px]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  로그인 중...
                </>
              ) : (
                <>
                  로그인
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-5 border-t border-border text-center">
            <p className="text-xs text-muted-foreground/60">
              문제가 있으시면 관리자에게 문의해 주세요
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
