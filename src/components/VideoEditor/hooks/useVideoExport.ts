// ─── useVideoExport.ts ────────────────────────────────────────────────────────
// Handles all export operations:
//   - Single-clip trim/cut export (enhanced with color, BGM, canvas, transforms)
//   - Multi-clip sequence concat export
//   - Audio track extraction
//   - Export cancellation
//   - IPC progress listener → floating job reporter

import { useState, useEffect, useCallback } from 'react';
import { useJobStore } from '@/Provider/JobStore';
import type {
  ExportStatus, AudioExtractFormat,
  EnhancedExportOptions, SequenceExportOptions,
} from '../types';

export function useVideoExport() {
  const { reportJob, clearJob } = useJobStore();

  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [isOverwritten, setIsOverwritten] = useState(false);

  // ── IPC progress listener ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (_event: unknown, data: { percent?: number }) => {
      if (typeof data?.percent === 'number') {
        const pct = Math.min(100, Math.max(0, data.percent));
        setExportProgress(pct);
        reportJob('video-cut', {
          status: 'processing',
          progress: pct,
          label: `Exporting video (${Math.round(pct)}%)`,
        });
      }
    };
    window.ipcRenderer?.on?.('video:progress', handler);
    return () => {
      window.ipcRenderer?.off?.('video:progress', handler);
    };
  }, [reportJob]);

  // ── Execute single-clip enhanced export ───────────────────────────────────
  const handleExecuteExport = useCallback(
    async (options: EnhancedExportOptions, saveMode: 'new-file' | 'in-place') => {
      setExportStatus('exporting');
      setExportProgress(0);
      setIsOverwritten(false);
      reportJob('video-cut', { status: 'processing', progress: 0, label: 'Exporting video…' });

      try {
        const result = (await window.ipcRenderer?.invoke('video:export', options)) as {
          outputPath: string;
          overwritten: boolean;
          newSize?: number;
          newDuration?: number;
        } | null;

        if (result?.overwritten) {
          setExportPath(result.outputPath);
          setIsOverwritten(true);
        } else {
          setExportPath(result?.outputPath ?? null);
          setIsOverwritten(false);
        }
        setExportStatus('done');
        clearJob('video-cut');

        return result;
      } catch (err) {
        console.error('[useVideoExport] Export error:', err);
        setExportStatus('error');
        reportJob('video-cut', { status: 'error', progress: 0, label: 'Export failed' });
        return null;
      }
    },
    [reportJob, clearJob],
  );

  // ── Execute multi-clip sequence export ────────────────────────────────────
  const handleExportSequence = useCallback(
    async (options: SequenceExportOptions) => {
      if (!options.clips.length) return null;
      setExportStatus('exporting');
      setExportProgress(0);
      reportJob('video-cut', { status: 'processing', progress: 0, label: 'Exporting sequence…' });

      try {
        const result = (await window.ipcRenderer?.invoke(
          'video:export-sequence',
          options,
        )) as { outputPath: string; newSize?: number } | null;

        setExportPath(result?.outputPath ?? null);
        setIsOverwritten(false);
        setExportStatus('done');
        clearJob('video-cut');
        return result;
      } catch (err) {
        console.error('[useVideoExport] Sequence export error:', err);
        setExportStatus('error');
        reportJob('video-cut', { status: 'error', progress: 0, label: 'Sequence export failed' });
        return null;
      }
    },
    [reportJob, clearJob],
  );

  // ── Extract audio from video ──────────────────────────────────────────────
  const handleExtractAudio = useCallback(
    async (
      inputPath: string,
      format: AudioExtractFormat = 'mp3',
      inPoint?: number,
      outPoint?: number,
    ) => {
      setExportStatus('extracting-audio');
      setExportProgress(0);

      try {
        const result = (await window.ipcRenderer?.invoke('video:extract-audio', {
          inputPath,
          format,
          inPoint,
          outPoint,
        })) as { outputPath: string; size?: number } | null;

        if (result?.outputPath) {
          setExportPath(result.outputPath);
          setIsOverwritten(false);
          setExportStatus('done');
        }
        return result;
      } catch (err) {
        console.error('[useVideoExport] Audio extract error:', err);
        setExportStatus('error');
        return null;
      }
    },
    [],
  );

  // ── Cancel active export ──────────────────────────────────────────────────
  const handleCancelExport = useCallback(async () => {
    try {
      await window.ipcRenderer?.invoke('video:cancel');
    } catch (_) {}
    setExportStatus('idle');
    setExportProgress(0);
    clearJob('video-cut');
  }, [clearJob]);

  // ── Dismiss done/error status ─────────────────────────────────────────────
  const resetExportStatus = useCallback(() => {
    setExportStatus('idle');
    setExportProgress(0);
    setExportPath(null);
  }, []);

  const isExporting =
    exportStatus === 'exporting' || exportStatus === 'extracting-audio';

  return {
    exportStatus,
    exportProgress,
    exportPath,
    isOverwritten,
    isExporting,
    handleExecuteExport,
    handleExportSequence,
    handleExtractAudio,
    handleCancelExport,
    resetExportStatus,
  };
}
