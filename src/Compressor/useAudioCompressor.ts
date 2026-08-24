import { useState, useCallback, useRef, useEffect } from 'react';
import { useMediaContext } from '@/Provider/MediaContext';
import { useJobStore } from '@/Provider/JobStore';
import {
  AudioFileEntry,
  AudioCompressSettings,
  AudioProbeResult,
  CompressionProgress,
  CompressionResult,
  CompressionError,
  DEFAULT_SETTINGS,
} from '@/types/audioCompressor';
import { OutputFile } from '@/types/index';

function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

export interface UseAudioCompressorReturn {
  files: AudioFileEntry[];
  globalSettings: AudioCompressSettings;
  outputDir: string;
  useHWAccel: boolean;
  isCompressingAll: boolean;
  addFiles: (rawFiles: FileList | File[]) => void;
  removeFile: (id: string) => void;
  clearAll: () => void;
  updateGlobalSettings: (patch: Partial<AudioCompressSettings>) => void;
  updateFileSettings: (id: string, patch: Partial<AudioCompressSettings>) => void;
  toggleCustomSettings: (id: string) => void;
  applyGlobalToAll: () => void;
  compressFile: (id: string) => void;
  compressAll: () => void;
  cancelFile: (id: string) => void;
  setOutputDir: (dir: string) => void;
  pickOutputDir: () => void;
  setUseHWAccel: (v: boolean) => void;
  openOutputFolder: (folder: string) => void;
  revealFile: (filePath: string) => void;
  saveFile: (file: AudioFileEntry) => Promise<void>;
  saveFileAs: (file: AudioFileEntry) => Promise<void>;
  saveAll: () => Promise<void>;
}

