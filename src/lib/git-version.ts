'use client';

import { useState, useEffect } from 'react';

export interface GitCommitInfo {
  sha: string;
  date: string;
}

const CACHE_KEY = 'grow_upstream_commit';

export function getCachedGitCommit(): GitCommitInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

export function useGitCommit(): GitCommitInfo {
  const [commit, setCommit] = useState<GitCommitInfo>(() => {
    return getCachedGitCommit() || { sha: 'main', date: '' };
  });

  useEffect(() => {
    const cached = getCachedGitCommit();
    if (cached) {
      setCommit(cached);
      return;
    }

    fetch('https://api.github.com/repos/creat-o-r/grow/commits/main')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.sha) {
          const info: GitCommitInfo = {
            sha: String(data.sha).slice(0, 7),
            date: data.commit?.committer?.date?.slice(0, 10) || '',
          };
          setCommit(info);
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(info));
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {});
  }, []);

  return commit;
}
