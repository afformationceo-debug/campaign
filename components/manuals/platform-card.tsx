'use client';

import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { EcommercePlatform } from '@/lib/types/database';

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
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border p-4 cursor-pointer transition-all duration-200 hover:shadow-md',
        isSelected
          ? 'border-foreground bg-foreground/5 shadow-sm ring-1 ring-foreground/20'
          : 'hover:border-foreground/30 bg-card border-border'
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
                className="text-[10px] text-muted-foreground hover:text-foreground hover:underline flex items-center gap-0.5 mt-0.5"
              >
                셀러 페이지 <ExternalLink className="size-2.5" />
              </a>
            )}
          </div>
        </div>
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded-full">
          {platform.setup_difficulty}
        </Badge>
      </div>

      <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">
        {platform.description}
      </p>

      <div className="flex flex-wrap gap-1 mb-3">
        {platform.available_countries.slice(0, 5).map((country) => (
          <Badge key={country} variant="outline" className="text-[9px] px-1.5 py-0 border-border">
            {country}
          </Badge>
        ))}
        {platform.available_countries.length > 5 && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground border-border">
            +{platform.available_countries.length - 5}
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{platform.fee_structure}</span>
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded-full">
          {manualCount}개 매뉴얼
        </Badge>
      </div>
    </div>
  );
}
