'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, Mail, ArrowRight, Sparkles, Users, BarChart3, Zap } from 'lucide-react';

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

  const features = [
    { icon: BarChart3, label: '실시간 대시보드', desc: '팀 현황을 한눈에 파악하세요', color: 'bg-blue-50 text-blue-500' },
    { icon: Users, label: '팀 협업', desc: '담당자별 업무를 쉽게 관리해요', color: 'bg-emerald-50 text-emerald-500' },
    { icon: Sparkles, label: 'AI 인사이트', desc: '데이터 기반 의사결정을 도와줘요', color: 'bg-violet-50 text-violet-500' },
    { icon: Zap, label: '캠페인 자동화', desc: '반복 업무를 줄여드려요', color: 'bg-amber-50 text-amber-500' },
  ];

  return (
    <div className="min-h-screen flex bg-[#FEFCF9]">
      {/* Left Side - Brand */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-orange-500 via-orange-400 to-amber-400 text-white flex-col justify-between p-12 xl:p-16 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-32 -right-32 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-48 -left-24 size-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-1/2 right-0 size-64 rounded-full bg-orange-300/20 blur-2xl" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <span className="text-[11px] font-black tracking-tight">AF</span>
            </div>
            <span className="text-sm font-bold tracking-tight opacity-90">어포메이션</span>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.15]">
            캠페인 관리,<br />
            이제 쉽고<br />
            빠르게.
          </h1>
          <p className="mt-6 text-base text-white/70 leading-relaxed max-w-md">
            의료관광 캠페인의 기획부터 실행까지, 우리 팀에 딱 맞는 통합 관리 도구로 함께 일하세요.
          </p>

          {/* Feature cards */}
          <div className="mt-10 grid grid-cols-2 gap-3">
            {features.map((feat) => (
              <div
                key={feat.label}
                className="flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-3.5"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <feat.icon className="size-4" />
                </div>
                <div>
                  <p className="text-[12px] font-bold leading-tight">{feat.label}</p>
                  <p className="text-[10px] text-white/60 leading-tight mt-0.5">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-white/40 text-xs">
          &copy; 2026 어포메이션 (Afformation). All rights reserved.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 lg:p-16">
        <div className="w-full max-w-sm">
          {/* Logo (mobile) */}
          <div className="mb-10 text-center">
            <div className="lg:hidden mx-auto size-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center mb-4 shadow-lg shadow-orange-200/50">
              <span className="text-sm font-black text-white tracking-tight">AF</span>
            </div>
            <h2 className="text-2xl font-black text-stone-800 tracking-tight">
              반갑습니다!
            </h2>
            <p className="mt-2 text-sm text-stone-400">
              어포메이션에 로그인하고 업무를 시작하세요
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-stone-600 font-semibold text-[13px]">
                이메일 주소
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-300" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@afformation.co"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="pl-11 h-11 bg-white border-stone-200 rounded-xl focus-visible:ring-orange-200 focus-visible:border-orange-300 text-[13px] placeholder:text-stone-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-stone-600 font-semibold text-[13px]">
                비밀번호
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-300" />
                <Input
                  id="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-11 h-11 bg-white border-stone-200 rounded-xl focus-visible:ring-orange-200 focus-visible:border-orange-300 text-[13px] placeholder:text-stone-300"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <div className="size-1.5 rounded-full bg-red-500 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-orange-500 to-orange-400 text-white hover:from-orange-600 hover:to-orange-500 font-bold rounded-xl transition-all duration-200 text-[14px] shadow-md shadow-orange-200/50 hover:shadow-lg hover:shadow-orange-200/50"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  로그인 중...
                </>
              ) : (
                <>
                  로그인하기
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-5 border-t border-stone-100 text-center">
            <p className="text-xs text-stone-400">
              로그인이 안 되시나요? 관리자에게 문의해 주세요
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
