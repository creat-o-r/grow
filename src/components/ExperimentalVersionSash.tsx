'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical,
  MessageSquare,
  ExternalLink,
  Copy,
  Check,
  Bookmark,
  Maximize2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  APP_NAME,
  APP_VERSION,
  APP_STAGE,
  FEEDBACK_URL,
  REPO_URL,
} from '@/lib/constants';

export type SashViewMode = 'banner' | 'corner' | 'pill' | 'hidden';

export const SASH_STORAGE_KEY = 'grow_experimental_sash_view';
export const SASH_CHANGE_EVENT = 'grow-sash-view-changed';

export function getSavedSashView(): SashViewMode {
  if (typeof window === 'undefined') return 'banner';
  try {
    const saved = localStorage.getItem(SASH_STORAGE_KEY);
    if (saved === 'banner' || saved === 'corner' || saved === 'pill' || saved === 'hidden') {
      return saved;
    }
  } catch {
    // Ignore localStorage errors
  }
  return 'banner';
}

export function setSavedSashView(mode: SashViewMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SASH_STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent(SASH_CHANGE_EVENT, { detail: { mode } }));
  } catch {
    // Ignore localStorage errors
  }
}

export function ExperimentalVersionSash() {
  const [viewMode, setViewMode] = useState<SashViewMode>('banner');
  const [isCopied, setIsCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
    setViewMode(getSavedSashView());

    const handleSashChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: SashViewMode }>;
      if (customEvent.detail?.mode) {
        setViewMode(customEvent.detail.mode);
      }
    };

    window.addEventListener(SASH_CHANGE_EVENT, handleSashChange);
    return () => window.removeEventListener(SASH_CHANGE_EVENT, handleSashChange);
  }, []);

  const handleModeChange = useCallback((newMode: SashViewMode) => {
    setViewMode(newMode);
    setSavedSashView(newMode);
  }, []);

  const copyDiagnostics = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const diag = [
      `### Grow Environment Diagnostics`,
      `- **App:** ${APP_NAME} v${APP_VERSION} (${APP_STAGE})`,
      `- **Date / Time:** ${new Date().toISOString()}`,
      `- **URL:** ${window.location.origin}${window.location.pathname}`,
      `- **User Agent:** ${navigator.userAgent}`,
      `- **Screen Resolution:** ${window.innerWidth}x${window.innerHeight} (DPR: ${window.devicePixelRatio || 1})`,
      `- **Storage:** IndexedDB (Dexie)`,
      `- **Upstream Repo:** ${REPO_URL}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(diag);
      setIsCopied(true);
      toast({
        title: 'Diagnostics Copied to Clipboard',
        description: 'Environment details copied. You can paste them directly into your GitHub feedback or bug report.',
      });
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      toast({
        title: 'Could Not Copy Diagnostics',
        description: 'Clipboard access was blocked by your browser.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  if (!mounted || viewMode === 'hidden') {
    return null;
  }

  // View 1: Top Horizontal Sash Banner (Default)
  if (viewMode === 'banner') {
    return (
      <aside
        aria-label="Experimental version notice and feedback"
        className="w-full relative z-40 bg-gradient-to-r from-amber-500/15 via-emerald-950/40 to-amber-500/10 border-b border-amber-500/30 backdrop-blur-sm text-foreground transition-all duration-200"
      >
        <div className="container mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Branding, Experimental label, and Version */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>

            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-semibold uppercase tracking-wider text-[11px] border border-amber-500/40 font-headline">
              <FlaskConical className="h-3 w-3 text-amber-400" />
              <span>Experimental</span>
            </div>

            <Badge
              variant="outline"
              className="text-[11px] font-mono border-amber-500/30 text-amber-200/90 bg-background/50 px-1.5 py-0"
            >
              v{APP_VERSION}
            </Badge>

            <span className="text-muted-foreground hidden md:inline">
              Early preview build • Local-first gardening with zero-merge crowd development.
            </span>
          </div>

          {/* Right: Actions - Feedback Link, Copy Diagnostics, View toggles */}
          <div className="flex items-center gap-2">
            <a
              href={FEEDBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center"
              title="Open GitHub Issues to send feedback, report bugs, or request features"
            >
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1.5 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-100 font-medium shadow-sm transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
                <span>Give Feedback</span>
                <ExternalLink className="h-3 w-3 opacity-70 ml-0.5" />
              </Button>
            </a>

            <Button
              size="sm"
              variant="ghost"
              onClick={copyDiagnostics}
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
              title="Copy system diagnostics (version, browser, resolution) to paste into your bug report"
            >
              {isCopied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="hidden sm:inline text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copy Info</span>
                </>
              )}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleModeChange('corner')}
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-amber-500/10"
              title="Switch to corner ribbon sash"
              aria-label="Switch to corner ribbon sash"
            >
              <Bookmark className="h-3.5 w-3.5" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleModeChange('pill')}
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-amber-500/10"
              title="Minimize banner into floating badge"
              aria-label="Minimize banner"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>
    );
  }

  // View 2: Classic Diagonal Corner Sash Ribbon
  if (viewMode === 'corner') {
    return (
      <div
        aria-label="Experimental version ribbon sash"
        className="fixed top-0 left-0 z-50 overflow-hidden w-28 h-28 sm:w-36 sm:h-36 pointer-events-none select-none"
      >
        <div
          className="pointer-events-auto absolute transform -rotate-45 -left-10 sm:-left-9 top-5 sm:top-7 w-36 sm:w-44 py-1 sm:py-1.5 bg-gradient-to-r from-amber-600 via-emerald-600 to-amber-700 hover:from-amber-500 hover:to-emerald-500 text-white font-headline font-bold text-center shadow-xl border-y border-white/25 cursor-pointer transition-all duration-150 group"
          title={`Grow v${APP_VERSION} (Experimental) • Click to open feedback & bug reports`}
          onClick={() => window.open(FEEDBACK_URL, '_blank', 'noopener,noreferrer')}
        >
          <div className="flex flex-col items-center justify-center tracking-wider leading-tight">
            <span className="text-[10px] sm:text-[11px] font-extrabold flex items-center gap-1 drop-shadow-sm">
              <FlaskConical className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              EXPERIMENTAL
            </span>
            <span className="text-[9px] font-mono opacity-90 tracking-normal drop-shadow-sm">
              v{APP_VERSION} • Feedback ↗
            </span>
          </div>

          {/* Quick toggle button to return to top banner */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleModeChange('banner');
            }}
            className="hidden group-hover:flex absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 bg-black/40 hover:bg-black/60 text-white/90"
            title="Expand into full top banner"
            aria-label="Expand banner"
          >
            <Maximize2 className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
    );
  }

  // View 3: Floating Minimal Pill Badge
  return (
    <div
      aria-label="Experimental version badge"
      className="fixed bottom-4 left-4 z-40 bg-card/95 backdrop-blur-md border border-amber-500/40 rounded-full px-3 py-1.5 shadow-xl flex items-center gap-2 text-xs text-foreground animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
      </span>

      <span className="font-headline font-semibold text-amber-300">Experimental</span>
      <span className="font-mono text-[11px] text-muted-foreground">v{APP_VERSION}</span>

      <span className="text-muted-foreground/60">•</span>

      <a
        href={FEEDBACK_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-amber-200 hover:text-amber-100 hover:underline flex items-center gap-1"
        title="Send feedback or report an issue on GitHub"
      >
        <span>Feedback</span>
        <ExternalLink className="h-3 w-3 opacity-70" />
      </a>

      <button
        type="button"
        onClick={() => handleModeChange('banner')}
        className="text-muted-foreground hover:text-foreground ml-1 p-0.5 rounded hover:bg-muted"
        title="Expand to full top banner sash"
        aria-label="Expand top banner sash"
      >
        <Maximize2 className="h-3 w-3" />
      </button>

      <button
        type="button"
        onClick={() => handleModeChange('corner')}
        className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted"
        title="Switch to corner diagonal sash ribbon"
        aria-label="Switch to corner sash"
      >
        <Bookmark className="h-3 w-3" />
      </button>
    </div>
  );
}
