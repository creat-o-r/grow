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

export const OPEN_SETTINGS_EVENT = 'grow-open-settings';

export function openSettingsToExtensions() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(OPEN_SETTINGS_EVENT, {
      detail: { section: 'extensions' },
    })
  );
}

const SLOT_LABELS: Record<ExtensionSlot, string> = {
  'dashboard-toolbar': 'Toolbar',
  'plant-card-badge': 'Plant Card',
  'viability-modifier': 'Viability',
};

export function ExtensionToggleList({
  showBulkActions = true,
}: {
  showBulkActions?: boolean;
}) {
  const {
    extensions,
    enabledExtensions,
    isEnabled,
    setEnabled,
    setAllEnabled,
  } = useExtensions();
  const { toast } = useToast();
  const instanceId = useId();
  const [supportsHas, setSupportsHas] = useState(true);

  useEffect(() => {
    if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
      setSupportsHas(CSS.supports('selector(:has(*))'));
    }
  }, []);

  const allEnabled = enabledExtensions.length === extensions.length;
  const noneEnabled = enabledExtensions.length === 0;

  const handleToggleExtension = (ext: GrowExtension, nextChecked: boolean) => {
    setEnabled(ext.id, nextChecked);
    toast({
      title: `${ext.name} ${nextChecked ? 'Enabled' : 'Disabled'}`,
      description: nextChecked
        ? `Extension is now active in ${ext.slots.map((s) => SLOT_LABELS[s]).join(' & ')}.`
        : 'Extension has been turned off.',
    });
  };

  return (
    <div className="space-y-2.5">
      {showBulkActions && extensions.length > 1 && (
        <div className="flex items-center justify-between gap-2 pb-1">
          <span className="text-xs text-muted-foreground">
            <strong>{enabledExtensions.length}</strong> of{' '}
            <strong>{extensions.length}</strong> extensions enabled
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px]"
              disabled={allEnabled}
              onClick={() => {
                setAllEnabled(true);
                toast({
                  title: 'All Extensions Enabled',
                  description: `Activated all ${extensions.length} crowd extensions.`,
                });
              }}
            >
              Enable All
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px]"
              disabled={noneEnabled}
              onClick={() => {
                setAllEnabled(false);
                toast({
                  title: 'All Extensions Disabled',
                  description: 'All crowd extensions have been turned off.',
                });
              }}
            >
              Disable All
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {extensions.map((ext) => {
          const enabled = isEnabled(ext.id);
          const switchId = `${instanceId}-ext-switch-${ext.id}`;
          return (
            <div
              key={ext.id}
              className={`extension-toggle-card rounded-md p-3 text-xs space-y-1.5 ${
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
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <Label
                    htmlFor={switchId}
                    className="font-semibold text-xs cursor-pointer"
                  >
                    {ext.name}
                  </Label>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    v{ext.version}
                  </Badge>
                  <Badge
                    variant={enabled ? 'default' : 'secondary'}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {enabled ? 'On' : 'Off'}
                  </Badge>
                </div>
                <Switch
                  id={switchId}
                  checked={enabled}
                  onCheckedChange={(checked) => handleToggleExtension(ext, checked)}
                  aria-label={`Toggle ${ext.name}`}
                />
              </div>

              <p className="text-muted-foreground leading-relaxed">
                {ext.description}
              </p>

              <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] text-muted-foreground flex-wrap">
                <span>
                  By <strong>{ext.contributor.name}</strong>
                </span>
                <div className="flex items-center gap-1">
                  {ext.slots.map((slot) => (
                    <Badge
                      key={slot}
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 font-normal"
                    >
                      {SLOT_LABELS[slot]}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
