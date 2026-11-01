'use client';

import { useState, useMemo } from 'react';
import type { PlantingWithPlant, GardenLocation, AiDataset } from '@/lib/types';
import type { Viability } from '@/lib/viability';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Share2,
  Copy,
  Check,
  Sparkles,
  Fence,
  TrendingUp,
  Thermometer,
  Sun,
  Layers,
  Calendar,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { buildShareableSeedPackUrl } from '@/lib/seed-pack';
import { cn } from '@/lib/utils';

export type SharePlantDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  planting: PlantingWithPlant;
  viability?: Viability;
  viabilityReasoning?: string;
  upcomingViability?: 'High' | 'Medium';
  upcomingTiming?: string;
  upcomingReasoning?: string;
  currentSeason?: string;
  onGetViability?: () => void;
};

export function SharePlantDialog({
  isOpen,
  onOpenChange,
  planting,
  viability,
  viabilityReasoning,
  upcomingViability,
  upcomingTiming,
  upcomingReasoning,
  currentSeason,
  onGetViability,
}: SharePlantDialogProps) {
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const gardenLocation: GardenLocation = planting.garden || {
    id: planting.gardenId || 'default-garden',
    name: 'My Garden',
    location: 'Local Microclimate',
    temperatureUnit: 'C',
    conditions: {
      temperature: 'Ambient',
      sunlight: 'Full Sun',
      soil: 'Rich Loam',
      currentSeason: (currentSeason as any) || 'Summer',
    },
  };

  const effectiveViability = viability || planting.viability;
  const effectiveReasoning = viabilityReasoning || planting.viabilityReasoning;
  const effectiveUpcomingViability = upcomingViability || planting.upcomingViability;
  const effectiveUpcomingTiming = upcomingTiming || planting.upcomingTiming;
  const effectiveUpcomingReasoning = upcomingReasoning || planting.upcomingReasoning;
  const effectiveSeason = currentSeason || gardenLocation.conditions?.currentSeason;
  const gardenName = gardenLocation.name || 'My Garden';

  // Build the 1-click self-contained ?pack= URL containing the plant, planting, garden and viability
  const shareUrl = useMemo(() => {
    const singlePlantDataset: AiDataset = {
      plants: [planting.plant],
      plantings: [
        {
          id: planting.id,
          uid: planting.uid,
          plantId: planting.plantId,
          gardenId: gardenLocation.id,
          name: planting.name,
          createdAt: planting.createdAt || new Date().toISOString(),
          history: planting.history || [],
          seedsOnHand: planting.seedsOnHand,
          plannedQty: planting.plannedQty,
          viability: effectiveViability,
          viabilityReasoning: effectiveReasoning,
          viabilityAssessedAt: planting.viabilityAssessedAt || new Date().toISOString(),
          upcomingViability: effectiveUpcomingViability,
          upcomingTiming: effectiveUpcomingTiming,
          upcomingReasoning: effectiveUpcomingReasoning,
        },
      ],
      locations: [gardenLocation],
      contributor: {
        name: gardenName ? `${gardenName} Grower` : 'Grow Gardener',
      },
    };
    const baseUrl = buildShareableSeedPackUrl(singlePlantDataset);
    const params = new URLSearchParams();
    if (planting.name) params.set('name', planting.name);
    if (effectiveViability) params.set('viability', effectiveViability);
    if (gardenName) params.set('garden', gardenName);
    const queryStr = params.toString();
    return queryStr ? `${baseUrl}&${queryStr}` : baseUrl;
  }, [
    planting,
    gardenLocation,
    effectiveViability,
    effectiveReasoning,
    effectiveUpcomingViability,
    effectiveUpcomingTiming,
    effectiveUpcomingReasoning,
    gardenName,
  ]);

  // Formatted text card emphasizing garden viability
  const shareSummaryText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`🌱 ${planting.name} (${planting.plant.species})`);
    lines.push(`🏡 Garden: ${gardenName}${effectiveSeason ? ` • ${effectiveSeason}` : ''}`);

    if (effectiveViability) {
      lines.push(`✨ Viability in My Garden: ${effectiveViability} Viability`);
    }
    if (effectiveReasoning) {
      lines.push(`📋 Viability Assessment: "${effectiveReasoning}"`);
    }
    if (gardenLocation.conditions) {
      const c = gardenLocation.conditions;
      const condList = [
        c.temperature ? `Temp: ${c.temperature}` : null,
        c.sunlight ? `Sun: ${c.sunlight}` : null,
        c.soil ? `Soil: ${c.soil}` : null,
      ]
        .filter(Boolean)
        .join(' | ');
      if (condList) {
        lines.push(`☀️ Microclimate Conditions: ${condList}`);
      }
    }
    if (effectiveUpcomingTiming) {
      lines.push(
        `📈 Upcoming Outlook: ${effectiveUpcomingViability || 'High'} in ${effectiveUpcomingTiming}${
          effectiveUpcomingReasoning ? ` (${effectiveUpcomingReasoning})` : ''
        }`
      );
    }
    lines.push(`\n🔗 View & import into your garden in Grow:\n${shareUrl}`);
    return lines.join('\n');
  }, [
    planting,
    gardenName,
    effectiveSeason,
    effectiveViability,
    effectiveReasoning,
    gardenLocation.conditions,
    effectiveUpcomingTiming,
    effectiveUpcomingViability,
    effectiveUpcomingReasoning,
    shareUrl,
  ]);

  const handleCopyLink = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast({
        title: 'Share Link Copied',
        description: `Share link for ${planting.name} (${effectiveViability || 'Assessed'} in ${gardenName}) copied to clipboard.`,
      });
    } catch {
      toast({
        title: 'Copy Failed',
        description: 'Please manually copy the link from the input field.',
        variant: 'destructive',
      });
    }
  };

  const handleCopySummary = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareSummaryText);
      }
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
      toast({
        title: 'Plant Card Summary Copied',
        description: 'Formatted plant summary with garden viability ready to paste anywhere.',
      });
    } catch {
      toast({
        title: 'Copy Failed',
        description: 'Please copy the link directly.',
        variant: 'destructive',
      });
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${planting.name} — ${effectiveViability || 'Viability'} in ${gardenName}`,
          text: shareSummaryText,
          url: shareUrl,
        });
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleFacebookShare = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    if (typeof window !== 'undefined') {
      window.open(fbUrl, '_blank', 'width=626,height=436,noopener,noreferrer');
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader className="text-left space-y-1">
          <DialogTitle className="flex items-center gap-2 text-xl font-headline">
            <Share2 className="h-5 w-5 text-primary shrink-0" />
            <span>Share My Plant</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Share <strong>{planting.name}</strong> along with its viability analysis and growing microclimate in your garden.
          </DialogDescription>
        </DialogHeader>

        {/* Viability in My Garden - Highlighted Section */}
        <div
          className={cn(
            'rounded-lg border p-4 space-y-3 transition-colors',
            effectiveViability === 'High' &&
              'bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-950/20 dark:border-emerald-800/50',
            effectiveViability === 'Medium' &&
              'bg-amber-500/10 border-amber-500/30 dark:bg-amber-950/20 dark:border-amber-800/50',
            effectiveViability === 'Low' &&
              'bg-rose-500/10 border-rose-500/30 dark:bg-rose-950/20 dark:border-rose-800/50',
            !effectiveViability && 'bg-muted/40 border-border'
          )}
        >
          {/* Header row: Garden Name & Viability Badge */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 min-w-0">
              <Fence className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-sm truncate">{gardenName}</span>
              {effectiveSeason && (
                <Badge variant="outline" className="text-[11px] py-0 px-1.5 h-4 font-normal">
                  {effectiveSeason}
                </Badge>
              )}
            </div>

            {effectiveViability ? (
              <Badge
                variant="outline"
                className={cn(
                  'font-medium text-xs px-2 py-0.5 flex items-center gap-1 shadow-sm',
                  effectiveViability === 'High' &&
                    'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-700',
                  effectiveViability === 'Medium' &&
                    'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700',
                  effectiveViability === 'Low' &&
                    'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/60 dark:text-rose-300 dark:border-rose-700'
                )}
              >
                <Sparkles className="h-3 w-3" />
                <span>{effectiveViability} Viability</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                Unassessed
              </Badge>
            )}
          </div>

          {/* Viability Reasoning Callout */}
          {effectiveReasoning ? (
            <div className="rounded-md bg-background/80 border border-border/60 p-2.5 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>Viability in this Garden:</span>
              </div>
              <p className="text-muted-foreground leading-relaxed pl-5">
                "{effectiveReasoning}"
              </p>
            </div>
          ) : (
            <div className="rounded-md bg-background/60 border border-dashed border-border/70 p-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-muted-foreground">
                Viability has not been analyzed for this garden yet.
              </span>
              {onGetViability && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 shrink-0"
                  onClick={() => {
                    onGetViability();
                    onOpenChange(false);
                  }}
                >
                  <Sparkles className="h-3 w-3 text-primary" />
                  Run Analysis
                </Button>
              )}
            </div>
          )}

          {/* Garden microclimate condition badges */}
          {gardenLocation.conditions && (
            <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] text-muted-foreground">
              {gardenLocation.conditions.temperature && (
                <div className="flex items-center gap-1 bg-background/60 px-2 py-0.5 rounded border border-border/50">
                  <Thermometer className="h-3 w-3 text-primary/70 shrink-0" />
                  <span>{gardenLocation.conditions.temperature}</span>
                </div>
              )}
              {gardenLocation.conditions.sunlight && (
                <div className="flex items-center gap-1 bg-background/60 px-2 py-0.5 rounded border border-border/50">
                  <Sun className="h-3 w-3 text-amber-500 shrink-0" />
                  <span>{gardenLocation.conditions.sunlight}</span>
                </div>
              )}
              {gardenLocation.conditions.soil && (
                <div className="flex items-center gap-1 bg-background/60 px-2 py-0.5 rounded border border-border/50">
                  <Layers className="h-3 w-3 text-primary/70 shrink-0" />
                  <span>{gardenLocation.conditions.soil}</span>
                </div>
              )}
            </div>
          )}

          {/* Upcoming seasonal window */}
          {effectiveUpcomingTiming && (
            <div className="flex items-center gap-1.5 text-xs text-foreground/80 pt-1 font-medium">
              <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                Upcoming Window: <strong>{effectiveUpcomingViability || 'High'}</strong> in{' '}
                <strong>{effectiveUpcomingTiming}</strong>
                {effectiveUpcomingReasoning ? ` (${effectiveUpcomingReasoning})` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Shareable Link Input Section */}
        <div className="space-y-2 pt-1">
          <div className="flex items-baseline justify-between gap-2">
            <Label className="text-xs font-semibold">Share My Plant Link</Label>
            <span className="text-[11px] text-muted-foreground">Self-contained &amp; zero-server</span>
          </div>

          <div className="flex gap-2">
            <Input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
              className="font-mono text-xs select-all bg-muted/40 h-9"
            />
            <Button
              type="button"
              onClick={handleCopyLink}
              size="sm"
              className="h-9 px-3 gap-1.5 shrink-0"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Anyone opening this link can view this plant with its viability insights and import it directly into their own garden.
          </p>
        </div>

        {/* Footer actions */}
        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopySummary}
            className="text-xs gap-1.5 h-8 flex-1 sm:flex-initial"
          >
            {copiedSummary ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Summary Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Summary Text</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFacebookShare}
            className="text-xs gap-1.5 h-8 flex-1 sm:flex-initial text-[#1877F2] hover:text-[#1877F2] hover:bg-[#1877F2]/10 border-[#1877F2]/30"
            title="Share to Facebook with full plant viability preview card"
          >
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span>Facebook</span>
          </Button>

          {canNativeShare && (
            <Button
              type="button"
              size="sm"
              onClick={handleNativeShare}
              className="text-xs gap-1.5 h-8 flex-1 sm:flex-initial"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Share via Device...</span>
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8 sm:ml-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
