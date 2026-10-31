'use client';

import React, { useState, useEffect, useCallback, useId } from 'react';
import {
  registeredExtensions,
  getDisabledExtensionIds,
  setExtensionEnabled,
  toggleExtension,
  setAllExtensionsEnabled,
  EXTENSIONS_CHANGED_EVENT,
  DISABLED_EXTENSIONS_KEY,
  type ExtensionSlot,
  type GrowExtension,
} from './registry';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function useExtensions() {
  const [disabledIds, setDisabledIds] = useState<string[]>([]);

  useEffect(() => {
    setDisabledIds(getDisabledExtensionIds());

    const handleCustomChange = () => {
      setDisabledIds(getDisabledExtensionIds());
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key || e.key === DISABLED_EXTENSIONS_KEY) {
        setDisabledIds(getDisabledExtensionIds());
      }
    };

    window.addEventListener(EXTENSIONS_CHANGED_EVENT, handleCustomChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener(EXTENSIONS_CHANGED_EVENT, handleCustomChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const isEnabled = useCallback(
    (id: string) => !disabledIds.includes(id),
    [disabledIds]
  );

  const setEnabled = useCallback((id: string, enabled: boolean) => {
    setExtensionEnabled(id, enabled);
  }, []);

  const toggle = useCallback((id: string) => {
    return toggleExtension(id);
  }, []);

  const setAllEnabled = useCallback((enabled: boolean) => {
    setAllExtensionsEnabled(enabled);
  }, []);

  const getBySlot = useCallback(
    (slot: ExtensionSlot): GrowExtension[] => {
      return registeredExtensions.filter(
        (ext) => ext.slots.includes(slot) && !disabledIds.includes(ext.id)
      );
    },
    [disabledIds]
  );

  const enabledExtensions = registeredExtensions.filter(
    (ext) => !disabledIds.includes(ext.id)
  );

  return {
    extensions: registeredExtensions,
    enabledExtensions,
    disabledIds,
    isEnabled,
    setEnabled,
    toggle,
    setAllEnabled,
    getBySlot,
  };
}

const SLOT_LABELS: Record<ExtensionSlot, string> = {
  'dashboard-toolbar': 'Toolbar',
  'plant-card-badge': 'Plant Card',
  'viability-modifier': 'Viability',
};

export function ExtensionToggleList() {
  const { extensions, isEnabled, setEnabled } = useExtensions();
  const { toast } = useToast();
  const instanceId = useId();
  const [supportsHas, setSupportsHas] = useState(true);

  useEffect(() => {
    if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
      setSupportsHas(CSS.supports('selector(:has(*))'));
    }
  }, []);

  const handleToggleExtension = (ext: GrowExtension, nextChecked: boolean) => {
    setEnabled(ext.id, nextChecked);
    toast({
      title: `${ext.name} ${nextChecked ? 'Enabled' : 'Disabled'}`,
      description: nextChecked
        ? `Extension is now active.`
        : 'Extension has been turned off.',
    });
  };

  return (
    <div className="space-y-2">
      {extensions.map((ext) => {
        const enabled = isEnabled(ext.id);
        const switchId = `${instanceId}-ext-switch-${ext.id}`;
        return (
          <div
            key={ext.id}
            className={`extension-toggle-card rounded-md p-2.5 text-xs space-y-1 ${
              !supportsHas && enabled ? 'is-active' : ''
            }`}
          >
            <input
              type="checkbox"
              className="extension-toggle sr-only"
              checked={enabled}
              onChange={(e) => handleToggleExtension(ext, e.target.checked)}
              tabIndex={-1}
              aria-hidden="true"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Label
                  htmlFor={switchId}
                  className="font-semibold text-xs cursor-pointer"
                >
                  {ext.name}
                </Label>
                <Badge variant="outline">v{ext.version}</Badge>
              </div>
              <Switch
                id={switchId}
                checked={enabled}
                onCheckedChange={(checked) => handleToggleExtension(ext, checked)}
                aria-label={`Toggle ${ext.name}`}
              />
            </div>
            <p className="text-muted-foreground">{ext.description}</p>
            <div className="text-[11px] text-muted-foreground">
              By <strong>{ext.contributor.name}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}
