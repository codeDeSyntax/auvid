// ─── JobStore — lightweight active-job context ────────────────────────────────
// Lets any tool report its current job status globally so the sidebar can show
// a pulsing badge while a tool is working in the background.

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { MediaTool } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type JobStatus = 'processing' | 'done' | 'error' | 'idle';

export interface ActiveJob {
  tool: MediaTool;
  status: JobStatus;
  progress: number;   // 0–100
  label?: string;
}

interface JobStoreContextType {
  jobs: Record<string, ActiveJob>;
  reportJob: (tool: MediaTool, update: Partial<Omit<ActiveJob, 'tool'>>) => void;
  clearJob: (tool: MediaTool) => void;
  getJob: (tool: MediaTool) => ActiveJob | undefined;
}

// ── Context ───────────────────────────────────────────────────────────────────

const JobStoreContext = createContext<JobStoreContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export const JobStoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<Record<string, ActiveJob>>({});

  const reportJob = useCallback((tool: MediaTool, update: Partial<Omit<ActiveJob, 'tool'>>) => {
    setJobs((prev) => {
      const defaults: ActiveJob = {
        tool,
        status: 'processing',
        progress: 0,
        label: undefined,
      };
      const existing = prev[tool] ?? defaults;
      return {
        ...prev,
        [tool]: { ...existing, ...update, tool },
      };
    });
  }, []);

  const clearJob = useCallback((tool: MediaTool) => {
    setJobs((prev) => {
      const next = { ...prev };
      delete next[tool];
      return next;
    });
  }, []);

  const getJob = useCallback((tool: MediaTool): ActiveJob | undefined => {
    return jobs[tool];
  }, [jobs]);

  return (
    <JobStoreContext.Provider value={{ jobs, reportJob, clearJob, getJob }}>
      {children}
    </JobStoreContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useJobStore(): JobStoreContextType {
  const ctx = useContext(JobStoreContext);
  if (!ctx) throw new Error('useJobStore must be used inside <JobStoreProvider>');
  return ctx;
}
