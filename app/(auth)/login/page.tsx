'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, Mail, ArrowRight, Zap, Users, Globe, BarChart3, Shield } from 'lucide-react';

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
    <>
      <style jsx>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float1 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-12px) translateX(6px); }
          66% { transform: translateY(6px) translateX(-4px); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(8px) translateX(-8px); }
          66% { transform: translateY(-10px) translateX(5px); }
        }
        @keyframes float3 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-8px) translateX(-6px); }
          66% { transform: translateY(10px) translateX(8px); }
        }
        @keyframes float4 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(10px) translateX(4px); }
          66% { transform: translateY(-6px) translateX(-7px); }
        }
        @keyframes float5 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-14px) translateX(-5px); }
          66% { transform: translateY(4px) translateX(6px); }
        }
        @keyframes float6 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(6px) translateX(7px); }
          66% { transform: translateY(-8px) translateX(-3px); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes slideUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .animate-gradient {
          background-size: 300% 300%;
          animation: gradientShift 8s ease infinite;
        }
        .animate-float-1 { animation: float1 6s ease-in-out infinite; }
        .animate-float-2 { animation: float2 7s ease-in-out infinite; }
        .animate-float-3 { animation: float3 8s ease-in-out infinite; }
        .animate-float-4 { animation: float4 5s ease-in-out infinite; }
        .animate-float-5 { animation: float5 9s ease-in-out infinite; }
        .animate-float-6 { animation: float6 6.5s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulseGlow 3s ease-in-out infinite; }
        .animate-slide-up { animation: slideUp 0.6s ease-out forwards; }
        .animate-fade-in { animation: fadeIn 0.8s ease-out forwards; }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }
      `}</style>

      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Left Side - Brand Visual */}
        <div className="relative lg:w-[55%] min-h-[320px] lg:min-h-screen flex flex-col items-center justify-center p-8 lg:p-16 overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 animate-gradient">
          {/* Decorative background elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-[10%] left-[15%] w-72 h-72 bg-white/5 rounded-full blur-3xl animate-pulse-glow" />
            <div className="absolute bottom-[20%] right-[10%] w-96 h-96 bg-violet-400/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
            <div className="absolute top-[50%] left-[50%] w-64 h-64 bg-blue-300/5 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '3s' }} />
          </div>

          {/* Content */}
          <div className="relative z-10 max-w-lg text-center lg:text-left">
            {/* Brand */}
            <div className="animate-slide-up">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm font-medium mb-8">
                <Zap className="h-3.5 w-3.5" />
                Human in the Loop
              </div>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-extrabold text-white tracking-tight leading-tight">
                AFFORMATION
              </h1>
              <p className="mt-3 text-lg lg:text-xl text-blue-100 font-medium">
                Campaign Management Solution
              </p>
              <p className="mt-6 text-base text-blue-200/80 leading-relaxed max-w-md">
                의료관광 캠페인의 기획부터 실행까지, 실시간 데이터 기반의 통합 관리 플랫폼. 팀 협업과 자동화로 캠페인 성과를 극대화하세요.
              </p>
            </div>

            {/* Floating Badges */}
            <div className="mt-10 lg:mt-14 flex flex-wrap gap-3 justify-center lg:justify-start">
              <span className="animate-float-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-white text-sm font-medium shadow-lg">
                <BarChart3 className="h-4 w-4 text-blue-200" />
                45+ Campaigns
              </span>
              <span className="animate-float-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-white text-sm font-medium shadow-lg">
                <Zap className="h-4 w-4 text-yellow-300" />
                Real-time Sync
              </span>
              <span className="animate-float-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-white text-sm font-medium shadow-lg">
                <Globe className="h-4 w-4 text-emerald-300" />
                Medical Tourism
              </span>
              <span className="animate-float-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-white text-sm font-medium shadow-lg">
                <Users className="h-4 w-4 text-violet-200" />
                10 Team Members
              </span>
              <span className="animate-float-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-white text-sm font-medium shadow-lg">
                <Shield className="h-4 w-4 text-cyan-300" />
                Data Secured
              </span>
              <span className="animate-float-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-white text-sm font-medium shadow-lg">
                <ArrowRight className="h-4 w-4 text-rose-300" />
                Automated Workflow
              </span>
            </div>
          </div>

          {/* Bottom attribution */}
          <div className="relative z-10 mt-12 lg:absolute lg:bottom-8 lg:left-16 text-blue-200/50 text-xs">
            &copy; 2026 어포메이션 (Afformation). All rights reserved.
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="lg:w-[45%] flex flex-col items-center justify-center p-6 sm:p-8 lg:p-16 bg-white min-h-[calc(100vh-320px)] lg:min-h-screen">
          <div className="w-full max-w-sm animate-fade-in">
            {/* Logo */}
            <div className="mb-10 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="text-xl font-bold text-white tracking-tight">AF</span>
              </div>
              <h2 className="mt-5 text-2xl font-bold text-zinc-900 tracking-tight">
                로그인
              </h2>
              <p className="mt-1.5 text-sm text-zinc-500">
                어포메이션 CMS에 로그인하세요
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-700 font-medium text-sm">
                  이메일
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@afformation.co"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="pl-10 h-11 bg-zinc-50/50 border-zinc-200 focus-visible:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-700 font-medium text-sm">
                  비밀번호
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 h-11 bg-zinc-50/50 border-zinc-200 focus-visible:bg-white"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-lg shadow-blue-500/25 transition-all duration-200"
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
            <div className="mt-10 pt-6 border-t border-zinc-100 text-center">
              <p className="text-xs text-zinc-400">
                문제가 있으시면 관리자에게 문의해 주세요
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
