'use client';

export interface UsageFeatureCounts {
  plantsAdded: number;
  plantsEdited: number;
  plantsDeleted: number;
  viabilityChecked: number;
  seedPacksExported: number;
  seedPacksImported: number;
  seedSwapsViewed: number;
  aiLogsViewed: number;
  aiDatasetsGenerated: number;
  settingsViewed: number;
  statsViewed: number;
  persistenceRequested: number;
}

export interface UsageTelemetryData {
  firstSessionTimestamp: string;
  lastActiveTimestamp: string;
  totalSessions: number;
  activeDaysCount: number;
  dailyActions: Record<string, number>; // 'YYYY-MM-DD' -> count
  featureCounts: UsageFeatureCounts;
  totalInteractions: number;
}

const STORAGE_KEY = 'grow_usage_telemetry_v1';
export const USAGE_STATS_CHANGED_EVENT = 'grow-usage-stats-changed';

const DEFAULT_FEATURE_COUNTS: UsageFeatureCounts = {
  plantsAdded: 0,
  plantsEdited: 0,
  plantsDeleted: 0,
  viabilityChecked: 0,
  seedPacksExported: 0,
  seedPacksImported: 0,
  seedSwapsViewed: 0,
  aiLogsViewed: 0,
  aiDatasetsGenerated: 0,
  settingsViewed: 0,
  statsViewed: 0,
  persistenceRequested: 0,
};

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getStoredUsageTelemetry(): UsageTelemetryData {
  if (typeof window === 'undefined') {
    return {
      firstSessionTimestamp: new Date().toISOString(),
      lastActiveTimestamp: new Date().toISOString(),
      totalSessions: 1,
      activeDaysCount: 1,
      dailyActions: { [getTodayKey()]: 1 },
      featureCounts: { ...DEFAULT_FEATURE_COUNTS },
      totalInteractions: 1,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const now = new Date().toISOString();
      const initial: UsageTelemetryData = {
        firstSessionTimestamp: now,
        lastActiveTimestamp: now,
        totalSessions: 1,
        activeDaysCount: 1,
        dailyActions: { [getTodayKey()]: 1 },
        featureCounts: { ...DEFAULT_FEATURE_COUNTS },
        totalInteractions: 1,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return {
      firstSessionTimestamp: parsed.firstSessionTimestamp || new Date().toISOString(),
      lastActiveTimestamp: parsed.lastActiveTimestamp || new Date().toISOString(),
      totalSessions: typeof parsed.totalSessions === 'number' ? parsed.totalSessions : 1,
      activeDaysCount: typeof parsed.activeDaysCount === 'number' ? parsed.activeDaysCount : 1,
      dailyActions: parsed.dailyActions || { [getTodayKey()]: 1 },
      featureCounts: { ...DEFAULT_FEATURE_COUNTS, ...(parsed.featureCounts || {}) },
      totalInteractions: typeof parsed.totalInteractions === 'number' ? parsed.totalInteractions : 1,
    };
  } catch (err) {
    console.warn('Failed to parse usage telemetry, initializing fresh state:', err);
    return {
      firstSessionTimestamp: new Date().toISOString(),
      lastActiveTimestamp: new Date().toISOString(),
      totalSessions: 1,
      activeDaysCount: 1,
      dailyActions: { [getTodayKey()]: 1 },
      featureCounts: { ...DEFAULT_FEATURE_COUNTS },
      totalInteractions: 1,
    };
  }
}

export function recordUsageEvent(
  feature: keyof UsageFeatureCounts,
  increment: number = 1
): UsageTelemetryData {
  if (typeof window === 'undefined') {
    return getStoredUsageTelemetry();
  }

  try {
    const current = getStoredUsageTelemetry();
    const now = new Date();
    const today = getTodayKey();

    // Check if session timed out (>30 min since last activity)
    const lastActive = new Date(current.lastActiveTimestamp).getTime();
    const isNewSession = now.getTime() - lastActive > 30 * 60 * 1000;

    const nextSessions = isNewSession ? current.totalSessions + 1 : current.totalSessions;
    const nextDaily = { ...current.dailyActions };
    nextDaily[today] = (nextDaily[today] || 0) + increment;

    const nextFeatures: UsageFeatureCounts = {
      ...current.featureCounts,
      [feature]: (current.featureCounts[feature] || 0) + increment,
    };

    const nextTotal = current.totalInteractions + increment;
    const nextActiveDays = Object.keys(nextDaily).length;

    const updated: UsageTelemetryData = {
      firstSessionTimestamp: current.firstSessionTimestamp,
      lastActiveTimestamp: now.toISOString(),
      totalSessions: nextSessions,
      activeDaysCount: nextActiveDays,
      dailyActions: nextDaily,
      featureCounts: nextFeatures,
      totalInteractions: nextTotal,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent(USAGE_STATS_CHANGED_EVENT, { detail: updated })
    );

    return updated;
  } catch (err) {
    console.warn('Failed to record usage event:', err);
    return getStoredUsageTelemetry();
  }
}

export function resetUsageTelemetry(): UsageTelemetryData {
  if (typeof window === 'undefined') {
    return getStoredUsageTelemetry();
  }

  const now = new Date().toISOString();
  const resetData: UsageTelemetryData = {
    firstSessionTimestamp: now,
    lastActiveTimestamp: now,
    totalSessions: 1,
    activeDaysCount: 1,
    dailyActions: { [getTodayKey()]: 1 },
    featureCounts: { ...DEFAULT_FEATURE_COUNTS },
    totalInteractions: 1,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resetData));
    window.dispatchEvent(
      new CustomEvent(USAGE_STATS_CHANGED_EVENT, { detail: resetData })
    );
  } catch (err) {
    console.warn('Failed to reset usage telemetry:', err);
  }

  return resetData;
}
