// ─── Video Editor & Cutter Studio ─────────────────────────────────────────────
// Full-featured video studio with cinema playback, filmstrip timeline scrubbing,
// lossless stream cutting, audio extraction, and real-time progress HUD.

import React, {
  useState, useRef, useEffect, useCallback,
} from 'react';
import {
  Play, Pause, Square, SkipBack, SkipForward,
  Volume2, VolumeX, Scissors, Upload, FolderOpen,
  RotateCcw, Loader2, AlertCircle, Video,
  ChevronRight, Download, RefreshCw,
  Repeat, ArrowRight, CheckCircle2, Maximize2,
  Film, Sparkles, Music, Gauge, FastForward,
  Rewind, X, Trash2
} from 'lucide-react';
import { useTheme } from '@/Provider/Theme';
import { useJobStore } from '@/Provider/JobStore';
import { VideoTimeline, formatTime, formatDurationHuman } from './VideoTimeline';
import { VideoTrimConfirmModal } from './VideoTrimConfirmModal';
import type { VideoRegion } from './VideoTimeline';
import { getAssetPath } from '@/utils/assets';

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface VideoFile {
  id: string;
  name: string;
  path: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  thumbnails: string[];
}

type ExportStatus = 'idle' | 'exporting' | 'extracting-audio' | 'done' | 'error';

const VIDEO_EXTS = new Set([
  'mp4', 'mkv', 'mov', 'avi', 'webm', 'wmv', 'flv', 'm4v', 'ts', '3gp', 'ogv',
]);

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function filePathToMediaUrl(filePath: string): string {
  return `media://local/?path=${encodeURIComponent(filePath)}`;
}

