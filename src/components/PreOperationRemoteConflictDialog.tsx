'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DiscrepancyItemUpdated } from '@/lib/sync-diff';
import { AlertTriangle, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';

export interface PreOperationRemoteConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  update: DiscrepancyItemUpdated | null;
  operationLabel?: string;
  onSyncRemoteFirst: () => void | Promise<void>;
  onProceedAnyway: () => void | Promise<void>;
}

export function PreOperationRemoteConflictDialog({
  open,
  onOpenChange,
  update,
  operationLabel = 'this operation',
  onSyncRemoteFirst,
  onProceedAnyway,
}: PreOperationRemoteConflictDialogProps) {
  if (!update) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg z-50">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-base">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle>Remote Update Detected Before Operation</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Another device (@<span className="font-semibold text-foreground">{update.peerHandle || 'another-device'}</span>) recently updated this planting.
            Operating now without syncing may overwrite remote changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="p-3 rounded-lg border border-border/60 bg-muted/30 space-y-2">
            <div className="flex items-center justify-between font-semibold text-sm">
              <span>{update.plantName}</span>
              <span className="text-muted-foreground text-xs font-normal">({update.species})</span>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-border/40">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Changes on Other Device:
              </span>

              {update.stageChanged && (
                <div className="flex items-center justify-between p-1.5 rounded bg-background/60 border border-border/40">
                  <span className="text-muted-foreground">Lifecycle Stage:</span>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {update.localStage} (Local)
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border border-primary/30">
                      {update.incomingStage} (Remote)
                    </Badge>
                  </div>
                </div>
              )}

              {update.seedsChanged && (
                <div className="flex items-center justify-between p-1.5 rounded bg-background/60 border border-border/40">
                  <span className="text-muted-foreground">Seeds on Hand:</span>
                  <div className="flex items-center gap-1.5 font-medium">
                    <span>{update.localSeedsOnHand ?? 0}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-bold text-primary">{update.incomingSeedsOnHand ?? 0}</span>
                  </div>
                </div>
              )}

              {update.methodChanged && (
                <div className="flex items-center justify-between p-1.5 rounded bg-background/60 border border-border/40">
                  <span className="text-muted-foreground">Prep Method:</span>
                  <div className="flex items-center gap-1.5 font-medium capitalize">
                    <span>{update.localPropagationMethod}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-bold text-primary">{update.incomingPropagationMethod}</span>
                  </div>
                </div>
              )}

              {update.changeSummary && !update.stageChanged && !update.seedsChanged && !update.methodChanged && (
                <p className="text-xs text-foreground/90 font-medium">
                  {update.changeSummary}
                </p>
              )}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-snug">
            💡 <strong className="text-foreground">Recommendation:</strong> Sync the remote update first to keep both devices aligned, or proceed if your local change supersedes it.
          </p>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="default"
            onClick={async () => {
              await onSyncRemoteFirst();
              onOpenChange(false);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync Remote First (Recommended)</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await onProceedAnyway();
              onOpenChange(false);
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Proceed with {operationLabel}</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
