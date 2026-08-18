// ─── useFormatConverter.ts ──────────────────────────────────────────────────
// React hook managing format converter queue, settings, probes, and batch jobs.

import { useState, useEffect, useCallback } from 'react';
import {
  ConverterFileEntry,
  ConverterSettings,
  ConverterProbeInfo,
  TargetFormat,
} from '@/types/formatConverter';

const DEFAULT_SETTINGS: ConverterSettings = {
  audioBitrate: 256,
  audioSampleRate: 44100,
  audioChannels: 'original',
  videoCodec: 'auto',
  videoCrf: 22,
  videoResolution: 'original',
  videoFps: 'original',
  useHWAccel: true,
  gifFps: 15,
  gifWidth: 480,
  gifQuality: 'high',
};

export function useFormatConverter() {
  const [files, setFiles] = useState<ConverterFileEntry[]>([]);
  const [globalTargetFormat, setGlobalTargetFormat] = useState<TargetFormat>('mp3');
  const [settings, setSettings] = useState<ConverterSettings>(DEFAULT_SETTINGS);
  const [isProcessing, setIsProcessing] = useState(false);

  // Listen to IPC real-time progress events
  useEffect(() => {
    const handler = (_event: unknown, data: {
      jobId: string;
      percent: number;
      timemark?: string;
      fps?: number;
      speed?: string;
    }) => {
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

    window.ipcRenderer?.on?.('converter:progress', handler);
    return () => {
      window.ipcRenderer?.off?.('converter:progress', handler);
    };
  }, []);

  // Add files & probe them
  const addFiles = useCallback(async (filePaths: string[]) => {
    if (!filePaths || filePaths.length === 0) return;

    const newEntries: ConverterFileEntry[] = filePaths.map((p) => {
      const name = p.split(/[\\/]/).pop() || p;
      return {
        id: crypto.randomUUID(),
        name,
        path: p,
        size: 0,
        probe: null,
        targetFormat: globalTargetFormat,
        status: 'probing',
        progress: 0,
      };
    });

    setFiles((prev) => {
      const existingPaths = new Set(prev.map((f) => f.path));
      const filtered = newEntries.filter((f) => !existingPaths.has(f.path));
      return [...prev, ...filtered];
    });

    // Probe asynchronously
    for (const entry of newEntries) {
      try {
        const probe = (await window.ipcRenderer?.invoke('converter:probe', entry.path)) as ConverterProbeInfo;
        // Smart default target: if video -> MP4, if audio -> MP3
        const smartTarget: TargetFormat = probe.type === 'video' ? 'mp4' : 'mp3';

        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? {
                  ...f,
                  size: probe.size || f.size,
                  probe,
                  targetFormat: smartTarget,
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
  }, [globalTargetFormat]);

  const setAllTargetFormats = useCallback((format: TargetFormat) => {
    setGlobalTargetFormat(format);
    setFiles((prev) =>
      prev.map((f) => ({
        ...f,
        targetFormat: format,
      }))
    );
  }, []);

  const updateFileFormat = useCallback((id: string, format: TargetFormat) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, targetFormat: format } : f))
    );
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
    async (entry: ConverterFileEntry) => {
      const activeSettings = entry.customSettings
        ? { ...settings, ...entry.customSettings }
        : settings;

      setIsProcessing(true);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id ? { ...f, status: 'converting', progress: 0, error: undefined } : f
        )
      );

      try {
        const result = (await window.ipcRenderer?.invoke('converter:process', {
          jobId: entry.id,
          params: {
            inputPath: entry.path,
            targetFormat: entry.targetFormat,
            settings: activeSettings,
          },
        })) as { outputPath: string; outputSize: number };

        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? {
                  ...f,
                  status: 'completed',
                  progress: 100,
                  convertedPath: result.outputPath,
                  convertedSize: result.outputSize,
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
                  error: err.message || 'Conversion failed',
                }
              : f
          )
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [settings]
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
  }, [files, processSingle]);

  const cancelJob = useCallback(async (jobId: string) => {
    try {
      await window.ipcRenderer?.invoke('converter:cancel', jobId);
      setFiles((prev) =>
        prev.map((f) => (f.id === jobId ? { ...f, status: 'cancelled' } : f))
      );
    } catch (_) {}
  }, []);

  return {
    files,
    settings,
    setSettings,
    globalTargetFormat,
    setAllTargetFormats,
    updateFileFormat,
    isProcessing,
    addFiles,
    removeFile,
    clearCompleted,
    clearAll,
    processSingle,
    processBatch,
    cancelJob,
  };
}