// ─── Timecode Input Component ──────────────────────────────────────────────────
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
export const VideoEditor: React.FC = () => {
  const { accentColor, isDarkMode } = useTheme();
  const { reportJob, clearJob } = useJobStore();

  // ── Files state ─────────────────────────────────────────────────────────────
  const [files, setFiles] = useState<VideoFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFile = files.find(f => f.id === selectedId) ?? null;
  const duration = selectedFile?.duration ?? 0;

  // ── Trim region & controls ─────────────────────────────────────────────────
  const [region, setRegion] = useState<VideoRegion>({ inPoint: 0, outPoint: 0 });
  const [saveMode, setSaveMode] = useState<'new-file' | 'in-place'>('new-file');
  const [cutAction, setCutAction] = useState<'keep' | 'delete'>('keep');
  const [outputFormat, setOutputFormat] = useState<string>('same');
  const [targetResolution, setTargetResolution] = useState<'original' | '1080p' | '720p' | '480p'>('original');
  const [speed, setSpeed] = useState<number>(1.0);
  const [gain, setGain] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState(false);

  // Region Live Ref
  const regionRef = useRef(region);
  useEffect(() => {
    regionRef.current = region;
  }, [region]);

  // Reset region ONLY when a genuinely new file is selected
  const lastLoadedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedId && selectedId !== lastLoadedIdRef.current && duration > 0) {
      lastLoadedIdRef.current = selectedId;
      setRegion({ inPoint: 0, outPoint: duration });
      setSpeed(1.0);
      setGain(1.0);
      setIsMuted(false);
    }
  }, [selectedId, duration]);

  // ── Remove Video Callback ──────────────────────────────────────────────────
  const handleRemoveFile = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    stopPlayback(true);
    setFiles(prev => {
      const remaining = prev.filter(f => f.id !== id);
      if (id === selectedId) {
        const removedIdx = prev.findIndex(f => f.id === id);
        const next = remaining[removedIdx] ?? remaining[removedIdx - 1] ?? null;
        setSelectedId(next?.id ?? null);
      }
      return remaining;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ── Native Streaming Video Playback Engine (0ms Instant) ───────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isPlayingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  // Load video source
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    isPlayingRef.current = false;
    setIsPlaying(false);

    if (selectedFile?.path) {
      video.src = filePathToMediaUrl(selectedFile.path);
      video.currentTime = 0;
      setPlayhead(0);
    } else {
      video.removeAttribute('src');
    }
  }, [selectedFile?.path]);

  // Speed and volume sync
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = speed;
      video.volume = isMuted ? 0 : Math.min(1.0, Math.max(0, gain > 1 ? 1 : gain));
    }
  }, [speed, gain, isMuted]);

  const stopPlayback = useCallback((resetHead = false) => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      if (resetHead) {
        video.currentTime = regionRef.current.inPoint;
      }
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (resetHead) setPlayhead(regionRef.current.inPoint);
  }, []);

  const startPlayback = useCallback((fromTime?: number) => {
    const video = videoRef.current;
    if (!video || !selectedFile) return;

    const curRegion = regionRef.current;
    const totalDur = duration > 0 ? duration : (video.duration || 0);
    let end = curRegion.outPoint > curRegion.inPoint ? curRegion.outPoint : totalDur;
    if (end <= 0 || end > totalDur) end = totalDur;

    let targetTime = fromTime !== undefined ? fromTime : playhead;
    if (targetTime >= end - 0.05 || targetTime < curRegion.inPoint) {
      targetTime = curRegion.inPoint;
    }

    video.currentTime = targetTime;
    setPlayhead(targetTime);

    video.play()
      .then(() => {
        isPlayingRef.current = true;
        setIsPlaying(true);
      })
      .catch((err) => {
        console.warn('[VideoEditor] Playback prevented:', err);
        isPlayingRef.current = false;
        setIsPlaying(false);
      });
  }, [selectedFile, duration, playhead]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !selectedFile) return;

    if (!video.paused) {
      video.pause();
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else {
      startPlayback();
    }
  }, [selectedFile, startPlayback]);

  // 60FPS Playhead Tracker & Region Loop/Boundary Watcher
  useEffect(() => {
    let animId: number;
    const track = () => {
      const video = videoRef.current;
      if (video && !video.paused && !isDraggingRef.current) {
        const cur = video.currentTime;
        const curRegion = regionRef.current;
        const totalDur = duration > 0 ? duration : (video.duration || 0);
        let end = curRegion.outPoint > curRegion.inPoint ? curRegion.outPoint : totalDur;
        if (end <= 0 || end > totalDur) end = totalDur;

        if (cur >= end) {
          if (isLooping) {
            video.currentTime = curRegion.inPoint;
            video.play().catch(() => {});
          } else {
            video.pause();
            video.currentTime = curRegion.inPoint;
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

  // Frame Stepping helper
  const stepFrame = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const cur = video.currentTime;
    const next = Math.max(0, Math.min(duration, cur + seconds));
    video.currentTime = next;
    setPlayhead(next);
  }, [duration]);

  // Seek / Scrub Handler
  const handleSeek = useCallback((time: number, isDragging = false) => {
    isDraggingRef.current = isDragging;
    const video = videoRef.current;
    const totalDur = duration > 0 ? duration : (video?.duration || 0);
    const clamped = Math.max(0, Math.min(totalDur > 0 ? totalDur : time, time));
    setPlayhead(clamped);

    if (video) {
      if (!isNaN(clamped) && isFinite(clamped)) {
        try {
          video.currentTime = clamped;
        } catch (_) {}
      }
      if (!isDragging && isPlayingRef.current && video.paused) {
        video.play().catch(() => {});
      }
    }
  }, [duration]);

  // Fullscreen
  const handleFullscreen = () => {
    const video = videoRef.current;
    if (video) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        video.requestFullscreen().catch(() => {});
      }
    }
  };

  // ── Background Thumbnail Generator ──────────────────────────────────────────
  useEffect(() => {
    let active = true;
    files.forEach(async (f) => {
      if (f.thumbnails.length === 0) {
        try {
          const thumbs = (await window.ipcRenderer?.invoke('video:get-thumbnails', f.path, 10)) as string[] | null;
          if (active && thumbs && thumbs.length > 0) {
            setFiles(prev => prev.map(item => item.id === f.id ? { ...item, thumbnails: thumbs } : item));
          }
        } catch (_) {}
      }
    });
    return () => {
      active = false;
    };
  }, [files]);

  // ── File Picking ───────────────────────────────────────────────────────────
  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files;
    if (!picked || picked.length === 0) return;

    for (let i = 0; i < picked.length; i++) {
      const f = picked[i];
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      if (!VIDEO_EXTS.has(ext)) continue;

      const p = (window as unknown as { api?: { getPathForFile: (file: File) => string } }).api?.getPathForFile(f)
        || (f as unknown as { path?: string }).path
        || f.name;

      let dur = 0;
      let width = 1920;
      let height = 1080;
      let aspectRatio = '16:9';
      let fps = 30;
      let vCodec = 'unknown';
      let aCodec = 'none';

      try {
        const info = (await window.ipcRenderer?.invoke('video:get-info', p)) as {
          duration: number;
          width: number;
          height: number;
          aspectRatio: string;
          fps: number;
          videoCodec: string;
          audioCodec: string;
        } | null;

        if (info) {
          dur = info.duration;
          width = info.width;
          height = info.height;
          aspectRatio = info.aspectRatio;
          fps = info.fps;
          vCodec = info.videoCodec;
          aCodec = info.audioCodec;
        }
      } catch (_) {}

      const newFile: VideoFile = {
        id: crypto.randomUUID(),
        name: f.name,
        path: p,
        size: f.size,
        duration: dur,
        width,
        height,
        aspectRatio,
        fps,
        videoCodec: vCodec,
        audioCodec: aCodec,
        thumbnails: [],
      };

      setFiles(prev => {
        if (prev.some(item => item.path === newFile.path)) return prev;
        return [...prev, newFile];
      });
      setSelectedId(newFile.id);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleBrowseVideo = useCallback(async () => {
    try {
      const result = (await window.ipcRenderer?.invoke('dialog:open-video-files')) as string[] | null
        ?? (await window.ipcRenderer?.invoke('dialog:open-video-file')) as string[] | null;
      if (!result || result.length === 0) return;

      for (const p of result) {
        let dur = 0;
        let width = 1920;
        let height = 1080;
        let aspectRatio = '16:9';
        let fps = 30;
        let vCodec = 'unknown';
        let aCodec = 'none';

        try {
          const info = (await window.ipcRenderer?.invoke('video:get-info', p)) as {
            duration: number;
            width: number;
            height: number;
            aspectRatio: string;
            fps: number;
            videoCodec: string;
            audioCodec: string;
          } | null;

          if (info) {
            dur = info.duration;
            width = info.width;
            height = info.height;
            aspectRatio = info.aspectRatio;
            fps = info.fps;
            vCodec = info.videoCodec;
            aCodec = info.audioCodec;
          }
        } catch (_) {}

        const newFile: VideoFile = {
          id: crypto.randomUUID(),
          name: p.split(/[\\/]/).pop() ?? p,
          path: p,
          size: 0,
          duration: dur,
          width,
          height,
          aspectRatio,
          fps,
          videoCodec: vCodec,
          audioCodec: aCodec,
          thumbnails: [],
        };

        setFiles(prev => {
          if (prev.some(item => item.path === newFile.path)) return prev;
          return [...prev, newFile];
        });
        setSelectedId(newFile.id);
      }
    } catch (err) {
      console.error('[VideoEditor] Browse error:', err);
    }
  }, []);

  // ── Export / Trimming Execution & Progress ───────────────────────────────────
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [isOverwritten, setIsOverwritten] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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

  const handleExecuteTrim = useCallback(async (overrideMode?: 'new-file' | 'in-place') => {
    if (!selectedFile || duration <= 0) return;
    const modeToUse = overrideMode ?? saveMode;

    stopPlayback(true);
    setExportStatus('exporting');
    setExportProgress(0);
    setIsOverwritten(false);
    reportJob('video-cut', { status: 'processing', progress: 0, label: 'Exporting video…' });

    try {
      const result = await window.ipcRenderer?.invoke('video:export', {
        inputPath: selectedFile.path,
        inPoint: region.inPoint,
        outPoint: region.outPoint,
        saveTarget: modeToUse === 'in-place' ? 'overwrite-original' : 'new-file',
        cutMode: cutAction === 'delete' ? 'delete-selection' : 'keep-selection',
        speed,
        gain: isMuted ? 0 : gain,
        outputFormat: modeToUse === 'in-place' ? null : (outputFormat === 'same' ? null : outputFormat),
        resolution: targetResolution,
      }) as { outputPath: string; overwritten: boolean; newSize?: number; newDuration?: number } | null;

      if (result?.overwritten) {
        setExportPath(result.outputPath);
        setIsOverwritten(true);
        setExportStatus('done');

        if (result.newDuration || result.newSize) {
          setFiles(prev => prev.map(f => f.id === selectedId ? {
            ...f,
            duration: result.newDuration ?? f.duration,
            size: result.newSize ?? f.size,
          } : f));
        }
      } else {
        setExportPath(result?.outputPath ?? null);
        setIsOverwritten(false);
        setExportStatus('done');
      }
      clearJob('video-cut');
    } catch (err) {
      console.error('[VideoEditor] Export error:', err);
      setExportStatus('error');
      reportJob('video-cut', { status: 'error', progress: 0, label: 'Export failed' });
    }
  }, [selectedFile, duration, region, speed, gain, isMuted, outputFormat, targetResolution, saveMode, cutAction, selectedId, stopPlayback, reportJob, clearJob]);

  // Extract Audio
  const handleExtractAudio = useCallback(async (format: 'mp3' | 'wav' | 'aac' | 'flac' = 'mp3') => {
    if (!selectedFile || duration <= 0) return;

    stopPlayback(true);
    setExportStatus('extracting-audio');
    setExportProgress(0);

    try {
      const result = await window.ipcRenderer?.invoke('video:extract-audio', {
        inputPath: selectedFile.path,
        format,
        inPoint: region.inPoint,
        outPoint: region.outPoint,
      }) as { outputPath: string; size?: number } | null;

      if (result?.outputPath) {
        setExportPath(result.outputPath);
        setIsOverwritten(false);
        setExportStatus('done');
      }
    } catch (err) {
      console.error('[VideoEditor] Audio extract error:', err);
      setExportStatus('error');
    }
  }, [selectedFile, duration, region, stopPlayback]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent">

      {/* ── Header ── */}
      <div className="px-8 pt-6 pb-4 shrink-0 flex items-center justify-between gap-4 border-b-0 border-solid border-x-0 border-t-0 border-zinc-200/80 dark:border-zinc-800/70">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2 border border-zinc-200/80 dark:border-zinc-800/80 bg-transparent backdrop-blur-md shadow-xs">
            <span style={{ color: accentColor }}>Cinema Studio</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 leading-tight tracking-tight">
            Video Editor &amp; Cutter
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Lossless video trimming, timeline keyframe scrubbing, and audio track extraction
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleBrowseVideo}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/80 shadow-xs transition-all cursor-pointer"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Open Videos…</span>
          </button>
        </div>
      </div>

      {/* ── Main Studio Grid ── */}
      <div className="flex-1 flex min-h-0 border-t border-zinc-200/80 dark:border-zinc-800/80">

        {/* ── Left Column: Video List Sidebar (only shown when videos are loaded) ── */}
        {files.length > 0 && (
          <div className="w-64 xl:w-72 shrink-0 border-r border-zinc-200/80 dark:border-zinc-800/80 flex flex-col bg-zinc-50/60 dark:bg-zinc-950/40 backdrop-blur-sm">
            <div className="p-3 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                Loaded Videos ({files.length})
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors cursor-pointer"
                title="Add Videos"
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 no-scrollbar">
              {files.map(f => {
                const isSel = f.id === selectedId;
                return (
                  <div key={f.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => { stopPlayback(true); setSelectedId(f.id); }}
                      className={`w-full p-2 pr-9 rounded-xl text-left transition-all cursor-pointer flex items-center space-x-2.5 ${
                        isSel
                          ? 'bg-white dark:bg-zinc-800/90 shadow-xs border border-zinc-200/80 dark:border-zinc-700/80 ring-1'
                          : 'hover:bg-white/50 dark:hover:bg-zinc-800/40 border border-transparent'
                      }`}
                      style={isSel ? { borderColor: accentColor } : {}}
                    >
                      {/* Thumbnail Preview */}
                      <div className="w-12 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center border border-zinc-300/60 dark:border-zinc-700/60 relative">
                        {f.thumbnails.length > 0 ? (
                          <img src={f.thumbnails[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Video className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate" title={f.name}>
                          {f.name}
                        </p>
                        <div className="flex items-center space-x-2 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">
                          <span>{f.duration > 0 ? formatDurationHuman(f.duration) : '--'}</span>
                          <span>·</span>
                          <span>{f.height >= 2160 ? '4K' : f.height >= 1080 ? '1080p' : f.height >= 720 ? '720p' : `${f.width}x${f.height}`}</span>
                        </div>
                      </div>
                    </button>

                    {/* Remove button — appears on hover */}
                    <button
                      type="button"
                      onClick={(e) => handleRemoveFile(f.id, e)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-zinc-100/90 hover:bg-red-500/15 hover:text-red-500 text-zinc-400 dark:bg-zinc-800/90 dark:hover:bg-red-500/25 dark:hover:text-red-400 transition-all cursor-pointer z-10 shadow-xs"
                      title="Remove video from editor"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Center Column: Cinema Player & Timeline ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!selectedFile ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 select-none bg-zinc-50/40 dark:bg-zinc-950/40">
              <div className="relative mb-3 group">
                <div
                  className="absolute inset-0 rounded-full blur-2xl opacity-25 dark:opacity-30 transition-all group-hover:opacity-40"
                  style={{ backgroundColor: accentColor }}
                />
                <img
                  src={getAssetPath("empty-trimmer.png")}
                  alt="Video Editor"
                  className="relative w-44 h-44 object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-xl"
                />
              </div>
              <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                No Video File Loaded
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm leading-relaxed">
                Open a video file to access the timeline scrubber, cut handles, and audio extractor.
              </p>
              <button
                type="button"
                onClick={handleBrowseVideo}
                className="mt-5 flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Select Video File</span>
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-zinc-950">

              {/* Top file meta bar */}
              <div className="px-6 py-2.5 bg-zinc-900/80 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: accentColor }} />
                  <span className="text-xs font-bold text-zinc-200 truncate max-w-md" title={selectedFile.name}>
                    {selectedFile.name}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                    {selectedFile.width}x{selectedFile.height} ({selectedFile.aspectRatio}) · {selectedFile.fps}fps · {selectedFile.videoCodec.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  {exportStatus === 'exporting' && (
                    <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-[10px] font-mono font-bold animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Cropping: {exportProgress}%</span>
                    </div>
                  )}
                  {exportStatus === 'extracting-audio' && (
                    <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-400 text-[10px] font-mono font-bold animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Extracting: {exportProgress}%</span>
                    </div>
                  )}
                  <span className="text-xs font-mono font-bold text-zinc-300">
                    {formatTime(playhead)} / {formatTime(duration)}
                  </span>
                </div>
              </div>

              {/* ── Cinema Video Viewport ── */}
              <div className="flex-1 relative min-h-0 flex items-center justify-center p-3 bg-black overflow-hidden group">
                <video
                  ref={videoRef}
                  className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
                  onClick={togglePlay}
                />

                {/* ── Sleek Floating Glassmorphic Progress HUD while Exporting/Cropping ── */}
                {(exportStatus === 'exporting' || exportStatus === 'extracting-audio') && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-md z-30 p-6 text-center animate-fade-in select-none">
                    <div className="w-full max-w-sm p-6 rounded-2xl bg-white/10 dark:bg-zinc-900/90 border border-white/20 dark:border-zinc-700/80 shadow-2xl backdrop-blur-xl flex flex-col items-center space-y-4">
                      {/* Animated Circular Percentage Badge */}
                      <div className="relative w-20 h-20 flex items-center justify-center">
                        <div
                          className="absolute inset-0 rounded-full blur-xl opacity-50 animate-pulse"
                          style={{ backgroundColor: accentColor }}
                        />
                        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="34" className="stroke-zinc-700/50 fill-none" strokeWidth="5" />
                          <circle
                            cx="40" cy="40" r="34"
                            className="fill-none transition-all duration-300 ease-out"
                            stroke={accentColor}
                            strokeWidth="5"
                            strokeDasharray={2 * Math.PI * 34}
                            strokeDashoffset={2 * Math.PI * 34 * (1 - exportProgress / 100)}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute font-mono font-black text-xl text-white tracking-tight">
                          {exportProgress}%
                        </span>
                      </div>

                      <div className="space-y-1 text-center">
                        <h4 className="text-sm font-black text-white tracking-tight">
                          {exportStatus === 'extracting-audio'
                            ? 'Extracting Audio Track…'
                            : saveMode === 'in-place'
                            ? 'Cropping Video In-Place…'
                            : 'Exporting Trimmed Video…'}
                        </h4>
                        <p className="text-[11px] text-zinc-400 font-medium">
                          {exportStatus === 'extracting-audio'
                            ? 'Converting video soundtrack to audio'
                            : cutAction === 'delete'
                            ? 'Cutting out selected range'
                            : 'Preserving selected range with exact bitrate'}
                        </p>
                      </div>

                      {/* Horizontal progress bar */}
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
              </div>

              {/* ── Filmstrip Timeline Scrubber ── */}
              <div className="h-24 sm:h-28 w-full border-t border-zinc-800 bg-zinc-900/90 shrink-0 relative">
                <VideoTimeline
                  duration={duration}
                  region={region}
                  playhead={playhead}
                  thumbnails={selectedFile.thumbnails}
                  accentColor={accentColor}
                  isDarkMode={isDarkMode}
                  onRegionChange={setRegion}
                  onSeek={handleSeek}
                  className="w-full h-full"
                />
              </div>

              {/* ── Cinema Transport Bar ── */}
              <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
                {/* Playback controls */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => { stopPlayback(true); setPlayhead(region.inPoint); }}
                    disabled={!selectedFile}
                    className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40 cursor-pointer"
                    title="Go to Start (IN)"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => stepFrame(-1)}
                    disabled={!selectedFile}
                    className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40 cursor-pointer"
                    title="Step -1s"
                  >
                    <Rewind className="w-4 h-4" />
                  </button>

                  <button
                    onClick={togglePlay}
                    disabled={!selectedFile}
                    style={{ backgroundColor: accentColor }}
                    className="p-2.5 rounded-xl text-white shadow-sm hover:brightness-110 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                    title={isPlaying ? 'Pause' : 'Play Selection'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                  </button>

                  <button
                    onClick={() => stopPlayback(true)}
                    disabled={!isPlaying}
                    className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40 cursor-pointer"
                    title="Stop"
                  >
                    <Square className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => stepFrame(1)}
                    disabled={!selectedFile}
                    className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40 cursor-pointer"
                    title="Step +1s"
                  >
                    <FastForward className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => { stopPlayback(true); setPlayhead(region.outPoint); }}
                    disabled={!selectedFile}
                    className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40 cursor-pointer"
                    title="Go to End (OUT)"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsLooping(l => !l)}
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      isLooping ? 'text-white' : 'text-zinc-400 hover:bg-zinc-800'
                    }`}
                    style={isLooping ? { backgroundColor: accentColor } : {}}
                    title="Loop selection"
                  >
                    <Repeat className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Timecodes */}
                <div className="flex items-center space-x-4">
                  <TimecodeInput
                    label="Start (IN)"
                    value={region.inPoint}
                    onChange={v => setRegion(r => ({ ...r, inPoint: Math.min(v, r.outPoint - 0.2) }))}
                    max={duration}
                    accentColor={accentColor}
                  />
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                  <TimecodeInput
                    label="End (OUT)"
                    value={region.outPoint}
                    onChange={v => setRegion(r => ({ ...r, outPoint: Math.max(v, r.inPoint + 0.2) }))}
                    max={duration}
                    accentColor={accentColor}
                  />
                </div>

                {/* Speed, Volume, Fullscreen */}
                <div className="flex items-center space-x-3">
                  {/* Speed dropdown */}
                  <select
                    value={speed}
                    onChange={e => setSpeed(parseFloat(e.target.value))}
                    className="bg-zinc-800 text-xs font-mono font-bold text-zinc-300 rounded-lg px-2 py-1 border border-zinc-700 focus:outline-none cursor-pointer"
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={0.75}>0.75x</option>
                    <option value={1.0}>1.0x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2.0}>2.0x</option>
                  </select>

                  {/* Volume / Mute */}
                  <button
                    onClick={() => setIsMuted(m => !m)}
                    className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  {/* Fullscreen */}
                  <button
                    onClick={handleFullscreen}
                    className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    title="Fullscreen Video"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column: Video Inspector & Export Panel (only shown when video is selected) ── */}
        {selectedFile && (
          <div className="w-72 xl:w-80 shrink-0 border-l border-zinc-200/80 dark:border-zinc-800/80 flex flex-col bg-zinc-50/60 dark:bg-zinc-950/40 backdrop-blur-sm">
            <div className="p-4 border-b border-zinc-200/80 dark:border-zinc-800/80">
              <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                Video Trim Inspector
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">

              {/* ── 1. Target Output Mode ── */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  1. Save Target
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setSaveMode('new-file')}
                    className={`px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-center ${
                      saveMode === 'new-file'
                        ? 'border-cyan-500 bg-cyan-500/10 shadow-xs ring-1 ring-cyan-500/30'
                        : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white/80 dark:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${saveMode === 'new-file' ? 'bg-cyan-500 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Save as New Video</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">New File</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 pl-4 leading-relaxed">
                      Exports selection as a new video in output folder.
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
                        <div className={`w-2 h-2 rounded-full ${saveMode === 'in-place' ? 'bg-amber-500 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Crop In-Place</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-amber-500/20 text-amber-600 dark:text-amber-400">Edit Source</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 pl-4 leading-relaxed">
                      Modifies and crops existing source video directly.
                    </p>
                  </button>
                </div>
              </div>

              {/* ── 2. Region Action ── */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  2. Region Action
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

              <div className="h-px bg-zinc-200/80 dark:bg-zinc-800/80" />

              {/* ── 3. Resolution & Speed Settings ── */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    Resolution / Scaling
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['original', '1080p', '720p', '480p'] as const).map(res => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setTargetResolution(res)}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                          targetResolution === res
                            ? 'text-white shadow-sm'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                        style={targetResolution === res ? { backgroundColor: accentColor } : {}}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Volume / Gain */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center space-x-1">
                      <Volume2 className="w-3 h-3" />
                      <span>Audio Track Volume</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
                      {Math.round(gain * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.0}
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

              {/* ── 4. Output Format (For New File) ── */}
              {saveMode === 'new-file' && (
                <>
                  <div className="h-px bg-zinc-200/80 dark:bg-zinc-800/80" />
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                      Output Container
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['same', 'mp4', 'mkv', 'mov', 'webm'].map(fmt => (
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
                          {fmt === 'same' ? 'Keep' : fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="h-px bg-zinc-200/80 dark:bg-zinc-800/80" />

              {/* ── 5. Quick Audio Extraction Tool ── */}
              <div className="space-y-2 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center space-x-1.5 text-purple-400 text-xs font-bold">
                  <Music className="w-4 h-4" />
                  <span>Extract Soundtrack</span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Export the selected audio track directly into an audio file.
                </p>
                <div className="grid grid-cols-4 gap-1 pt-1">
                  {(['mp3', 'wav', 'aac', 'flac'] as const).map(fmt => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => handleExtractAudio(fmt)}
                      disabled={!selectedFile || exportStatus === 'extracting-audio' || exportStatus === 'exporting'}
                      className="py-1 px-1.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer text-center disabled:opacity-50"
                    >
                      .{fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 6. Selection Summary ── */}
              {selectedFile && duration > 0 && (
                <div className="p-3 rounded-xl bg-zinc-100/60 dark:bg-zinc-800/40 space-y-1.5 border border-zinc-200/60 dark:border-zinc-700/40">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Trim Summary</p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500 dark:text-zinc-400">Start (IN)</span>
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{formatTime(region.inPoint)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500 dark:text-zinc-400">End (OUT)</span>
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{formatTime(region.outPoint)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500 dark:text-zinc-400">Selected Length</span>
                    <span className="font-mono font-bold" style={{ color: accentColor }}>
                      {formatTime(Math.max(0, region.outPoint - region.inPoint))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500 dark:text-zinc-400">Target Output</span>
                    <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
                      {saveMode === 'in-place' ? 'Overwrites Original' : 'New Video File'}
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
                disabled={!selectedFile || exportStatus === 'exporting' || exportStatus === 'extracting-audio'}
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
                      <span>Crop &amp; Overwrite Video</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Save Selection as New Video</span>
                    </>
                  )}
                </span>
              </button>

              {/* Status and Feedback in footer */}
              {exportStatus === 'done' && exportPath && (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/80 dark:border-emerald-800/60">
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">
                    {isOverwritten ? '✓ Original video updated in-place' : '✓ Saved successfully'}
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
                  <p className="text-[11px] font-bold text-red-600 dark:text-red-400">Video processing failed</p>
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Confirmation Modal */}
      {selectedFile && (
        <VideoTrimConfirmModal
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
          width={selectedFile.width}
          height={selectedFile.height}
          fps={selectedFile.fps}
          videoCodec={selectedFile.videoCodec}
          audioCodec={selectedFile.audioCodec}
          inPoint={region.inPoint}
          outPoint={region.outPoint}
          saveMode={saveMode}
          cutAction={cutAction}
          speed={speed}
          gain={gain}
          isMuted={isMuted}
          outputFormat={outputFormat}
          targetResolution={targetResolution}
          accentColor={accentColor}
        />
      )}
    </div>
  );
};
