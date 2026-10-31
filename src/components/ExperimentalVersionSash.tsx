'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical,
  MessageSquare,
  ExternalLink,
  Copy,
  Check,
  GitBranch,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  APP_NAME,
  APP_STAGE,
  FEEDBACK_URL,
  REPO_URL,
} from '@/lib/constants';
import { useGitCommit } from '@/lib/git-version';

const SASH_STORAGE_KEY = 'grow_banner_is_sash';

export function ExperimentalVersionSash() {
  const [isSash, setIsSash] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const commit = useGitCommit();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(SASH_STORAGE_KEY);
      if (saved === 'true') {
        setIsSash(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleToggleSash = useCallback((nextState: boolean) => {
    setIsSash(nextState);
    try {
      localStorage.setItem(SASH_STORAGE_KEY, String(nextState));
    } catch {
      // ignore
    }
  }, []);

  const copyDiagnostics = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const diag = [
      `### Grow Environment Diagnostics`,
      `- **App:** ${APP_NAME} (${APP_STAGE})`,
      `- **Git Version:** @${commit.sha} ${commit.date ? `(${commit.date})` : ''}`,
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
  }, [commit, toast]);

  if (!mounted) {
    return null;
  }

  // State 1: Classic Diagonal Corner Sash Ribbon
  if (isSash) {
    return (
      <div
        aria-label="Experimental version ribbon sash"
        className="fixed top-0 left-0 z-50 overflow-hidden w-28 h-28 sm:w-36 sm:h-36 pointer-events-none select-none"
      >
        <div
          className="pointer-events-auto absolute transform -rotate-45 -left-10 sm:-left-9 top-5 sm:top-7 w-36 sm:w-44 py-1 sm:py-1.5 bg-gradient-to-r from-amber-600 via-emerald-600 to-amber-700 hover:from-amber-500 hover:to-emerald-500 text-white font-headline font-bold text-center shadow-xl border-y border-white/25 cursor-pointer transition-all duration-150 group"
          title={`Grow (Experimental) @${commit.sha} • Click to open feedback`}
          onClick={() => window.open(FEEDBACK_URL, '_blank', 'noopener,noreferrer')}
        >
          <div className="flex flex-col items-center justify-center tracking-wider leading-tight">
            <span className="text-[10px] sm:text-[11px] font-extrabold flex items-center gap-1 drop-shadow-sm">
              <FlaskConical className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              EXPERIMENTAL
            </span>
            <span className="text-[9px] font-mono opacity-90 tracking-normal drop-shadow-sm flex items-center gap-1">
              git @{commit.sha} • Feedback ↗
            </span>
          </div>

          {/* Untick to restore top banner */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleSash(false);
            }}
            className="hidden group-hover:flex absolute right-1 sm:right-1.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 bg-black/40 hover:bg-black/70 text-white"
            title="Untick to restore top banner"
            aria-label="Restore banner"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
    );
  }

  // State 2: Top Banner (with "Sash" tick box)
  return (
    <aside
      aria-label="Experimental version notice and feedback"
      className="w-full relative z-40 bg-gradient-to-r from-amber-500/15 via-emerald-950/40 to-amber-500/10 border-b border-amber-500/30 backdrop-blur-sm text-foreground transition-all duration-200"
    >
      <div className="container mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Branding, Experimental label, and Git Version */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>

          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-semibold uppercase tracking-wider text-[11px] border border-amber-500/40 font-headline">
            <FlaskConical className="h-3 w-3 text-amber-400" />
            <span>Experimental</span>
          </div>

          <a
            href={commit.sha !== 'main' ? `${REPO_URL}/commit/${commit.sha}` : `${REPO_URL}/commits/main`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-mono border border-amber-500/30 text-amber-200/90 bg-background/50 px-2 py-0.5 rounded hover:underline hover:border-amber-500/60 transition-colors"
            title={`Upstream Git Commit: ${commit.sha}`}
          >
            <GitBranch className="h-3 w-3 text-amber-400" />
            <span>git @{commit.sha}</span>
            {commit.date && <span className="opacity-70 text-[10px]">({commit.date})</span>}
          </a>

          <span className="text-muted-foreground hidden lg:inline">
            Early preview • Local-first gardening with zero-merge crowd development.
          </span>
        </div>

        {/* Right: Feedback Link, Diagnostics, and Tick to make it a sash */}
        <div className="flex items-center gap-2 sm:gap-3">
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
            title="Copy system diagnostics to paste into your bug report"
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

          {/* Tick the experimental banner to make it a sash */}
          <label
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 cursor-pointer select-none text-xs transition-colors"
            title="Tick to turn this banner into a corner sash"
          >
            <input
              type="checkbox"
              checked={isSash}
              onChange={(e) => handleToggleSash(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-amber-500 border-amber-500/50 cursor-pointer"
            />
            <span className="font-medium text-[11px] font-headline">Sash</span>
          </label>
        </div>
      </div>
    </aside>
  );
}