export function useAudioCompressor(): UseAudioCompressorReturn {
  const { mediaList, addMediaFiles, removeMediaItem, clearAllMedia, addOutputFile } = useMediaContext();
  const { reportJob, clearJob } = useJobStore();

  const [files, setFiles] = useState<AudioFileEntry[]>([]);
  const [globalSettings, setGlobalSettings] = useState<AudioCompressSettings>(DEFAULT_SETTINGS);
  const [outputDir, setOutputDirState] = useState<string>('');
  const [useHWAccel, setUseHWAccelState] = useState(false);
  const [isCompressingAll, setIsCompressingAll] = useState(false);

  // Track active compression jobs for cancellation
  const activeIds = useRef<Set<string>>(new Set());

  // ── Initialize Default Output Directory (AUVID/Audio) ────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('auvid_custom_audio_output_dir');
    if (saved) {
      setOutputDirState(saved);
    } else {
      window.ipcRenderer
        ?.invoke('audio:get-default-output-dir')
        .then((dirs: unknown) => {
          if (dirs && typeof dirs === 'object' && 'audioDir' in dirs) {
            setOutputDirState((dirs as { audioDir: string }).audioDir);
          }
        })
        .catch(() => {});
    }
  }, []);

  // ── Sync with central MediaContext mediaList ─────────────────────────────
  useEffect(() => {
    const AUDIO_EXTS = new Set([
      'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma',
      'ac3', 'aiff', 'aif', 'alac', 'amr', 'ape', 'dts', 'mpeg', 'mpg', 'mp2', 'mp1',
    ]);

    const audioItems = mediaList.filter(m => {
      const ext = m.name.split('.').pop()?.toLowerCase() ?? '';
      return m.type === 'audio' || AUDIO_EXTS.has(ext);
    });

    setFiles(prev => {
      const missing = audioItems.filter(item => !prev.some(f => f.path === item.path || f.id === item.id));
      const remaining = prev.filter(f => audioItems.some(item => item.path === f.path || item.id === f.id));

      if (missing.length === 0) {
        if (remaining.length === prev.length) return prev;
        return remaining;
      }

      const newEntries: AudioFileEntry[] = missing.map(item => ({
        id: item.id || uid(),
        name: item.name,
        path: item.path,
        size: item.size,
        format: item.format || (item.name.split('.').pop() ?? '').toUpperCase(),
        status: 'queued' as const,
        progress: 0,
        customSettings: false,
        settings: { ...globalSettings },
      }));

      // Trigger background probe for newEntries
      const ipc = window.ipcRenderer;
      if (ipc) {
        newEntries.forEach(async (entry) => {
          try {
            const probe = await ipc.invoke('audio:probe', entry.path, entry.id) as AudioProbeResult;
            setFiles(current => current.map(f => (f.id === entry.id ? { ...f, probe } : f)));
          } catch (_) { /* probe failed — still usable */ }
        });
      }

      return [...remaining, ...newEntries];
    });
  }, [mediaList, globalSettings]);

  // ── IPC Event Listeners ───────────────────────────────────────────────────
  useEffect(() => {
    const ipc = window.ipcRenderer;
    if (!ipc) return;

    const onProgress = (_: unknown, data: CompressionProgress) => {
      const pct = Math.min(100, Math.max(0, data.percent));
      reportJob('audio-compress', {
        status: 'processing',
        progress: pct,
        label: `Compressing audio (${Math.round(pct)}%)`,
      });

      setFiles(prev =>
        prev.map(f =>
          f.id === data.fileId
            ? { ...f, progress: data.percent, status: 'processing' }
            : f,
        ),
      );
    };

    const onDone = (_: unknown, data: CompressionResult) => {
      activeIds.current.delete(data.fileId);
      if (activeIds.current.size === 0) {
        clearJob('audio-compress');
      }
      setFiles(prev =>
        prev.map(f =>
          f.id === data.fileId
            ? { ...f, progress: 100, status: 'done', result: data }
            : f,
        ),
      );
    };

    const onError = (_: unknown, data: CompressionError) => {
      activeIds.current.delete(data.fileId);
      if (activeIds.current.size === 0) {
        clearJob('audio-compress');
      }
      setFiles(prev =>
        prev.map(f =>
          f.id === data.fileId
            ? { ...f, status: 'error', errorMessage: data.message }
            : f,
        ),
      );
    };

    ipc.on('audio:compress-progress', onProgress);
    ipc.on('audio:compress-done', onDone);
    ipc.on('audio:compress-error', onError);

    return () => {
      ipc.off('audio:compress-progress', onProgress);
      ipc.off('audio:compress-done', onDone);
      ipc.off('audio:compress-error', onError);
    };
  }, [reportJob, clearJob]);

  // ── Add files (via central MediaContext) ──────────────────────────────────
  const addFiles = useCallback(
    (rawFiles: FileList | File[]) => {
      addMediaFiles(rawFiles);
    },
    [addMediaFiles],
  );

  // ── Remove / clear ──────────────────────────────────────────────────────────
  const removeFile = useCallback((id: string) => {
    removeMediaItem(id);
    setFiles(prev => prev.filter(f => f.id !== id));
  }, [removeMediaItem]);

  const clearAll = useCallback(() => {
    for (const id of activeIds.current) {
      window.ipcRenderer?.invoke('audio:cancel', id);
    }
    activeIds.current.clear();
    clearAllMedia();
    setFiles([]);
  }, [clearAllMedia]);

  // ── Settings ────────────────────────────────────────────────────────────────
  const updateGlobalSettings = useCallback((patch: Partial<AudioCompressSettings>) => {
    setGlobalSettings(prev => {
      const next = { ...prev, ...patch };
      setFiles(filesPrev =>
        filesPrev.map(f => (f.customSettings ? f : { ...f, settings: { ...next } })),
      );
      return next;
    });
  }, []);

  const updateFileSettings = useCallback((id: string, patch: Partial<AudioCompressSettings>) => {
    setFiles(prev =>
      prev.map(f =>
        f.id === id
          ? { ...f, customSettings: true, settings: { ...f.settings, ...patch } }
          : f,
      ),
    );
  }, []);

  const toggleCustomSettings = useCallback((id: string) => {
    setFiles(prev =>
      prev.map(f => {
        if (f.id !== id) return f;
        const nextCustom = !f.customSettings;
        return {
          ...f,
          customSettings: nextCustom,
          settings: nextCustom ? { ...f.settings } : { ...globalSettings },
        };
      }),
    );
  }, [globalSettings]);

  const applyGlobalToAll = useCallback(() => {
    setFiles(prev =>
      prev.map(f => ({
        ...f,
        customSettings: false,
        settings: { ...globalSettings },
      })),
    );
  }, [globalSettings]);

  // ── Output Directory ────────────────────────────────────────────────────────
  const pickOutputDir = useCallback(async () => {
    const ipc = window.ipcRenderer;
    if (!ipc) return;
    try {
      const dir = (await ipc.invoke('audio:select-output-dir')) as string | null;
      if (dir) {
        setOutputDirState(dir);
        localStorage.setItem('auvid_custom_audio_output_dir', dir);
      }
    } catch (_) { /* ignore */ }
  }, []);

  const openOutputFolder = useCallback((folder: string) => {
    window.ipcRenderer?.invoke('shell:open-folder', folder);
  }, []);

  const revealFile = useCallback((filePath: string) => {
    window.ipcRenderer?.invoke('shell:reveal-file', filePath);
  }, []);

  // ── Compression triggers ──────────────────────────────────────────────────
  const compressFile = useCallback(
    (id: string) => {
      const ipc = window.ipcRenderer;
      if (!ipc) return;

      const file = files.find(f => f.id === id);
      if (!file || file.status === 'processing') return;

      activeIds.current.add(id);

      setFiles(prev =>
        prev.map(f => (f.id === id ? { ...f, status: 'processing', progress: 0 } : f)),
      );

      ipc.invoke('audio:compress', {
        fileId: file.id,
        inputPath: file.path,
        outputDir: outputDir || '',
        outputFormat: file.settings.outputFormat,
        mode: file.settings.mode,
        qualityLevel: file.settings.qualityLevel,
        bitrate: file.settings.bitrate,
        bitrateMode: file.settings.bitrateMode,
        targetSizeMB: file.settings.targetSizeMB,
        percentageReduction: file.settings.percentageReduction,
        sampleRate: file.settings.sampleRate ?? null,
        channels: file.settings.channels ?? null,
        useHWAccel,
        probedDuration: file.probe?.duration,
        probedBitrate: file.probe?.bitrate,
      });
    },
    [files, outputDir, useHWAccel],
  );

  const compressAll = useCallback(async () => {
    const ipc = window.ipcRenderer;
    if (!ipc) return;

    const queued = files.filter(f => f.status === 'queued' || f.status === 'error');
    if (queued.length === 0) return;

    setIsCompressingAll(true);

    // Mark all queued files as processing immediately
    queued.forEach(f => activeIds.current.add(f.id));
    setFiles(prev =>
      prev.map(f => (queued.some(q => q.id === f.id) ? { ...f, status: 'processing', progress: 0 } : f)),
    );

    // Launch all compression jobs concurrently in parallel
    await Promise.all(
      queued.map(async file => {
        try {
          await ipc.invoke('audio:compress', {
            fileId: file.id,
            inputPath: file.path,
            outputDir: outputDir || '',
            outputFormat: file.settings.outputFormat,
            mode: file.settings.mode,
            qualityLevel: file.settings.qualityLevel,
            bitrate: file.settings.bitrate,
            bitrateMode: file.settings.bitrateMode,
            targetSizeMB: file.settings.targetSizeMB,
            percentageReduction: file.settings.percentageReduction,
            sampleRate: file.settings.sampleRate ?? null,
            channels: file.settings.channels ?? null,
            useHWAccel,
            probedDuration: file.probe?.duration,
            probedBitrate: file.probe?.bitrate,
          });
        } catch (_) {
          /* logged via error event */
        }
      }),
    );

    setIsCompressingAll(false);
  }, [files, outputDir, useHWAccel]);

  const cancelFile = useCallback((id: string) => {
    window.ipcRenderer?.invoke('audio:cancel', id);
    activeIds.current.delete(id);
    setFiles(prev =>
      prev.map(f => (f.id === id ? { ...f, status: 'queued', progress: 0 } : f)),
    );
  }, []);

  // ── Manual Save (single file) ────────────────────────────────────────────
  const saveFile = useCallback(async (file: AudioFileEntry) => {
    const ipc = window.ipcRenderer;
    if (!ipc || !file.result?.outputPath) return;
    try {
      const res = await ipc.invoke('audio:save-file', {
        fileId: file.id,
        stagedPath: file.result.outputPath,
        outputDir: outputDir || '',
        format: file.settings.outputFormat,
        originalName: file.name,
      }) as { success?: boolean; savedPath?: string; error?: string };

      if (res?.success && res.savedPath) {
        setFiles(prev => prev.map(f =>
          f.id === file.id ? { ...f, isSaved: true, savedPath: res.savedPath } : f
        ));
        addOutputFile({
          id: `out_${file.id}_${Date.now()}`,
          name: file.name.replace(/\.[^.]+$/, '') + '_compressed.' + file.settings.outputFormat,
          savedPath: res.savedPath,
          originalName: file.name,
          size: file.result?.compressedSize ?? 0,
          originalSize: file.size,
          format: file.settings.outputFormat.toUpperCase(),
          type: 'audio',
          tool: 'audio-compress',
          savedAt: new Date().toLocaleTimeString(),
          savedAtMs: Date.now(),
        });
      } else if (res?.error) {
        console.error('[saveFile] Error:', res.error);
      }
    } catch (err) {
      console.error('[saveFile] IPC error:', err);
    }
  }, [outputDir, addOutputFile]);

  // ── Save As (system dialog) ───────────────────────────────────────────────
  const saveFileAs = useCallback(async (file: AudioFileEntry) => {
    const ipc = window.ipcRenderer;
    if (!ipc || !file.result?.outputPath) return;
    try {
      const res = await ipc.invoke('audio:save-file-dialog', {
        fileId: file.id,
        stagedPath: file.result.outputPath,
        format: file.settings.outputFormat,
        originalName: file.name,
      }) as { success?: boolean; savedPath?: string; cancelled?: boolean; error?: string };

      if (res?.success && res.savedPath) {
        setFiles(prev => prev.map(f =>
          f.id === file.id ? { ...f, isSaved: true, savedPath: res.savedPath } : f
        ));
        addOutputFile({
          id: `out_${file.id}_${Date.now()}`,
          name: file.name.replace(/\.[^.]+$/, '') + '_compressed.' + file.settings.outputFormat,
          savedPath: res.savedPath,
          originalName: file.name,
          size: file.result?.compressedSize ?? 0,
          originalSize: file.size,
          format: file.settings.outputFormat.toUpperCase(),
          type: 'audio',
          tool: 'audio-compress',
          savedAt: new Date().toLocaleTimeString(),
          savedAtMs: Date.now(),
        });
      }
    } catch (err) {
      console.error('[saveFileAs] IPC error:', err);
    }
  }, [addOutputFile]);

  // ── Save All (batch) ─────────────────────────────────────────────────────
  const saveAll = useCallback(async () => {
    const ipc = window.ipcRenderer;
    if (!ipc) return;

    const unsaved = files.filter(f => f.status === 'done' && f.result?.outputPath && !f.isSaved);
    if (unsaved.length === 0) return;

    try {
      const res = await ipc.invoke('audio:save-all', {
        items: unsaved.map(f => ({
          fileId: f.id,
          stagedPath: f.result!.outputPath,
          format: f.settings.outputFormat,
          originalName: f.name,
        })),
        outputDir: outputDir || '',
      }) as { success?: boolean; results?: Array<{ fileId: string; savedPath: string }>; error?: string };

      if (res?.success && res.results) {
        const savedMap = new Map(res.results.map(r => [r.fileId, r.savedPath]));
        setFiles(prev => prev.map(f => {
          if (!savedMap.has(f.id)) return f;
          const sp = savedMap.get(f.id)!;
          addOutputFile({
            id: `out_${f.id}_${Date.now()}`,
            name: f.name.replace(/\.[^.]+$/, '') + '_compressed.' + f.settings.outputFormat,
            savedPath: sp,
            originalName: f.name,
            size: f.result?.compressedSize ?? 0,
            originalSize: f.size,
            format: f.settings.outputFormat.toUpperCase(),
            type: 'audio',
            tool: 'audio-compress',
            savedAt: new Date().toLocaleTimeString(),
            savedAtMs: Date.now(),
          });
          return { ...f, isSaved: true, savedPath: sp };
        }));
      }
    } catch (err) {
      console.error('[saveAll] IPC error:', err);
    }
  }, [files, outputDir, addOutputFile]);

  return {
    files,
    globalSettings,
    outputDir,
    useHWAccel,
    isCompressingAll,
    addFiles,
    removeFile,
    clearAll,
    updateGlobalSettings,
    updateFileSettings,
    toggleCustomSettings,
    applyGlobalToAll,
    compressFile,
    compressAll,
    cancelFile,
    setOutputDir: setOutputDirState,
    pickOutputDir,
    setUseHWAccel: setUseHWAccelState,
    openOutputFolder,
    revealFile,
    saveFile,
    saveFileAs,
    saveAll,
  };
}
