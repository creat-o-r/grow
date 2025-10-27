
'use client';

import { useMemo } from 'react';
import type { Plant, Conditions } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { analyzeViability, Viability } from '@/lib/viability';


export function ViabilityIndicator({ viability }: { viability: Viability }) {
  const viabilityConfig = {
    High: { text: 'High Viability', className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800' },
    Medium: { text: 'Medium Viability', className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800' },
    Low: { text: 'Low Viability', className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800' },
  };

  const config = viabilityConfig[viability];

  if (!config) {
    return null; // Don't render anything if viability is not calculated yet
  }

  return (
    <Badge variant="outline" className={cn("font-normal", config.className)}>
      {config.text}
    </Badge>
  );
}
