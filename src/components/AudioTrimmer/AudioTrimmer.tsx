// ─── Audio Trimmer & Waveform Studio ──────────────────────────────────────────
// Full-featured waveform editor with interactive trim handles, fade envelopes,
// gain control, playback, and lossless FFmpeg export.

import React, {
  useState, useRef, useEffect, useCallback,
} from 'react';
import {
  Play, Pause, Square, SkipBack, SkipForward,
  Volume2, Scissors, Upload, FolderOpen,
  RotateCcw, Loader2, AlertCircle, Music,
  ChevronRight, Waves, Download, RefreshCw,
  Repeat, ArrowRight, CheckCircle2, Sliders
} from 'lucide-react';
import { useTheme } from '@/Provider/Theme';
import { WaveformCanvas, formatTime, formatDurationHuman } from './WaveformCanvas';
import { useWaveformDecoder, filePathToMediaUrl, ensurePlaybackBuffer, getSharedAudioContext } from './useWaveformDecoder';
import { AudioTrimConfirmModal } from './AudioTrimConfirmModal';
import type { WaveformRegion, WaveformFades } from './WaveformCanvas';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface TrimFile {
  id: string;
  name: string;
  path: string;
  size: number;
  duration: number;
  coverArt?: string | null;
}

type ExportStatus = 'idle' | 'exporting' | 'done' | 'error';

