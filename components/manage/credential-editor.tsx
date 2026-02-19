'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PlatformCredential } from '@/lib/types/database';

const PLATFORM_PRESETS = [
  '구글', '인스타그램', '페이스북', '트위터', '틱톡',
  '라인', '왓츠앱', '유튜브', '네이버', '기타',
];

/** Parse JSON string → PlatformCredential[], fallback to legacy text parsing */
export function parseCredentials(value: string | null): PlatformCredential[] {
  if (!value) return [];
  // Try JSON first
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fall through to legacy text parsing
  }
  // Legacy: "구글: id / pw | 인스타: id / pw"
  return value.split('|').map((segment) => {
    const trimmed = segment.trim();
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) return { platform: '기타', username: trimmed, password: '', owner: '' };
    const platform = trimmed.slice(0, colonIdx).trim();
    const rest = trimmed.slice(colonIdx + 1).trim();
    const parts = rest.split('/').map((p) => p.trim());
    return {
      platform,
      username: parts[0] ?? '',
      password: parts[1] ?? '',
      owner: parts[2] ?? '',
    };
  }).filter((c) => c.username || c.password);
}

/** Serialize PlatformCredential[] → JSON string */
export function serializeCredentials(creds: PlatformCredential[]): string {
  const filtered = creds.filter((c) => c.platform || c.username || c.password);
  return filtered.length > 0 ? JSON.stringify(filtered) : '';
}

/** For CSV export: convert JSON → human-readable text */
export function credentialsToText(value: string | null): string {
  const creds = parseCredentials(value);
  if (creds.length === 0) return '';
  return creds
    .map((c) => {
      const base = `${c.platform}: ${c.username} / ${c.password}`;
      return c.owner ? `${base} / ${c.owner}` : base;
    })
    .join(' | ');
}

/** For CSV import: convert text → JSON string */
export function textToCredentialsJson(text: string): string {
  if (!text) return '';
  // If already JSON, return as-is
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return text;
  } catch {
    // continue
  }
  const creds = parseCredentials(text);
  return serializeCredentials(creds);
}

interface CredentialEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string | null;
  onSave: (value: string) => void;
  campaignName?: string;
}

export function CredentialEditor({
  open,
  onOpenChange,
  value,
  onSave,
  campaignName,
}: CredentialEditorProps) {
  const [credentials, setCredentials] = useState<PlatformCredential[]>([]);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) {
      const parsed = parseCredentials(value);
      setCredentials(parsed.length > 0 ? parsed : [{ platform: '', username: '', password: '', owner: '' }]);
      setVisiblePasswords(new Set());
    }
  }, [open, value]);

  const addRow = () => {
    setCredentials([...credentials, { platform: '', username: '', password: '', owner: '' }]);
  };

  const removeRow = (idx: number) => {
    setCredentials(credentials.filter((_, i) => i !== idx));
    setVisiblePasswords((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < idx) next.add(i);
        else if (i > idx) next.add(i - 1);
      });
      return next;
    });
  };

  const updateRow = (idx: number, field: keyof PlatformCredential, val: string) => {
    setCredentials(credentials.map((c, i) => (i === idx ? { ...c, [field]: val } : c)));
  };

  const togglePassword = (idx: number) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const handleSave = () => {
    const serialized = serializeCredentials(credentials);
    onSave(serialized);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            플랫폼별 ID/PW
          </DialogTitle>
          {campaignName && (
            <p className="text-xs text-muted-foreground">{campaignName}</p>
          )}
        </DialogHeader>

        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {credentials.map((cred, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg border bg-muted/20">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Select
                    value={cred.platform || '__custom__'}
                    onValueChange={(v) => updateRow(idx, 'platform', v === '__custom__' ? '' : v)}
                  >
                    <SelectTrigger className="h-7 w-[120px] text-xs">
                      <SelectValue placeholder="플랫폼" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORM_PRESETS.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">직접 입력</SelectItem>
                    </SelectContent>
                  </Select>
                  {(!cred.platform || !PLATFORM_PRESETS.includes(cred.platform)) && (
                    <Input
                      value={cred.platform}
                      onChange={(e) => updateRow(idx, 'platform', e.target.value)}
                      placeholder="플랫폼명"
                      className="h-7 text-xs flex-1"
                    />
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">ID / 이메일</Label>
                    <Input
                      value={cred.username}
                      onChange={(e) => updateRow(idx, 'username', e.target.value)}
                      placeholder="user@example.com"
                      className="h-7 text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">비밀번호</Label>
                    <div className="relative mt-0.5">
                      <Input
                        type={visiblePasswords.has(idx) ? 'text' : 'password'}
                        value={cred.password}
                        onChange={(e) => updateRow(idx, 'password', e.target.value)}
                        placeholder="••••••"
                        className="h-7 text-xs pr-7"
                      />
                      <button
                        type="button"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => togglePassword(idx)}
                      >
                        {visiblePasswords.has(idx) ? (
                          <EyeOff className="size-3" />
                        ) : (
                          <Eye className="size-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">명의자</Label>
                    <Input
                      value={cred.owner || ''}
                      onChange={(e) => updateRow(idx, 'owner', e.target.value)}
                      placeholder="홍길동"
                      className="h-7 text-xs mt-0.5"
                    />
                  </div>
                </div>
              </div>
              <button
                className="mt-1 size-6 flex items-center justify-center rounded hover:bg-destructive/10 shrink-0"
                onClick={() => removeRow(idx)}
              >
                <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addRow}>
          <Plus className="size-3" />
          플랫폼 추가
        </Button>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>취소</Button>
          <Button size="sm" onClick={handleSave}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
