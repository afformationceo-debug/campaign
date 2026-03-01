'use client';

import { useCallback } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { User, TaskCategory } from '@/lib/types/database';
import { CATEGORY_ORDER } from '@/lib/utils/category-colors';

interface FilterBarProps {
  date: string;
  onDateChange: (date: string) => void;
  users?: User[];
  selectedUserId?: string | null;
  onUserChange?: (userId: string | null) => void;
  categories?: TaskCategory[];
  selectedCategories?: TaskCategory[];
  onCategoryChange?: (categories: TaskCategory[]) => void;
  countries?: string[];
  selectedCountry?: string;
  onCountryChange?: (country: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  searchText?: string;
  onSearchChange?: (text: string) => void;
}

export function FilterBar({
  date,
  onDateChange,
  users,
  selectedUserId,
  onUserChange,
  categories,
  selectedCategories,
  onCategoryChange,
  countries,
  selectedCountry,
  onCountryChange,
  statusFilter,
  onStatusFilterChange,
  searchText,
  onSearchChange,
}: FilterBarProps) {
  const parsedDate = parseISO(date);

  const handlePrevDay = useCallback(() => {
    onDateChange(format(subDays(parsedDate, 1), 'yyyy-MM-dd'));
  }, [parsedDate, onDateChange]);

  const handleNextDay = useCallback(() => {
    onDateChange(format(addDays(parsedDate, 1), 'yyyy-MM-dd'));
  }, [parsedDate, onDateChange]);

  const handleToday = useCallback(() => {
    onDateChange(format(new Date(), 'yyyy-MM-dd'));
  }, [onDateChange]);

  const handleCalendarSelect = useCallback(
    (day: Date | undefined) => {
      if (day) {
        onDateChange(format(day, 'yyyy-MM-dd'));
      }
    },
    [onDateChange]
  );

  const handleCategoryToggle = useCallback(
    (category: TaskCategory) => {
      if (!selectedCategories || !onCategoryChange) return;
      const isSelected = selectedCategories.includes(category);
      if (isSelected) {
        onCategoryChange(selectedCategories.filter((c) => c !== category));
      } else {
        onCategoryChange([...selectedCategories, category]);
      }
    },
    [selectedCategories, onCategoryChange]
  );

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-card p-2.5">
      {/* Date Selector */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handlePrevDay}
          aria-label="이전 날짜"
          className="h-7 w-7 rounded-lg"
        >
          <ChevronLeft className="size-3.5" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="min-w-[160px] justify-start text-left font-normal h-7 rounded-lg text-xs"
            >
              <CalendarDays className="size-3.5 text-muted-foreground" />
              <span>
                {format(parsedDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parsedDate}
              onSelect={handleCalendarSelect}
              defaultMonth={parsedDate}
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleNextDay}
          aria-label="다음 날짜"
          className="h-7 w-7 rounded-lg"
        >
          <ChevronRight className="size-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="xs"
          onClick={handleToday}
          className="text-[11px] text-muted-foreground hover:text-foreground h-7 rounded-lg"
        >
          오늘
        </Button>
      </div>

      {/* Divider */}
      <div className="hidden sm:block h-5 w-px bg-border" />

      {/* User Selector */}
      {users && onUserChange && (
        <Select
          value={selectedUserId ?? '__all__'}
          onValueChange={(val) =>
            onUserChange(val === '__all__' ? null : val)
          }
        >
          <SelectTrigger size="sm" className="min-w-[110px] h-8 rounded-lg text-[13px] bg-secondary/50 border-border">
            <SelectValue placeholder="담당자 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">전체 담당자</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Country Selector */}
      {countries && onCountryChange && (
        <Select
          value={selectedCountry ?? '__all__'}
          onValueChange={(val) =>
            onCountryChange(val === '__all__' ? '' : val)
          }
        >
          <SelectTrigger size="sm" className="min-w-[90px] h-8 rounded-lg text-[13px] bg-secondary/50 border-border">
            <SelectValue placeholder="국가 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">전체 국가</SelectItem>
            {countries.map((country) => (
              <SelectItem key={country} value={country}>
                {country}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Status Filter */}
      {onStatusFilterChange && (
        <Select
          value={statusFilter ?? '__all__'}
          onValueChange={(val) =>
            onStatusFilterChange(val === '__all__' ? '' : val)
          }
        >
          <SelectTrigger size="sm" className="min-w-[90px] h-8 rounded-lg text-[13px] bg-secondary/50 border-border">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">전체 상태</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Category Multi-Select */}
      {categories && onCategoryChange && selectedCategories && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="text-[13px] h-8 rounded-full border-border">
              카테고리
              {selectedCategories.length > 0 &&
                selectedCategories.length < CATEGORY_ORDER.length && (
                  <span className="ml-1 rounded-full bg-secondary px-1.5 text-[11px] font-semibold text-foreground">
                    {selectedCategories.length}
                  </span>
                )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="space-y-0.5">
              {CATEGORY_ORDER.map((cat) => {
                const isActive = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryToggle(cat)}
                    className={cn(
                      'flex w-full items-center rounded-full px-2.5 py-1.5 text-xs transition-colors',
                      isActive
                        ? 'bg-secondary text-foreground font-medium'
                        : 'hover:bg-muted text-muted-foreground border border-transparent'
                    )}
                  >
                    <span
                      className={cn(
                        'mr-2 h-2 w-2 rounded-full transition-colors',
                        isActive ? 'bg-foreground' : 'bg-muted-foreground/30'
                      )}
                    />
                    {cat}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Search Input */}
      {onSearchChange !== undefined && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={searchText ?? ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="검색..."
            className="h-8 w-[160px] pl-8 text-[13px] rounded-lg bg-secondary/50 border-border"
          />
        </div>
      )}
    </div>
  );
}
