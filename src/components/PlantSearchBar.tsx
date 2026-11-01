'use client';

import React, { useRef, useEffect } from 'react';
import { Search, X, Layers, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StatusHistory } from '@/lib/types';

type PlantStatus = StatusHistory['status'];

export interface PlantSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: PlantStatus | 'All';
  onClearStatusFilter: () => void;
  currentSectionMatchesCount: number;
  otherSectionMatchesCount: number;
  otherGardenMatchesCount?: number;
  totalMatches: number;
  className?: string;
}

export function PlantSearchBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onClearStatusFilter,
  currentSectionMatchesCount,
  otherSectionMatchesCount,
  otherGardenMatchesCount = 0,
  totalMatches,
  className,
}: PlantSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut: press '/' to focus search, and 'Escape' to clear/blur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is inside another form control
      const target = e.target as HTMLElement;
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        if (searchQuery) {
          onSearchChange('');
        } else {
          inputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, onSearchChange]);

  const hasActiveQuery = searchQuery.trim().length > 0;
  const isFilteredBySection = statusFilter !== 'All';

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      <div
        className={cn(
          "relative flex items-center w-full rounded-xl border bg-background/95 backdrop-blur-xs px-3 shadow-xs transition-all",
          hasActiveQuery
            ? "border-primary ring-2 ring-primary/25 bg-primary/[0.03]"
            : "border-input focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary"
        )}
      >
        <Search
          className={cn(
            "h-4 w-4 shrink-0 mr-2 pointer-events-none transition-colors",
            hasActiveQuery ? "text-primary" : "text-muted-foreground"
          )}
        />

        {/* Scoped Filter Chip: Shows current selection with an [x] to remove */}
        {isFilteredBySection && (
          <Badge
            variant="secondary"
            className="mr-2 py-0.5 px-2 text-xs font-semibold bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 flex items-center gap-1.5 select-none shrink-0 cursor-pointer active:scale-95 transition-all"
            onClick={onClearStatusFilter}
            title={`Filtered by current selection: ${statusFilter}. Click to clear filter and search all sections.`}
          >
            <Filter className="h-3 w-3" />
            <span>{statusFilter}</span>
            <span
              role="button"
              tabIndex={0}
              aria-label={`Remove ${statusFilter} filter`}
              className="rounded-full p-0.5 hover:bg-primary/20 hover:text-destructive"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClearStatusFilter();
                }
              }}
            >
              <X className="h-3 w-3" />
            </span>
          </Badge>
        )}

        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={
            isFilteredBySection
              ? `Search in ${statusFilter} (and other sections)...`
              : "Search plants by name, species, notes, conditions..."
          }
          className="flex-1 bg-transparent py-2 text-sm outline-hidden placeholder:text-muted-foreground/70 min-w-0"
          aria-label="Search plants in garden"
        />

        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {hasActiveQuery ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-6 px-2 text-xs font-semibold rounded-full gap-1 bg-muted/80 hover:bg-destructive hover:text-destructive-foreground text-foreground transition-all shadow-2xs active:scale-95"
              onClick={() => {
                onSearchChange('');
                inputRef.current?.focus();
              }}
              title="Exit search view (Esc)"
              aria-label="Exit search view"
            >
              <span>Exit</span>
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted/60 px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-70">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* When search is active, show the match summary with cross-section highlights */}
      {hasActiveQuery && (
        <div className="flex items-center justify-between text-xs px-1 flex-wrap gap-2 text-muted-foreground">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">
              Results for &ldquo;{searchQuery}&rdquo;:
            </span>

            {isFilteredBySection ? (
              <>
                <Badge variant="secondary" className="font-mono text-[11px] px-2 py-0">
                  {currentSectionMatchesCount} in {statusFilter}
                </Badge>
                {otherSectionMatchesCount > 0 && (
                  <Badge variant="outline" className="font-mono text-[11px] px-2 py-0 text-primary border-primary/40 flex items-center gap-1 bg-primary/5">
                    <Layers className="h-3 w-3" />
                    <span>+{otherSectionMatchesCount} in other sections</span>
                  </Badge>
                )}
                {otherGardenMatchesCount > 0 && (
                  <Badge variant="outline" className="font-mono text-[11px] px-2 py-0 text-muted-foreground">
                    +{otherGardenMatchesCount} in other gardens
                  </Badge>
                )}
              </>
            ) : (
              <Badge variant="secondary" className="font-mono text-[11px] px-2 py-0">
                {totalMatches} matching across all sections
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isFilteredBySection && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2 text-primary hover:text-primary hover:bg-primary/10 gap-1"
                onClick={onClearStatusFilter}
              >
                <span>Search all sections</span>
                <X className="h-3 w-3" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
              onClick={() => onSearchChange('')}
            >
              Clear search
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
