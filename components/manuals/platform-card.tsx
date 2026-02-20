'use client';

import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { EcommercePlatform } from '@/lib/types/database';

const DIFFICULTY_CONFIG: Record<string, { className: string }> = {
  '쉬움': { className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' },
  '보통': { className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' },
  '어려움': { className: 'bg-red-100 text-red-700 dark:bg-red-900/30' },
};

export function PlatformCard({
  platform,
  manualCount,
  isSelected,
  onClick,
}: {
  platform: EcommercePlatform;
  manualCount: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const difficulty = DIFFICULTY_CONFIG[platform.setup_difficulty ?? '보통'] ?? DIFFICULTY_CONFIG['보통'];

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:shadow-md',
        isSelected
          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
          : 'hover:border-primary/30 bg-card'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{platform.logo_emoji}</span>
          <div>
            <h3 className="font-semibold text-sm leading-tight">{platform.platform_name}</h3>
            {platform.seller_url && (
              <a
                href={platform.seller_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5"
              >
                셀러 페이지 <ExternalLink className="size-2.5" />
              </a>
            )}
          </div>
        </div>
        <Badge variant="secondary" className={cn('text-[9px] px-1.5 py-0', difficulty.className)}>
          {platform.setup_difficulty}
        </Badge>
      </div>

      <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">
        {platform.description}
      </p>

      <div className="flex flex-wrap gap-1 mb-3">
        {platform.available_countries.slice(0, 5).map((country) => (
          <Badge key={country} variant="outline" className="text-[9px] px-1.5 py-0">
            {country}
          </Badge>
        ))}
        {platform.available_countries.length > 5 && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">
            +{platform.available_countries.length - 5}
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{platform.fee_structure}</span>
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
          {manualCount}개 매뉴얼
        </Badge>
      </div>
    </div>
  );
}
