import { useState, useEffect, useCallback, useRef } from 'react';
import { useJobStore } from '@/Provider/JobStore';
import {
  VideoCompressFileEntry,
  VideoCompressSettings,
  VideoProbeInfo,
  HWAccelInfo,
} from '@/types/videoCompressor';

const DEFAULT_SETTINGS: VideoCompressSettings = {
  mode: 'targetSize',
  percentageReduction: 60,
  targetSizeMB: 8.0,
  targetSizeUnit: 'MB',
  crf: 24,
  videoBitrateKbps: 1500,
  twoPass: false,
  codec: 'h264',
  container: 'mp4',
  resolution: 'original',
  fps: 'original',
  audioCodec: 'aac',
  audioBitrateKbps: 128,
  audioChannels: 'original',
  speedPreset: 'medium',
  useHWAccel: true,
};

export function useVideoCompressor() {
  const { reportJob, clearJob } = useJobStore();
  const [files, setFiles] = useState<VideoCompressFileEntry[]>([]);
  const [settings, setSettings] = useState<VideoCompressSettings>(DEFAULT_SETTINGS);
  const [hwInfo, setHwInfo] = useState<HWAccelInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // Check Hardware Acceleration on mount
  useEffect(() => {
    (async () => {
      try {
        const info = (await window.ipcRenderer?.invoke('video-compress:check-hwaccel')) as HWAccelInfo;
        if (info) setHwInfo(info);
      } catch (_) {}
    })();
  }, []);

  // Listen to IPC real-time progress events
  useEffect(() => {
    const handler = (_event: unknown, data: {
      jobId: string;
      percent: number;
      timemark?: string;
      fps?: number;
      speed?: string;
    }) => {
      const pct = Math.min(100, Math.max(0, data.percent));
      reportJob('video-compress', {
        status: 'processing',
        progress: pct,
        label: `Compressing video (${Math.round(pct)}%)`,
      });

      setFiles((prev) =>
        prev.map((f) => {
          if (f.id === data.jobId) {
            return {
              ...f,
              progress: data.percent,
              timemark: data.timemark,
              fps: data.fps,
              speed: data.speed,
            };
          }
          return f;
        })
      );
    };

    window.ipcRenderer?.on?.('video-compress:progress', handler);
    return () => {
      window.ipcRenderer?.off?.('video-compress:progress', handler);
    };
  }, [reportJob]);

  // Add video files & probe them asynchronously
  const addFiles = useCallback(async (filePaths: string[]) => {
    if (!filePaths || filePaths.length === 0) return;

    const newEntries: VideoCompressFileEntry[] = filePaths.map((p) => {
      const name = p.split(/[\\/]/).pop() || p;
      return {
        id: crypto.randomUUID(),
        name,
        path: p,
        size: 0,
        probe: null,
        status: 'probing',
        progress: 0,
      };
    });

    setFiles((prev) => {
      const existingPaths = new Set(prev.map((f) => f.path));
      const filtered = newEntries.filter((f) => !existingPaths.has(f.path));
      return [...prev, ...filtered];
    });

    // Probe each file in background
    for (const entry of newEntries) {
      try {
        const probe = (await window.ipcRenderer?.invoke('video-compress:probe', entry.path)) as VideoProbeInfo;
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? {
                  ...f,
                  size: probe.size || f.size,
                  probe,
                  status: 'idle',
                }
              : f
          )
        );
      } catch (err: any) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? {
                  ...f,
                  status: 'failed',
                  error: err.message || 'Probe failed',
                }
              : f
          )
        );
      }
    }
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setFiles((prev) => prev.filter((f) => f.status !== 'completed'));
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
  }, []);

  // Process a single file
  const processSingle = useCallback(
    async (entry: VideoCompressFileEntry, customSettings?: VideoCompressSettings) => {
      const activeSettings = customSettings || entry.settingsOverride
        ? { ...settings, ...(entry.settingsOverride || {}) }
        : settings;

      setIsProcessing(true);
      setCurrentJobId(entry.id);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id ? { ...f, status: 'compressing', progress: 0, error: undefined } : f
        )
      );

      try {
        let targetSizeBytes = 0;
        if (activeSettings.mode === 'targetSize') {
          const mult = activeSettings.targetSizeUnit === 'KB' ? 1024 : 1024 * 1024;
          targetSizeBytes = activeSettings.targetSizeMB * mult;
        }

        const result = (await window.ipcRenderer?.invoke('video-compress:process', {
          jobId: entry.id,
          params: {
            inputPath: entry.path,
            mode: activeSettings.mode,
            percentageReduction: activeSettings.percentageReduction,
            targetSizeBytes,
            crf: activeSettings.crf,
            videoBitrateKbps: activeSettings.videoBitrateKbps,
            twoPass: activeSettings.twoPass,
            codec: activeSettings.codec,
            container: activeSettings.container,
            resolution: activeSettings.resolution,
            fps: activeSettings.fps,
            audioCodec: activeSettings.audioCodec,
            audioBitrateKbps: activeSettings.audioBitrateKbps,
            audioChannels: activeSettings.audioChannels,
            speedPreset: activeSettings.speedPreset,
            useHWAccel: activeSettings.useHWAccel,
          },
        })) as { outputPath: string; outputSize: number };

        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? {
                  ...f,
                  status: 'completed',
                  progress: 100,
                  compressedPath: result.outputPath,
                  compressedSize: result.outputSize,
                }
              : f
          )
        );
      } catch (err: any) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? {
                  ...f,
                  status: 'failed',
                  error: err.message || 'Compression failed',
                }
              : f
          )
        );
      } finally {
        setIsProcessing(false);
        setCurrentJobId(null);
        clearJob('video-compress');
      }
    },
    [settings, clearJob]
  );

  // Process all files in queue sequentially
  const processBatch = useCallback(async () => {
    const pending = files.filter((f) => f.status === 'idle' || f.status === 'failed');
    if (pending.length === 0) return;

    setIsProcessing(true);
    for (const file of pending) {
      await processSingle(file);
    }
    setIsProcessing(false);
    clearJob('video-compress');
  }, [files, processSingle, clearJob]);

  const cancelJob = useCallback(async (jobId: string) => {
    try {
      await window.ipcRenderer?.invoke('video-compress:cancel', jobId);
      setFiles((prev) =>
        prev.map((f) => (f.id === jobId ? { ...f, status: 'cancelled' } : f))
      );
    } catch (_) {}
  }, []);

  return {
    files,
    settings,
    setSettings,
    hwInfo,
    isProcessing,
    currentJobId,
    addFiles,
    removeFile,
    clearCompleted,
    clearAll,
    processSingle,
    processBatch,
    cancelJob,
  };
}