const AUDIO_EXTS = new Set([
  'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'aiff', 'alac', 'ac3',
]);

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Timecode Input ────────────────────────────────────────────────────────────
const TimecodeInput: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  max: number;
  accentColor: string;
}> = ({ label, value, onChange, max, accentColor }) => {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const display = formatTime(value);

  const commit = () => {
    // parse hh:mm:ss.d, mm:ss.d, or ss.d
    const parts = raw.trim().split(':');
    let secs = 0;
    if (parts.length === 3) {
      secs = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      secs = parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
    } else {
      secs = parseFloat(parts[0]);
    }
    if (!isNaN(secs)) onChange(clamp(secs, 0, max));
    setEditing(false);
  };

  return (
    <div className="flex flex-col items-center space-y-1">
      <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {editing ? (
        <input
          autoFocus
          className="w-24 text-center text-sm font-mono font-bold bg-transparent border-b-2 border-solid border-t-0 border-x-0 focus:outline-none text-zinc-900 dark:text-zinc-100 py-0.5"
          style={{ borderColor: accentColor }}
          defaultValue={display}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        />
      ) : (
        <button
          onClick={() => { setRaw(display); setEditing(true); }}
          className="text-sm font-mono font-bold text-zinc-900 dark:text-zinc-100 hover:opacity-70 transition-opacity cursor-text"
        >
          {display}
        </button>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const AudioTrimmer: React.FC = () => {
  const { accentColor, isDarkMode } = useTheme();

  // ── File list ──────────────────────────────────────────────────────────────
  const [files, setFiles] = useState<TrimFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFile = files.find(f => f.id === selectedId) ?? null;

  // ── Waveform & audio ───────────────────────────────────────────────────────
  const { peaks, audioBuffer, info, isLoading, isRefining, error, cachedPaths, reload, prefetch } = useWaveformDecoder(
    selectedFile?.path ?? null,
  );

  const duration = info?.duration ?? audioBuffer?.duration ?? selectedFile?.duration ?? 0;

  // ── Background loader for cover art thumbnails ────────────────────────────
  useEffect(() => {
    let active = true;
    files.forEach(async (f) => {
      if (f.coverArt === undefined) {
        try {
          const cover = (await window.ipcRenderer?.invoke('trim:get-cover', f.path)) as string | null;
          if (active && cover) {
            setFiles((prev) =>
              prev.map((item) => (item.id === f.id ? { ...item, coverArt: cover } : item))
            );
          }
        } catch (_) {}
      }
    });
    return () => {
      active = false;
    };
  }, [files]);

  // ── Prefetch adjacent files ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId || files.length < 2) return;
    const idx = files.findIndex(f => f.id === selectedId);
    if (idx === -1) return;
    // Prefetch next and previous
    const neighbors = [files[idx + 1], files[idx - 1]].filter(Boolean);
    neighbors.forEach(f => prefetch(f.path));
  }, [selectedId, files, prefetch]);

  // ── Trim region & fades ────────────────────────────────────────────────────
  const [region, setRegion] = useState<WaveformRegion>({ inPoint: 0, outPoint: 0 });
  const [fades, setFades] = useState<WaveformFades>({ fadeInDuration: 0, fadeOutDuration: 0 });
  const [gain, setGain] = useState(1.0); // 0.1 – 3.0

  // ── Trimming Mode & Target ─────────────────────────────────────────────────
  // 'new-file': Crop to save as new file in output directory
  // 'in-place': Crop in place to edit the existing file directly
  const [saveMode, setSaveMode] = useState<'new-file' | 'in-place'>('new-file');
  // 'keep': Crop to keep selected range
  // 'delete': Crop to remove selected range
  const [cutAction, setCutAction] = useState<'keep' | 'delete'>('keep');

  // Keep a live ref to region so dynamic handle adjustments don't restart playback effects
  const regionRef = useRef(region);
  useEffect(() => {
    regionRef.current = region;
  }, [region]);

  // Reset region ONLY when a genuinely new file is selected
  const lastLoadedFileIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedId && selectedId !== lastLoadedFileIdRef.current && duration > 0) {
      lastLoadedFileIdRef.current = selectedId;
      setRegion({ inPoint: 0, outPoint: duration });
      setFades({ fadeInDuration: 0, fadeOutDuration: 0 });
      setGain(1.0);
    }
  }, [selectedId, duration]);

  // ── Native Streaming Audio Playback Engine (0ms Instant Start) ───────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  // Initialize and synchronize audio element with selected file
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.pause();
    isPlayingRef.current = false;
    setIsPlaying(false);

    if (selectedFile?.path) {
      audio.src = filePathToMediaUrl(selectedFile.path);
      audio.currentTime = 0;
      setPlayhead(0);
    } else {
      audio.removeAttribute('src');
    }

    return () => {
      audio.pause();
    };
  }, [selectedFile?.path]);

  // Volume / gain live update
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.min(1.0, Math.max(0, gain > 1 ? 1 : gain));
    }
  }, [gain]);

  const stopPlayback = useCallback((resetHead = false) => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      if (resetHead) {
        audio.currentTime = regionRef.current.inPoint;
      }
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (resetHead) {
      setPlayhead(regionRef.current.inPoint);
    }
  }, []);

  const startPlayback = useCallback((fromTime?: number) => {
    const audio = audioRef.current;
    if (!audio || !selectedFile) return;

    const curRegion = regionRef.current;
    const totalDur = duration > 0 ? duration : (audio.duration || 0);
    let end = curRegion.outPoint > curRegion.inPoint ? curRegion.outPoint : totalDur;
    if (end <= 0 || end > totalDur) end = totalDur;

    let targetTime = fromTime !== undefined ? fromTime : playhead;
    if (targetTime >= end - 0.05 || targetTime < curRegion.inPoint) {
      targetTime = curRegion.inPoint;
    }

    audio.currentTime = targetTime;
    setPlayhead(targetTime);

    audio.play()
      .then(() => {
        isPlayingRef.current = true;
        setIsPlaying(true);
      })
      .catch((err) => {
        console.warn('[AudioTrimmer] Playback prevented:', err);
        isPlayingRef.current = false;
        setIsPlaying(false);
      });
  }, [selectedFile, duration, playhead]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !selectedFile) return;

    if (!audio.paused) {
      audio.pause();
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else {
      startPlayback();
    }
  }, [selectedFile, startPlayback]);

  // 60FPS Smooth Playhead Tracker & Live Dynamic Boundary Watcher
  useEffect(() => {
    let animId: number;
    const track = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused && !isDraggingRef.current) {
        const cur = audio.currentTime;
        const curRegion = regionRef.current;
        const totalDur = duration > 0 ? duration : (audio.duration || 0);
        let end = curRegion.outPoint > curRegion.inPoint ? curRegion.outPoint : totalDur;
        if (end <= 0 || end > totalDur) end = totalDur;

        if (cur >= end) {
          if (isLooping) {
            audio.currentTime = curRegion.inPoint;
            audio.play().catch(() => {});
          } else {
            audio.pause();
            audio.currentTime = curRegion.inPoint;
            setPlayhead(curRegion.inPoint);
            isPlayingRef.current = false;
            setIsPlaying(false);
          }
        } else {
          setPlayhead(cur);
        }
      }
      animId = requestAnimationFrame(track);
    };
    animId = requestAnimationFrame(track);
    return () => cancelAnimationFrame(animId);
  }, [duration, isLooping]);

  // Stop on unmount
  useEffect(() => () => stopPlayback(true), [stopPlayback]);

  // ── File picking ───────────────────────────────────────────────────────────
  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files;
    if (!picked || picked.length === 0) return;

    // Single file upload only
    const f = picked[0];
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!AUDIO_EXTS.has(ext)) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const p = (window as unknown as { api?: { getPathForFile: (file: File) => string } }).api?.getPathForFile(f)
      || (f as unknown as { path?: string }).path
      || f.name;

    let dur = 0;
    let cover: string | null = null;
    try {
      const info = await window.ipcRenderer?.invoke('trim:get-info', p) as {
        duration: number;
        coverArt?: string | null;
      } | null;
      dur = info?.duration ?? 0;
      cover = info?.coverArt ?? null;
    } catch (_) {}

    const newFile: TrimFile = {
      id: crypto.randomUUID(),
      name: f.name,
      path: p,
      size: f.size,
      duration: dur,
      coverArt: cover,
    };

    stopPlayback(true);
    setFiles(prev => {
      if (prev.some(p => p.path === newFile.path)) return prev;
      return [...prev, newFile];
    });
    setSelectedId(newFile.id);

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [stopPlayback]);

  const handleBrowseFolder = useCallback(async () => {
    try {
      const result = (await window.ipcRenderer?.invoke('dialog:open-audio-file')) as string[] | null
        ?? (await window.ipcRenderer?.invoke('dialog:open-audio-files')) as string[] | null;
      if (!result || result.length === 0) return;

      const p = result[0];
      let dur = 0;
      let cover: string | null = null;
      try {
        const info = await window.ipcRenderer?.invoke('trim:get-info', p) as {
          duration: number;
          coverArt?: string | null;
        } | null;
        dur = info?.duration ?? 0;
        cover = info?.coverArt ?? null;
      } catch (_) {}

      const newFile: TrimFile = {
        id: crypto.randomUUID(),
        name: p.split(/[\\/]/).pop() ?? p,
        path: p,
        size: 0,
        duration: dur,
        coverArt: cover,
      };

      stopPlayback(true);
      setFiles(prev => {
        if (prev.some(item => item.path === newFile.path)) return prev;
        return [...prev, newFile];
      });
      setSelectedId(newFile.id);
    } catch (err) {
      console.error('[AudioTrimmer] Browse error:', err);
    }
  }, [stopPlayback]);

  // ── Export / Trim Execution ────────────────────────────────────────────────
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [isOverwritten, setIsOverwritten] = useState(false);
  const [outputFormat, setOutputFormat] = useState<string>('same');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Real-time export progress listener
  useEffect(() => {
    const handler = (_event: unknown, data: { percent?: number }) => {
      if (typeof data?.percent === 'number') {
        setExportProgress(Math.min(100, Math.max(0, data.percent)));
      }
    };
    window.ipcRenderer?.on?.('trim:progress', handler);
    return () => {
      window.ipcRenderer?.off?.('trim:progress', handler);
    };
  }, []);

  const handleExecuteTrim = useCallback(async (overrideMode?: 'new-file' | 'in-place') => {
    if (!selectedFile || duration <= 0) return;
    const modeToUse = overrideMode ?? saveMode;

    stopPlayback(true);
    setExportStatus('exporting');
    setExportProgress(0);
    setIsOverwritten(false);

    try {
      const result = await window.ipcRenderer?.invoke('trim:export', {
        inputPath: selectedFile.path,
        inPoint: region.inPoint,
        outPoint: region.outPoint,
        fadeInDuration: fades.fadeInDuration,
        fadeOutDuration: fades.fadeOutDuration,
        gain: gain,
        outputFormat: modeToUse === 'in-place' ? null : (outputFormat === 'same' ? null : outputFormat),
        saveTarget: modeToUse === 'in-place' ? 'overwrite-original' : 'new-file',
        cutMode: cutAction === 'delete' ? 'delete-selection' : 'keep-selection',
      }) as { outputPath: string; overwritten: boolean; newSize?: number; newDuration?: number } | null;

      if (result?.overwritten) {
        setExportPath(result.outputPath);
        setIsOverwritten(true);
        setExportStatus('done');

        // Update file entry in sidebar with new duration/size
        if (result.newDuration || result.newSize) {
          setFiles(prev => prev.map(f => f.id === selectedId ? {
            ...f,
            duration: result.newDuration ?? f.duration,
            size: result.newSize ?? f.size,
          } : f));
        }

        // Trigger waveform reload to reflect newly cropped audio
        reload();
      } else {
        setExportPath(result?.outputPath ?? null);
        setIsOverwritten(false);
        setExportStatus('done');
      }
    } catch (err) {
      console.error('[AudioTrimmer] Export error:', err);
      setExportStatus('error');
    }
  }, [selectedFile, duration, region, fades, gain, outputFormat, saveMode, cutAction, selectedId, reload, stopPlayback]);

  // ── Seek & Drag Handler ───────────────────────────────────────────────────
  const handleSeek = useCallback((time: number, isDragging = false) => {
    isDraggingRef.current = isDragging;
    const audio = audioRef.current;
    const totalDur = duration > 0 ? duration : (audio?.duration || 0);
    const clamped = Math.max(0, Math.min(totalDur > 0 ? totalDur : time, time));
    setPlayhead(clamped);

    if (audio) {
      if (!isNaN(clamped) && isFinite(clamped)) {
        try {
          audio.currentTime = clamped;
        } catch (_) {}
      }
      if (!isDragging && isPlayingRef.current && audio.paused) {
        audio.play().catch(() => {});
      }
    }
  }, [duration]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent">

      {/* ── Header ── */}
      <div className="px-8 pt-6 pb-4 shrink-0 flex items-center justify-between gap-4 border-b-0 border-solid border-x-0 border-t-0 border-zinc-200/80 dark:border-zinc-800/70">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2 border border-zinc-200/80 dark:border-zinc-800/80 bg-transparent backdrop-blur-md shadow-xs">
            <span style={{ color: accentColor }}>Waveform Studio</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 leading-tight tracking-tight">
            Audio Trimmer
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Cut, fade, and normalize audio with waveform precision
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleBrowseFolder}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-200 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Browse File</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Add File</span>
          </button>
        </div>
      </div>

      {/* ── Body: Left sidebar + Main canvas + Right controls ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ─── LEFT: File list (only shown when files are loaded) ─────────────────── */}
        {files.length > 0 && (
          <div className="w-56 shrink-0 flex flex-col border-r border-zinc-200/80 dark:border-zinc-800/70 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/60 dark:bg-zinc-900/40 shrink-0 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                Files ({files.length})
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                title="Add file"
              >
                + Add
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-zinc-100 dark:divide-zinc-800/40">
              {files.map(f => {
                const isCached = cachedPaths.has(f.path);
                const isSelected = f.id === selectedId;
                return (
                  <button
                    key={f.id}
                    onClick={() => { stopPlayback(true); setSelectedId(f.id); }}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-100 dark:bg-zinc-800/60'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'
                    }`}
                  >
                    {/* Cover art image or fallback Waves icon */}
                    <div
                      className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800"
                      style={{
                        backgroundColor: isSelected && !f.coverArt ? `${accentColor}22` : undefined,
                        color: isSelected && !f.coverArt ? accentColor : '#71717a',
                      }}
                    >
                      {f.coverArt ? (
                        <img
                          src={f.coverArt}
                          alt={f.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Waves className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight" title={f.name}>
                        {f.name}
                      </p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                        {f.duration > 0 ? formatTime(f.duration) : formatBytes(f.size)}
                      </p>
                    </div>
                    {/* Cache indicator: green tick when waveform is pre-loaded */}
                    {isCached && !isSelected && (
                      <CheckCircle2
                        className="w-3 h-3 shrink-0 ml-auto opacity-60"
                        style={{ color: accentColor }}
                        aria-label="Waveform cached — instant switch"
                      />
                    )}
                    {isSelected && (
                      <ChevronRight className="w-3 h-3 shrink-0 ml-auto" style={{ color: accentColor }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── CENTER: Waveform + Transport ────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Waveform canvas area */}
          <div className="flex-1 relative min-h-0 p-4 sm:p-6 bg-zinc-50/40 dark:bg-zinc-950/40 flex flex-col justify-center">
            {!selectedFile ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 select-none">
                <div className="relative mb-3 group">
                  <div
                    className="absolute inset-0 rounded-full blur-2xl opacity-25 dark:opacity-30 transition-all group-hover:opacity-40"
                    style={{ backgroundColor: accentColor }}
                  />
                  <img
                    src="/empty-trimmer.png"
                    alt="Audio Trimmer"
                    className="relative w-44 h-44 object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-xl"
                  />
                </div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                  No Audio File Loaded
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm leading-relaxed">
                  Drop audio files anywhere or click below to load a track into the waveform editor.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-5 flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose Audio File</span>
                </button>
              </div>
            ) : (
              <div className="w-full max-w-5xl mx-auto flex flex-col space-y-2.5">
                {/* File info bar with optional Cover Art */}
                <div className="flex items-center justify-between shrink-0 px-1">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    {selectedFile.coverArt ? (
                      <img
                        src={selectedFile.coverArt}
                        alt="Cover"
                        className="w-6 h-6 rounded-md object-cover border border-zinc-200/80 dark:border-zinc-700/80 shrink-0 shadow-xs"
                      />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: accentColor }} />
                    )}
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-sm" title={selectedFile.name}>
                      {selectedFile.name}
                    </span>
                    {info && (
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono shrink-0">
                        {info.sampleRate / 1000}kHz · {info.channels === 1 ? 'Mono' : 'Stereo'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    {exportStatus === 'exporting' && (
                      <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-500 dark:text-cyan-400 text-[10px] font-mono font-bold animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Cropping: {exportProgress}%</span>
                      </div>
                    )}
                    <span className="text-[11px] font-mono font-bold text-zinc-600 dark:text-zinc-400">
                      {formatTime(playhead)} / {formatTime(duration)}
                    </span>
                  </div>
                </div>

                {/* Waveform Track (Increased height) */}
                <div className="h-72 sm:h-80 md:h-[320px] w-full rounded-2xl overflow-hidden border border-zinc-200/80 dark:border-zinc-800/60 shadow-xs relative bg-white/80 dark:bg-zinc-900/60 backdrop-blur-sm">
                  {/* Full loader: shown while waiting for even the coarse preview */}
                  {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50/95 dark:bg-zinc-950/95 z-20 backdrop-blur-md">
                      <div className="relative mb-4 flex items-center justify-center">
                        <div
                          className="absolute inset-0 rounded-full blur-2xl opacity-40 animate-pulse"
                          style={{ backgroundColor: accentColor }}
                        />
                        <div className="relative flex items-center gap-1.5 h-12 px-4 py-2 bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl shadow-sm">
                          {[0.3, 0.7, 1.0, 0.5, 0.85, 0.4, 0.95, 0.6, 0.9, 0.45, 0.8, 0.35].map((scale, i) => (
                            <div
                              key={i}
                              className="w-1.5 rounded-full animate-bounce"
                              style={{
                                backgroundColor: accentColor,
                                height: `${scale * 28}px`,
                                animationDuration: `${0.6 + (i % 4) * 0.15}s`,
                                animationDelay: `${i * 0.05}s`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 tracking-tight">
                          Generating Studio Peaks…
                        </p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                          High-fidelity waveform decoding in progress
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Refining shimmer: coarse waveform is visible, full pass still running */}
                  {isRefining && !isLoading && (
                    <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden z-10 rounded-full">
                      <div
                        className="h-full w-1/3 rounded-full animate-pulse"
                        style={{
                          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
                          animation: 'shimmer-slide 1.4s ease-in-out infinite',
                        }}
                      />
                    </div>
                  )}
                  {/* ── Sleek Floating Glassmorphic Percentage HUD while Cropping ── */}
                  {exportStatus === 'exporting' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/75 backdrop-blur-md z-30 p-6 text-center animate-fade-in select-none">
                      {/* Floating HUD Card */}
                      <div className="w-full max-w-sm p-6 rounded-2xl bg-white/10 dark:bg-zinc-900/90 border border-white/20 dark:border-zinc-700/80 shadow-2xl backdrop-blur-xl flex flex-col items-center space-y-4">
                        {/* Animated Circular Percentage Badge */}
                        <div className="relative w-20 h-20 flex items-center justify-center">
                          {/* Glow */}
                          <div
                            className="absolute inset-0 rounded-full blur-xl opacity-50 animate-pulse"
                            style={{ backgroundColor: accentColor }}
                          />
                          {/* SVG Circular Progress Bar */}
                          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                            <circle
                              cx="40"
                              cy="40"
                              r="34"
                              className="stroke-zinc-700/50 fill-none"
                              strokeWidth="5"
                            />
                            <circle
                              cx="40"
                              cy="40"
                              r="34"
                              className="fill-none transition-all duration-300 ease-out"
                              stroke={accentColor}
                              strokeWidth="5"
                              strokeDasharray={2 * Math.PI * 34}
                              strokeDashoffset={2 * Math.PI * 34 * (1 - exportProgress / 100)}
                              strokeLinecap="round"
                            />
                          </svg>
                          {/* Percentage Number in center */}
                          <span className="absolute font-mono font-black text-xl text-white tracking-tight">
                            {exportProgress}%
                          </span>
                        </div>

                        <div className="space-y-1 text-center">
                          <h4 className="text-sm font-black text-white tracking-tight">
                            {saveMode === 'in-place' ? 'Cropping Audio In-Place…' : 'Exporting Trimmed Audio…'}
                          </h4>
                          <p className="text-[11px] text-zinc-400 font-medium">
                            {cutAction === 'delete' ? 'Cutting out selected range' : 'Preserving selected range with exact bitrate'}
                          </p>
                        </div>

                        {/* Sleek Horizontal Progress Bar with glow */}
                        <div className="w-full space-y-1.5">
                          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-700/60">
                            <div
                              className="h-full rounded-full transition-all duration-200 ease-out shadow-sm"
                              style={{
                                width: `${Math.max(4, exportProgress)}%`,
                                backgroundColor: accentColor,
                                boxShadow: `0 0 12px ${accentColor}`,
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 px-0.5">
                            <span>{formatTime(region.inPoint)} → {formatTime(region.outPoint)}</span>
                            <span className="font-bold text-zinc-200">{exportProgress}% Complete</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {error && !isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-4 text-center">
                      <AlertCircle className="w-6 h-6 text-red-500 mb-2" />
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Failed to decode audio</p>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 max-w-xs">{error}</p>
                    </div>
                  )}
                  <WaveformCanvas
                    peaks={peaks}
                    duration={duration}
                    region={region}
                    fades={fades}
                    playhead={playhead}
                    accentColor={accentColor}
                    isDarkMode={isDarkMode}
                    onRegionChange={setRegion}
                    onSeek={handleSeek}
                    className="w-full h-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Transport bar */}
          <div className="shrink-0 px-6 py-3 border-t border-zinc-200/80 dark:border-zinc-800/70 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm flex items-center gap-6">

            {/* Playback controls */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => { stopPlayback(true); setPlayhead(region.inPoint); }}
                disabled={!selectedFile}
                className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-default"
                title="Go to start"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={togglePlay}
                disabled={!selectedFile}
                style={{ backgroundColor: accentColor }}
                className="p-2.5 rounded-xl text-white shadow-sm hover:brightness-110 transition-all active:scale-95 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                title={isPlaying ? 'Pause' : 'Play selection'}
              >
                {isPlaying
                  ? <Pause className="w-4 h-4 fill-white" />
                  : <Play className="w-4 h-4 fill-white" />
                }
              </button>

              <button
                onClick={() => stopPlayback(true)}
                disabled={!isPlaying}
                className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-default"
                title="Stop"
              >
                <Square className="w-4 h-4" />
              </button>

              <button
                onClick={() => { stopPlayback(true); setPlayhead(region.outPoint); }}
                disabled={!selectedFile}
                className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-default"
                title="Go to end"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsLooping(l => !l)}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isLooping
                    ? 'text-white'
                    : 'text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
                style={isLooping ? { backgroundColor: accentColor } : {}}
                title="Loop selection"
              >
                <Repeat className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />

            {/* Timecodes */}
            <div className="flex items-center space-x-4">
              <TimecodeInput
                label="Start (IN)"
                value={region.inPoint}
                onChange={v => setRegion(r => ({ ...r, inPoint: Math.min(v, r.outPoint - 0.1) }))}
                max={duration}
                accentColor={accentColor}
              />
              <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
              <TimecodeInput
                label="End (OUT)"
                value={region.outPoint}
                onChange={v => setRegion(r => ({ ...r, outPoint: Math.max(v, r.inPoint + 0.1) }))}
                max={duration}
                accentColor={accentColor}
              />
              <div className="flex flex-col items-center space-y-1">
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Duration</span>
                <span className="text-sm font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {formatTime(Math.max(0, region.outPoint - region.inPoint))}
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />

            {/* Reset trim */}
            <button
              onClick={() => duration > 0 && setRegion({ inPoint: 0, outPoint: duration })}
              disabled={!selectedFile}
              className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-default"
              title="Reset trim selection"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ─── RIGHT: Controls panel (only shown when audio file is loaded) ────────── */}
        {selectedFile && (
          <div className="w-72 shrink-0 border-l border-zinc-200/80 dark:border-zinc-800/70 flex flex-col overflow-hidden bg-white/40 dark:bg-zinc-900/30">

            <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/60 dark:bg-zinc-900/40 shrink-0 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                Trimming Mode
              </span>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">

              {/* ── 1. Target Mode Selection (New File vs In-Place) ── */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  1. Save Method
                </label>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setSaveMode('new-file')}
                    className={`px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-center ${
                      saveMode === 'new-file'
                        ? 'border-zinc-900 dark:border-cyan-400 bg-zinc-900/5 dark:bg-cyan-500/10 shadow-xs ring-1 ring-zinc-900/20 dark:ring-cyan-400/30'
                        : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white/80 dark:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            saveMode === 'new-file' ? 'bg-zinc-900 dark:bg-cyan-400 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-600'
                          }`}
                        />
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Crop to Save</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-zinc-200/80 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                        New File
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 pl-4 leading-relaxed">
                      Exports selection as a new audio file in output folder.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSaveMode('in-place')}
                    className={`px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-center ${
                      saveMode === 'in-place'
                        ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/30'
                        : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white/80 dark:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            saveMode === 'in-place' ? 'bg-amber-500 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-600'
                          }`}
                        />
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Crop In-Place</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        Overwrite
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 pl-4 leading-relaxed">
                      Crops directly into the original file, updating it in place.
                    </p>
                  </button>
                </div>
              </div>

              {/* ── 2. Region Action Selection (Keep vs Delete) ── */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  2. Cut Mode
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setCutAction('keep')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      cutAction === 'keep'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    Keep Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => setCutAction('delete')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      cutAction === 'delete'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    Cut Out Selected
                  </button>
                </div>
              </div>

              <div className="h-px bg-zinc-100 dark:bg-zinc-800/60" />

              {/* ── 3. Fade In / Out Controls ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    Fades &amp; Dynamics
                  </label>
                  {(fades.fadeInDuration > 0 || fades.fadeOutDuration > 0) && (
                    <button
                      onClick={() => setFades({ fadeInDuration: 0, fadeOutDuration: 0 })}
                      className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                    >
                      Reset fades
                    </button>
                  )}
                </div>

                {/* Fade In */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center space-x-1.5">
                      <Sliders className="w-3 h-3 text-zinc-400" />
                      <span>Fade In</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
                      {fades.fadeInDuration.toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.1}
                    value={fades.fadeInDuration}
                    onChange={e => setFades(f => ({ ...f, fadeInDuration: parseFloat(e.target.value) }))}
                    disabled={!selectedFile}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-40"
                    style={{ accentColor }}
                  />
                </div>

                {/* Fade Out */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center space-x-1.5">
                      <Sliders className="w-3 h-3 text-zinc-400" />
                      <span>Fade Out</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
                      {fades.fadeOutDuration.toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.1}
                    value={fades.fadeOutDuration}
                    onChange={e => setFades(f => ({ ...f, fadeOutDuration: parseFloat(e.target.value) }))}
                    disabled={!selectedFile}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-40"
                    style={{ accentColor }}
                  />
                </div>

                {/* Gain */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center space-x-1.5">
                      <Volume2 className="w-3 h-3 text-zinc-400" />
                      <span>Volume Gain</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
                      {Math.round(gain * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={2.0}
                    step={0.05}
                    value={gain}
                    onChange={e => setGain(parseFloat(e.target.value))}
                    disabled={!selectedFile}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-40"
                    style={{ accentColor }}
                  />
                </div>
              </div>

              {/* ── 4. Output Format (Only for New File) ── */}
              {saveMode === 'new-file' && (
                <>
                  <div className="h-px bg-zinc-100 dark:bg-zinc-800/60" />
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                      Output Format
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['same', 'mp3', 'wav', 'aac', 'flac', 'ogg'].map(fmt => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setOutputFormat(fmt)}
                          className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                            outputFormat === fmt
                              ? 'text-white shadow-sm'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          }`}
                          style={outputFormat === fmt ? { backgroundColor: accentColor } : {}}
                        >
                          {fmt === 'same' ? 'Keep' : fmt}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── 5. Selection stats ── */}
              {selectedFile && duration > 0 && (
                <div className="p-3 rounded-xl bg-zinc-100/60 dark:bg-zinc-800/40 space-y-1.5 border border-zinc-200/60 dark:border-zinc-700/40">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Selection info</p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500 dark:text-zinc-400">Start</span>
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{formatTime(region.inPoint)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500 dark:text-zinc-400">End</span>
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{formatTime(region.outPoint)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500 dark:text-zinc-400">Length</span>
                    <span className="font-mono font-bold" style={{ color: accentColor }}>
                      {formatTime(Math.max(0, region.outPoint - region.inPoint))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500 dark:text-zinc-400">Action</span>
                    <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
                      {saveMode === 'in-place' ? 'Overwrites file' : 'New audio file'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Fixed Bottom Action Footer ── */}
            <div className="shrink-0 p-4 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md space-y-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={!selectedFile || exportStatus === 'exporting'}
                className={`relative overflow-hidden w-full flex items-center justify-center space-x-2 py-3 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed cursor-pointer ${
                  saveMode === 'in-place'
                    ? 'bg-amber-500 hover:bg-amber-600 text-black'
                    : 'bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105'
                }`}
              >
                {/* Dynamic live fill bar inside button during export */}
                {exportStatus === 'exporting' && (
                  <div
                    className="absolute inset-y-0 left-0 bg-white/20 dark:bg-black/20 transition-all duration-200 ease-out"
                    style={{ width: `${exportProgress}%` }}
                  />
                )}

                <span className="relative z-10 flex items-center space-x-2">
                  {exportStatus === 'exporting' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Cropping… {exportProgress}%</span>
                    </>
                  ) : saveMode === 'in-place' ? (
                    <>
                      <Scissors className="w-4 h-4" />
                      <span>Crop &amp; Overwrite File</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Save Selection as New File</span>
                    </>
                  )}
                </span>
              </button>

              {/* Status and Feedback in footer */}
              {exportStatus === 'done' && exportPath && (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/80 dark:border-emerald-800/60">
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">
                    {isOverwritten ? '✓ File updated in-place' : '✓ Saved successfully'}
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-500 truncate font-mono" title={exportPath}>
                    {exportPath.split(/[\\/]/).pop()}
                  </p>
                  <button
                    type="button"
                    onClick={() => window.ipcRenderer?.invoke('shell:reveal-file', exportPath)}
                    className="mt-1 flex items-center space-x-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <FolderOpen className="w-3 h-3" />
                    <span>Show in folder</span>
                  </button>
                </div>
              )}

              {exportStatus === 'error' && (
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/80 dark:border-red-800/60">
                  <p className="text-[11px] font-bold text-red-600 dark:text-red-400">Trimming operation failed</p>
                  <button
                    type="button"
                    onClick={() => setExportStatus('idle')}
                    className="mt-1 text-[10px] text-red-500 hover:underline cursor-pointer flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Try again</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hidden single file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Confirmation Modal */}
      {selectedFile && (
        <AudioTrimConfirmModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={() => {
            setShowConfirmModal(false);
            handleExecuteTrim();
          }}
          fileName={selectedFile.name}
          filePath={selectedFile.path}
          sourceSize={selectedFile.size}
          sourceDuration={duration}
          inPoint={region.inPoint}
          outPoint={region.outPoint}
          saveMode={saveMode}
          cutAction={cutAction}
          fadeInDuration={fades.fadeInDuration}
          fadeOutDuration={fades.fadeOutDuration}
          gain={gain}
          outputFormat={outputFormat}
          accentColor={accentColor}
          info={info}
        />
      )}
    </div>
  );
};
