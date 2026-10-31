'use client';

import React, { useState, useEffect } from 'react';
import { type ExtensionContext } from './registry';
import { useExtensions } from './use-extensions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  GitFork,
  Share2,
  Radio,
  Check,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import {
  buildShareableSeedPackUrl,
  buildGitHubContributeDatasetUrl,
} from '@/lib/seed-pack';
import {
  broadcastGardenToP2PRoom,
  subscribeToP2PGardenRoom,
  getStoredCommunitySignals,
  getOrCreateGrowerIdentity,
} from '@/lib/p2p-signals';
import { useToast } from '@/hooks/use-toast';
import type { CommunityViabilitySignal } from '@/lib/types';

export function ExtensionSlotBar(props: ExtensionContext) {
  const { getBySlot } = useExtensions();
  const toolbarExtensions = getBySlot('dashboard-toolbar');
  const { toast } = useToast();

  const [packTitle, setPackTitle] = useState(
    props.activeLocation?.name || 'My Microclimate Seed Pack'
  );
  const [copiedPack, setCopiedPack] = useState(false);
  const [p2pRoomId, setP2pRoomId] = useState('');
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [signals, setSignals] = useState<CommunityViabilitySignal[]>([]);

  useEffect(() => {
    if (props.activeLocation?.name) {
      setPackTitle(props.activeLocation.name);
    }
  }, [props.activeLocation?.name]);

  useEffect(() => {
    setSignals(getStoredCommunitySignals());
  }, [props.plantings]);

  useEffect(() => {
    if (!activeRoom) return;
    const unsubscribe = subscribeToP2PGardenRoom(activeRoom, (_ds, peerName) => {
      toast({
        title: `P2P Sync from ${peerName}`,
        description: `Merged incoming plants from room "${activeRoom}" without overwriting your garden.`,
      });
    });
    return unsubscribe;
  }, [activeRoom, toast]);

  const currentGardenDataset = {
    locations: props.activeLocation ? [props.activeLocation] : [],
    plants: props.plants,
    plantings: props.plantings.map(({ plant: _p, garden: _g, ...rest }) => rest),
    contributor: {
      name: getOrCreateGrowerIdentity().displayName,
    },
  };

  const handleCopySeedPackUrl = async () => {
    const url = buildShareableSeedPackUrl(currentGardenDataset);
    await navigator.clipboard.writeText(url);
    setCopiedPack(true);
    setTimeout(() => setCopiedPack(false), 2500);
    toast({
      title: '1-Click Forkable Seed Pack Link Copied!',
      description:
        'Anyone opening this link can safely merge your plants & microclimate into their local Grow instance.',
    });
  };

  const handleOpenGitHubPr = () => {
    const prUrl = buildGitHubContributeDatasetUrl(currentGardenDataset, packTitle);
    window.open(prUrl, '_blank', 'noopener,noreferrer');
  };

  const handleJoinAndBroadcastP2P = () => {
    const cleanRoom = p2pRoomId.trim();
    if (!cleanRoom) return;
    setActiveRoom(cleanRoom);
    broadcastGardenToP2PRoom(cleanRoom, currentGardenDataset);
    toast({
      title: `Joined P2P Room: ${cleanRoom}`,
      description: 'Broadcasted your current garden snapshot to connected peers.',
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      {/* P0: 1-Click Share & Fork Seed Pack */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <GitFork className="h-4 w-4 text-primary" />
            <span>Fork / Share Pack</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline flex items-center gap-2">
              <GitFork className="h-5 w-5 text-primary" />
              Share or Crowd-Contribute Seed Pack
            </DialogTitle>
            <DialogDescription>
              Create a 1-click non-destructive merge link for friends, or contribute this microclimate pack to the upstream repository.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="seed-pack-title">Seed Pack Name</Label>
              <Input
                id="seed-pack-title"
                value={packTitle}
                onChange={(e) => setPackTitle(e.target.value)}
                placeholder="e.g., Auckland Subtropical Spring Pack"
              />
            </div>

            <div className="rounded-md bg-muted p-3 text-xs space-y-1 text-muted-foreground">
              <div>
                <strong>Included:</strong> {props.plants.length} species &bull;{' '}
                {props.plantings.length} plantings
              </div>
              <div>
                <strong>Safe Merge:</strong> Recipients merge new species into their local IndexedDB without overwriting their existing garden.
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={handleCopySeedPackUrl} className="w-full gap-2">
                {copiedPack ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                {copiedPack ? 'Copied ?pack= Link!' : 'Copy 1-Click Shareable Link'}
              </Button>
              <Button
                onClick={handleOpenGitHubPr}
                variant="outline"
                className="w-full gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Contribute Pack to GitHub (1-Click PR)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* P4: P2P Room & Crowd Signals */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <span>P2P & Signals</span>
            {(activeRoom || signals.length > 0) && (
              <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                {activeRoom ? 'Live' : signals.length}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              P2P Garden Room & Crowd Viability Signals
            </DialogTitle>
            <DialogDescription>
              Sync directly with co-op garden peers ($0 server cost) and inspect local ground-truth viability signals.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2 rounded-lg border p-3">
              <Label htmlFor="p2p-room-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Live P2P Co-Op Room
              </Label>
              <div className="flex gap-2">
                <Input
                  id="p2p-room-input"
                  placeholder="e.g., auckland-community-bed-4"
                  value={p2pRoomId}
                  onChange={(e) => setP2pRoomId(e.target.value)}
                />
                <Button onClick={handleJoinAndBroadcastP2P} disabled={!p2pRoomId.trim()}>
                  {activeRoom ? 'Sync Again' : 'Join & Sync'}
                </Button>
              </div>
              {activeRoom && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Connected to room{' '}
                  <strong>{activeRoom}</strong>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent Crowd Viability Proofs ({signals.length})
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Rate AI logs or log Harvests to broadcast
                </span>
              </div>
              {signals.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No local viability signals broadcasted yet. Mark a plant as <strong>Harvest</strong> or rate an AI Viability check in the <strong>AI Log Panel</strong> to publish your first microclimate proof!
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {signals.slice(0, 10).map((sig) => (
                    <div
                      key={sig.id}
                      className="rounded-md border p-2.5 text-xs flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-semibold">{sig.species}</div>
                        <div className="text-muted-foreground">
                          {sig.region} &bull; {sig.season || 'All Seasons'} &bull; by{' '}
                          {sig.authorName}
                        </div>
                      </div>
                      <Badge
                        variant={
                          sig.verdict === 'way-off' ? 'destructive' : 'default'
                        }
                      >
                        {sig.verdict === 'harvest-verified'
                          ? 'Harvest Verified'
                          : sig.verdict === 'spot-on'
                          ? 'AI Spot-On'
                          : 'AI Corrected'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* P1: Crowd-Developed Extensions Slot */}
      {toolbarExtensions.map((ext) => {
        const Widget = ext.DashboardWidget;
        return Widget ? <Widget key={ext.id} {...props} /> : null;
      })}
    </div>
  );
}
