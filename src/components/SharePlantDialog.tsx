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
  Info,
  Sprout,
  Network,
  ThumbsUp,
  AlertTriangle,
} from 'lucide-react';
import { buildShareableSeedPackUrl } from '@/lib/seed-pack';
import { getPlantGuildStatus } from '@/extensions/companion-guild/rules';
import { getPlantSurplus } from '@/extensions/surplus-seed-swap';
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
  otherPlantings?: PlantingWithPlant[];
};

const statusConfig: { [key: string]: string } = {
  Wishlist: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
  Planting: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800',
  Growing: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
  Harvest: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800',
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
  otherPlantings,
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

  // 1. Current lifecycle status (from planting history)
  const status =
    planting.history && planting.history.length > 0
      ? planting.history[planting.history.length - 1].status
      : 'Wishlist';

  // 2. Upcoming viability summary
  const upcomingSummary = effectiveUpcomingTiming
    ? `${effectiveUpcomingViability || 'High'} in ${effectiveUpcomingTiming}`
    : undefined;

  // 3. Surplus seed swap availability (using surplus-seed-swap extension)
  const { surplus: surplusSeeds, isAvailable: isSwapAvailable } = useMemo(
    () => getPlantSurplus(planting),
    [planting]
  );
  const surplusSummary = surplusSeeds > 0
    ? `${surplusSeeds} Seeds for Swap`
    : isSwapAvailable
    ? 'Seeds for Swap'
    : undefined;

  // 4. Companion Guild status (using companion-guild extension)
  const guildStatus = useMemo(() => {
    return getPlantGuildStatus(
      planting.name,
      planting.plant.species,
      otherPlantings?.map((p) => ({ name: p.name, species: p.plant?.species }))
    );
  }, [planting.name, planting.plant.species, otherPlantings]);

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
          swapAvailable: isSwapAvailable,
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
    if (status) params.set('status', status);
    if (upcomingSummary) params.set('upcoming', upcomingSummary);
    if (surplusSummary) params.set('surplus', surplusSummary);
    if (guildStatus.badgeLabel) params.set('guild', guildStatus.badgeLabel);
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
    status,
    upcomingSummary,
    surplusSummary,
    guildStatus.badgeLabel,
    isSwapAvailable,
  ]);

  // Formatted text card emphasizing garden viability, status, upcoming window, guild and seed swap
  const shareSummaryText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`🌱 ${planting.name} (${planting.plant.species})`);
    lines.push(`🏡 Garden: ${gardenName}${effectiveSeason ? ` • ${effectiveSeason}` : ''}`);

    if (effectiveViability) {
      lines.push(`✨ Current Viability: ${effectiveViability} Viability`);
    }
    lines.push(`🌱 Lifecycle Status: ${status}`);

    if (upcomingSummary) {
      lines.push(
        `📈 Upcoming Viability: ↑ ${upcomingSummary}${
          effectiveUpcomingReasoning ? ` (${effectiveUpcomingReasoning})` : ''
        }`
      );
    }

    if (guildStatus.summaryText) {
      lines.push(`🌿 Companion Guild: ${guildStatus.summaryText}`);
    }

    if (isSwapAvailable) {
      lines.push(
        `🤝 Seed Swap: ${
          surplusSeeds > 0
            ? `${surplusSeeds} Surplus Seeds available for local swap!`
            : 'Seeds available for local swap!'
        }`
      );
    }

    if (effectiveReasoning) {
      lines.push(`📋 Assessment: "${effectiveReasoning}"`);
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

    lines.push(`\n🔗 View plant & import seed pack in Grow:\n${shareUrl}`);
    return lines.join('\n');
  }, [
    planting,
    gardenName,
    effectiveSeason,
    effectiveViability,
    status,
    upcomingSummary,
    effectiveUpcomingReasoning,
    guildStatus.summaryText,
    isSwapAvailable,
    surplusSeeds,
    effectiveReasoning,
    gardenLocation.conditions,
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

  const handleFacebookShare = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareSummaryText);
      }
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 3000);
    } catch {
      // ignore
    }
    toast({
      title: '📋 Viability Summary Copied to Clipboard!',
      description: 'Facebook link cards often hide descriptions in feeds. Paste (Ctrl+V / Cmd+V) into your post to include the full garden assessment!',
      duration: 6000,
    });
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

        {/* Plant Card Preview — Styled consistently with Grow's PlantCard */}
        <div className="rounded-lg border bg-card text-card-foreground p-4 space-y-3 shadow-sm">
          {/* Header row: Garden Name & Season */}
          <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-border/40">
            <div className="flex items-center gap-1.5 min-w-0">
              <Fence className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-sm truncate">{gardenName}</span>
              {effectiveSeason && (
                <Badge variant="outline" className="text-[11px] py-0 px-1.5 h-4 font-normal">
                  {effectiveSeason}
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">Grow Seed Pack</span>
          </div>

          {/* Plant Name & Species */}
          <div>
            <h3 className="font-headline text-xl leading-tight font-semibold text-foreground">
              {planting.name}
            </h3>
            <p className="text-xs text-muted-foreground italic pt-0.5">
              {planting.plant.species}
            </p>
          </div>

          {/* Badges Row — Matching app's PlantCard & ViabilityIndicator exactly */}
          <div className="flex flex-wrap gap-2 items-center pt-1">
            {/* Viability Badge */}
            {effectiveViability ? (
              <Badge
                variant="outline"
                className={cn(
                  'font-normal text-xs px-2 py-0.5 flex items-center gap-1 shadow-sm select-none',
                  effectiveViability === 'High' &&
                    'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
                  effectiveViability === 'Medium' &&
                    'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800',
                  effectiveViability === 'Low' &&
                    'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800'
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

            {/* Upcoming Outlook Badge (dashed border like ViabilityIndicator.tsx) */}
            {effectiveUpcomingTiming && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[11px] font-medium flex items-center gap-1 select-none border-dashed',
                  effectiveUpcomingViability === 'High'
                    ? 'bg-green-50 text-green-700 border-green-400 dark:bg-green-950/40 dark:text-green-300 dark:border-green-700'
                    : 'bg-yellow-50 text-yellow-700 border-yellow-400 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-700'
                )}
              >
                <TrendingUp className="h-3 w-3 shrink-0" />
                <span>↑ {effectiveUpcomingViability || 'High'} ({effectiveUpcomingTiming})</span>
              </Badge>
            )}

            {/* Lifecycle Status Badge (matching PlantCard.tsx statusConfig) */}
            <Badge
              variant="outline"
              className={cn('font-normal text-xs', statusConfig[status] || statusConfig.Wishlist)}
            >
              {status}
            </Badge>

            {/* Seed Swap Surplus Badge (matching surplus-seed-swap extension) */}
            {isSwapAvailable && (
              <Badge variant="secondary" className="flex items-center gap-1.5 text-xs font-normal">
                <Sprout className="h-3 w-3 text-primary" />
                <span>{surplusSeeds > 0 ? `${surplusSeeds} seeds for swap` : 'Seed swap available'}</span>
              </Badge>
            )}

            {/* Companion Guild Badge (matching companion-guild extension) */}
            {guildStatus.badgeLabel && (
              <Badge
                variant={guildStatus.activeSynergies.length > 0 ? 'default' : 'secondary'}
                className="flex items-center gap-1.5 text-xs font-normal"
              >
                {guildStatus.activeSynergies.length > 0 ? (
                  <ThumbsUp className="h-3 w-3" />
                ) : (
                  <Network className="h-3 w-3" />
                )}
                <span>{guildStatus.badgeLabel}</span>
              </Badge>
            )}
          </div>

          {/* Viability Reasoning Callout Box */}
          {effectiveReasoning ? (
            <div className="rounded-md bg-muted/50 border border-border p-2.5 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>Viability Assessment:</span>
              </div>
              <p className="text-muted-foreground leading-relaxed pl-5">
                "{effectiveReasoning}"
              </p>
            </div>
          ) : (
            <div className="rounded-md bg-muted/30 border border-dashed border-border p-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
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

          {/* Companion Guild Synergies Detail (if detected) */}
          {guildStatus.summaryText && (
            <div className="flex items-start gap-2 text-xs bg-muted/40 border border-border/70 rounded-md p-2.5">
              <Network className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-foreground">
                  Companion &amp; Guild Matrix
                </span>
                <p className="text-[11px] text-muted-foreground">
                  {guildStatus.summaryText}
                </p>
              </div>
            </div>
          )}

          {/* Garden microclimate condition badges */}
          {gardenLocation.conditions && (
            <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] text-muted-foreground">
              {gardenLocation.conditions.temperature && (
                <div className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded border border-border/50">
                  <Thermometer className="h-3 w-3 text-primary/70 shrink-0" />
                  <span>{gardenLocation.conditions.temperature}</span>
                </div>
              )}
              {gardenLocation.conditions.sunlight && (
                <div className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded border border-border/50">
                  <Sun className="h-3 w-3 text-amber-500 shrink-0" />
                  <span>{gardenLocation.conditions.sunlight}</span>
                </div>
              )}
              {gardenLocation.conditions.soil && (
                <div className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded border border-border/50">
                  <Layers className="h-3 w-3 text-primary/70 shrink-0" />
                  <span>{gardenLocation.conditions.soil}</span>
                </div>
              )}
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

        {/* Facebook tip callout */}
        <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-md p-2.5 border border-muted">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>
            <strong>Sharing to Facebook:</strong> Facebook often hides link descriptions in mobile feeds. When you click <strong>Facebook</strong>, your complete garden viability assessment is automatically copied to your clipboard so you can easily <strong>paste (Ctrl+V)</strong> it into your post!
          </span>
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
