'use client';

import React, { useMemo } from 'react';
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
import { Network, ThumbsUp, AlertTriangle } from 'lucide-react';
import { COMPANION_RULES, matchesKeywords } from '@/lib/companion-guild';

function CompanionGuildWidget({ plantings }: ExtensionContext) {
  const matches = useMemo(() => {
    const found: {
      plantA: string;
      plantB: string;
      relation: 'synergy' | 'conflict';
      reason: string;
    }[] = [];

    for (let i = 0; i < plantings.length; i++) {
      for (let j = i + 1; j < plantings.length; j++) {
        const spA = `${plantings[i].name} ${plantings[i].plant.species}`;
        const spB = `${plantings[j].name} ${plantings[j].plant.species}`;
        if (plantings[i].plantId === plantings[j].plantId) continue;

        for (const rule of COMPANION_RULES) {
          const directMatch =
            matchesKeywords(spA, rule.a) && matchesKeywords(spB, rule.b);
          const reverseMatch =
            matchesKeywords(spA, rule.b) && matchesKeywords(spB, rule.a);

          if (directMatch || reverseMatch) {
            found.push({
              plantA: plantings[i].name,
              plantB: plantings[j].name,
              relation: rule.relation,
              reason: rule.reason,
            });
          }
        }
      }
    }
    return found;
  }, [plantings]);

  const synergyCount = matches.filter((m) => m.relation === 'synergy').length;
  const conflictCount = matches.filter((m) => m.relation === 'conflict').length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Network className="h-4 w-4 text-primary" />
          <span>Guild Matrix</span>
          {(synergyCount > 0 || conflictCount > 0) && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              {synergyCount}↑ {conflictCount > 0 ? `${conflictCount}⚠` : ''}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            Companion Planting & Permaculture Guilds
          </DialogTitle>
          <DialogDescription>
            Community-extensible polyculture matrix checking active plantings in your garden.
          </DialogDescription>
        </DialogHeader>

        {matches.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground border border-dashed rounded-md">
            No companion synergies or conflicts detected among current plants yet. Try adding classic pairs (e.g., Basil + Tomato, Kūmara + Kawakawa, Carrot + Rosemary).
          </div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {matches.map((m, idx) => (
              <div
                key={idx}
                className="rounded-md border p-3 text-sm space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {m.plantA} + {m.plantB}
                  </span>
                  {m.relation === 'synergy' ? (
                    <Badge variant="default" className="gap-1">
                      <ThumbsUp className="h-3 w-3" /> Guild Synergy
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> Antagonistic
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{m.reason}</p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export const companionGuildExtension: GrowExtension = {
  id: 'companion-guild',
  name: 'Companion & Guild Matrix',
  description: 'Analyzes active plantings for permaculture guild synergies and allelopathic conflicts.',
  version: '1.0.0',
  slots: ['dashboard-toolbar'],
  contributor: {
    name: 'Permaculture Guild Contributors',
    githubOrNostr: 'creat-o-r',
    url: 'https://github.com/creat-o-r/grow',
  },
  DashboardWidget: CompanionGuildWidget,
};
