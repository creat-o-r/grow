'use client';

import React from 'react';
import { type ExtensionContext } from './registry';
import { useExtensions, openSettingsToExtensions } from './use-extensions';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';

export function ExtensionSlotBar(props: ExtensionContext) {
  const { getBySlot } = useExtensions();
  const toolbarExtensions = getBySlot('dashboard-toolbar');

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      {/* Crowd-Developed Extensions */}
      {toolbarExtensions.map((ext) => {
        const Widget = ext.DashboardWidget;
        return Widget ? <Widget key={ext.id} {...props} /> : null;
      })}

      {/* Settings shortcut to toggle extensions on/off */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={openSettingsToExtensions}
        title="Configure extensions in Settings"
        aria-label="Configure extensions in Settings"
      >
        <Settings2 className="h-4 w-4 text-primary" />
      </Button>
    </div>
  );
}
