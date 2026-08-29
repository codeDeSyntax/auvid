// ─── useMediaDownloader.ts ──────────────────────────────────────────────────
// React hook managing web downloader state, clipboard listening, queue, and IPC events.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMediaContext } from '@/Provider/MediaContext';
import {
  DownloadJob,
  DownloadProbeResult,
  StreamFormatOption,
  DownloadSettings,
  DEFAULT_DOWNLOAD_SETTINGS,
} from '@/types/mediaDownloader';

export function useMediaDownloader() {
  const { addOutputFile } = useMediaContext();

  const [urlInput, setUrlInput] = useState('');
  const [isProbing, setIsProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<DownloadProbeResult | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<StreamFormatOption | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<DownloadJob[]>(() => {
    try {
      const saved = localStorage.getItem('auvid_downloader_jobs');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });

  const [settings, setSettings] = useState<DownloadSettings>(() => {
    try {
      const saved = localStorage.getItem('auvid_downloader_settings');
      if (saved) return { ...DEFAULT_DOWNLOAD_SETTINGS, ...JSON.parse(saved) };
    } catch (_) {}
    return DEFAULT_DOWNLOAD_SETTINGS;
  });

  const [engineStatus, setEngineStatus] = useState<{ installed: boolean; version: string | null } | null>(null);
  const [isUpdatingEngine, setIsUpdatingEngine] = useState(false);

  // Save settings and jobs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('auvid_downloader_settings', JSON.stringify(settings));
    } catch (_) {}
  }, [settings]);

  useEffect(() => {
    try {
      // Save only last 20 jobs
      const toSave = jobs.slice(0, 20);
      localStorage.setItem('auvid_downloader_jobs', JSON.stringify(toSave));
    } catch (_) {}
  }, [jobs]);

  // Check yt-dlp binary status on mount
  useEffect(() => {
    window.ipcRenderer
      ?.invoke('downloader:check-status')
      .then((status: any) => {
        if (status) {
          setEngineStatus({ installed: status.installed, version: status.version });
        }
      })
      .catch(() => {
        setEngineStatus({ installed: false, version: null });
      });
  }, []);

  // Listen to live progress events from Main process
  useEffect(() => {
    const handleProgress = (_event: unknown, data: {
      jobId: string;
      percent: number;
      speed?: string;
      eta?: string;
      downloaded?: string;
      total?: string;
    }) => {
      setJobs((prev) =>
        prev.map((job) => {
          if (job.id === data.jobId) {
            return {
              ...job,
              status: data.percent >= 100 ? 'merging' : 'downloading',
              progress: data.percent,
              speed: data.speed || job.speed,
              eta: data.eta || job.eta,
            };
          }
          return job;
        })
      );
    };

    window.ipcRenderer?.on?.('downloader:progress', handleProgress);
    return () => {
      window.ipcRenderer?.off?.('downloader:progress', handleProgress);
    };
  }, []);

  // Probe a URL
  const probeUrl = useCallback(async (targetUrl?: string) => {
    const toProbe = (targetUrl || urlInput).trim();
    if (!toProbe) return;

    setIsProbing(true);
    setProbeError(null);
    setProbeResult(null);
    setSelectedFormat(null);

    try {
      const result = (await window.ipcRenderer?.invoke('downloader:probe', toProbe)) as DownloadProbeResult;
      setProbeResult(result);

      // Auto-select recommended or best format
      if (result.formats && result.formats.length > 0) {
        const recommended = result.formats.find((f) => f.isRecommended) || result.formats[0];
        setSelectedFormat(recommended);
      }
    } catch (err: any) {
      setProbeError(err.message || 'Failed to probe video URL.');
    } finally {
      setIsProbing(false);
    }
  }, [urlInput]);

  // Start download for probed item or specified format
  const startDownload = useCallback(async (overrideFormat?: StreamFormatOption) => {
    if (!probeResult) return;

    const format = overrideFormat || selectedFormat;
    if (!format) return;

    const newJob: DownloadJob = {
      id: crypto.randomUUID(),
      url: probeResult.url,
      title: probeResult.title,
      siteName: probeResult.siteName,
      thumbnail: probeResult.thumbnail,
      duration: probeResult.duration,
      targetType: format.type,
      selectedFormatId: format.formatId,
      qualityLabel: format.qualityLabel,
      ext: format.ext,
      status: 'downloading',
      progress: 0,
      createdAt: Date.now(),
    };

    setJobs((prev) => [newJob, ...prev]);

    // Reset probe card to allow immediate new input
    setProbeResult(null);
    setUrlInput('');
    setSelectedFormat(null);

    try {
      const result = (await window.ipcRenderer?.invoke('downloader:start', {
        jobId: newJob.id,
        params: {
          url: newJob.url,
          formatId: newJob.selectedFormatId,
          targetType: newJob.targetType,
          customTitle: newJob.title,
          embedThumbnail: settings.embedThumbnail,
          embedSubtitles: settings.embedSubtitles,
        },
      })) as { outputPath: string; outputSize: number; title: string };

      setJobs((prev) =>
        prev.map((j) =>
          j.id === newJob.id
            ? {
                ...j,
                status: 'completed',
                progress: 100,
                outputPath: result.outputPath,
                outputSize: result.outputSize,
                title: result.title || j.title,
              }
            : j
        )
      );

      // Register into global Recent Outputs history
      if (result.outputPath) {
        addOutputFile({
          id: newJob.id,
          name: result.title || newJob.title,
          savedPath: result.outputPath,
          originalName: `${newJob.siteName}: ${newJob.title}`,
          size: result.outputSize || 0,
          originalSize: result.outputSize || 0,
          format: newJob.ext.toUpperCase(),
          type: newJob.targetType,
          tool: 'downloader',
          savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          savedAtMs: Date.now(),
        });
      }
    } catch (err: any) {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === newJob.id
            ? {
                ...j,
                status: 'failed',
                error: err.message || 'Download failed',
              }
            : j
        )
      );
    }
  }, [probeResult, selectedFormat, settings, addOutputFile]);

  // Cancel download job
  const cancelJob = useCallback(async (jobId: string) => {
    try {
      await window.ipcRenderer?.invoke('downloader:cancel', jobId);
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: 'cancelled', error: 'Download cancelled by user' } : j))
      );
    } catch (_) {}
  }, []);

  // Remove job from list
  const removeJob = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  }, []);

  // Clear completed/cancelled/failed
  const clearCompleted = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status === 'downloading' || j.status === 'merging' || j.status === 'queued'));
  }, []);

  // Update settings
  const updateSettings = useCallback((partial: Partial<DownloadSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  // Trigger yt-dlp update
  const updateEngine = useCallback(async () => {
    setIsUpdatingEngine(true);
    try {
      const res = (await window.ipcRenderer?.invoke('downloader:update-binary')) as { success: boolean; message: string };
      // Refresh status
      const status = (await window.ipcRenderer?.invoke('downloader:check-status')) as any;
      if (status) {
        setEngineStatus({ installed: status.installed, version: status.version });
      }
      return res;
    } finally {
      setIsUpdatingEngine(false);
    }
  }, []);

  return {
    urlInput,
    setUrlInput,
    isProbing,
    probeResult,
    selectedFormat,
    setSelectedFormat,
    probeError,
    setProbeError,
    jobs,
    settings,
    engineStatus,
    isUpdatingEngine,
    probeUrl,
    startDownload,
    cancelJob,
    removeJob,
    clearCompleted,
    updateSettings,
    updateEngine,
  };
}
