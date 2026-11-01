'use client';

import React, { useMemo, useState } from 'react';
import type { GrowExtension, ExtensionContext } from '../registry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Sprout, Share2, Check } from 'lucide-react';
import { buildShareableSeedPackUrl } from '@/lib/seed-pack';
import { useToast } from '@/hooks/use-toast';

export function getPlantSurplus(planting: { seedsOnHand?: number; plannedQty?: number; swapAvailable?: boolean }): { surplus: number; isAvailable: boolean } {
  const onHand = planting.seedsOnHand ?? 0;
  const planned = planting.plannedQty ?? 0;
  const surplus = Math.max(0, onHand - planned);
  const isAvailable = Boolean(planting.swapAvailable || surplus > 0);
  return { surplus, isAvailable };
}

function SurplusSeedSwapWidget({ plantings, activeLocation }: ExtensionContext) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const surplusItems = useMemo(() => {
    return plantings
      .map((p) => {
        const onHand = p.seedsOnHand ?? 0;
        const planned = p.plannedQty ?? 0;
        const surplus = Math.max(0, onHand - planned);
        return { planting: p, surplus };
      })
      .filter((item) => item.surplus > 0 || item.planting.swapAvailable);
  }, [plantings]);

  const handleShareSurplusPack = async () => {
    if (surplusItems.length === 0) return;
    const uniquePlants = Array.from(
      new Map(surplusItems.map((i) => [i.planting.plant.id, i.planting.plant])).values()
    );
    const url = buildShareableSeedPackUrl({
      locations: activeLocation ? [activeLocation] : [],
      plants: uniquePlants,
      plantings: surplusItems.map((i) => ({
        id: i.planting.id,
        plantId: i.planting.plantId,
        gardenId: i.planting.gardenId,
        name: `${i.planting.name} (Seed Swap)`,
        createdAt: new Date().toISOString(),
        seedsOnHand: i.surplus ?? 0,
        plannedQty: 0,
        swapAvailable: true,
        history: [
          {
            id: `swap-${Date.now()}`,
            status: 'Wishlist',
            date: new Date().toISOString(),
            notes: `Shared via Local Seed Swap (${i.surplus} surplus seeds available).`,
          },
        ],
      })),
    });

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast({
      title: 'Seed Swap Pack Link Copied!',
      description: 'Share this link in your local gardening group or P2P room—recipients can merge it in 1 click.',
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sprout className="h-4 w-4 text-primary" />
          <span>Seed Swap</span>
          {surplusItems.length > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              {surplusItems.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2">
            <Sprout className="h-5 w-5 text-primary" />
            Local Surplus Seed Swap
          </DialogTitle>
          <DialogDescription>
            Automatically calculated from your plants where{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">seedsOnHand &gt; plannedQty</code>.
          </DialogDescription>
        </DialogHeader>

        {surplusItems.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground border border-dashed rounded-md">
            No surplus seeds detected yet. Edit any plant and set{' '}
            <strong>Seeds on Hand</strong> higher than <strong>Planned Qty</strong> to list surplus for swapping!
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {surplusItems.map(({ planting, surplus }) => (
              <div
                key={planting.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <div>
                  <div className="font-medium">{planting.name}</div>
                  <div className="text-xs text-muted-foreground">{planting.plant.species}</div>
                </div>
                <Badge variant="default">
                  {surplus > 0 ? `+${surplus} surplus` : 'Swap Ready'}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleShareSurplusPack}
            disabled={surplusItems.length === 0}
            className="w-full gap-2"
          >
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {copied ? 'Copied 1-Click Seed Swap Link!' : 'Copy Shareable Seed Swap Pack Link'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const surplusSeedSwapExtension: GrowExtension = {
  id: 'surplus-seed-swap',
  name: 'Surplus Seed Swap',
  description: 'Detects extra seeds (seedsOnHand > plannedQty) and generates a 1-click P2P Seed Swap pack.',
  version: '1.0.0',
  slots: ['dashboard-toolbar', 'plant-card-badge'],
  contributor: {
    name: 'Grow Core Community',
    githubOrNostr: 'creat-o-r',
    url: 'https://github.com/creat-o-r/grow',
  },
  DashboardWidget: SurplusSeedSwapWidget,
  PlantCardBadge: ({ planting }) => {
    const surplus = Math.max(0, (planting.seedsOnHand ?? 0) - (planting.plannedQty ?? 0));
    if (surplus <= 0 && !planting.swapAvailable) return null;
    return (
      <Badge variant="outline" className="text-[11px] border-primary/40 text-primary gap-1">
        <Sprout className="h-3 w-3" />
        {surplus > 0 ? `${surplus} Swap Surplus` : 'Swap Ready'}
      </Badge>
    );
  },
};
