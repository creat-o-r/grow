
'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Viability } from '@/lib/viability';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sparkles, Info } from 'lucide-react';

type ViabilityIndicatorProps = {
  viability: Viability;
  reasoning?: string;
  plantName?: string;
  gardenName?: string;
};

export function ViabilityIndicator({ 
  viability, 
  reasoning, 
  plantName, 
  gardenName 
}: ViabilityIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const viabilityConfig: Record<Viability, { text: string; className: string; borderClass: string }> = {
    High: { 
      text: 'High Viability', 
      className: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800 hover:bg-green-200 dark:hover:bg-green-900/70',
      borderClass: 'border-green-500/30'
    },
    Medium: { 
      text: 'Medium Viability', 
      className: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-900/70',
      borderClass: 'border-yellow-500/30'
    },
    Low: { 
      text: 'Low Viability', 
      className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/70',
      borderClass: 'border-red-500/30'
    },
  };

  const config = viabilityConfig[viability];

  if (!config) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(prev => !prev);
          }}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          className="focus:outline-none focus:ring-1 focus:ring-primary rounded"
          title="Click or hover to view AI reasoning"
        >
          <Badge 
            variant="outline" 
            className={cn("font-normal cursor-pointer transition-colors flex items-center gap-1 select-none", config.className)}
          >
            <span>{config.text}</span>
            <Info className="h-3 w-3 opacity-60 ml-0.5" />
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className={cn("w-80 sm:w-96 p-4 text-sm z-50 shadow-xl space-y-2.5 bg-popover text-popover-foreground", config.borderClass)}
        side="top"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <div className="flex items-center gap-1.5 font-semibold text-xs">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>AI Viability Analysis</span>
          </div>
          <Badge variant="outline" className={cn("text-xs font-normal", config.className)}>
            {viability}
          </Badge>
        </div>

        {plantName && (
          <p className="font-medium text-xs text-foreground/90">
            {plantName} {gardenName ? <span className="text-muted-foreground font-normal">({gardenName})</span> : ''}
          </p>
        )}

        <div className="text-xs text-muted-foreground whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed pr-1 font-sans">
          {reasoning ? reasoning : "No detailed reasoning saved for this plant yet. Click 'Viability Analysis' in the plant menu to generate a fresh assessment."}
        </div>
      </PopoverContent>
    </Popover>
  );
}
