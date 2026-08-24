// ─── FloatingJobManager.tsx ──────────────────────────────────────────────────
// Modular floating background task manager for AUVID.
// Automatically displays a sleek glassmorphic floating capsule at the bottom right
// whenever an active job (Audio Trimmer, Sound Recorder, Format Converter, Compressors, Video Editor)
// is running in the background and the user is viewing a different tab.

import React from 'react';
import {
  Scissors, Video, Mic, RefreshCw, Layers,
  Minimize2, Tag, ExternalLink, Play, Pause,
  Square, CheckCircle2, AlertCircle, X
} from 'lucide-react';
import { useTheme } from '@/Provider/Theme';
import { useMediaContext } from '@/Provider/MediaContext';
import { useJobStore, ActiveJob } from '@/Provider/JobStore';
import { useSoundRecorder } from '@/Provider/SoundRecorderContext';
import { MediaTool } from '@/types';

interface ToolThemeConfig {
  name: string;
  color: string;
  bgGradient: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TOOL_CONFIGS: Record<MediaTool, ToolThemeConfig> = {
  'recorder': {
    name: 'Sound Recorder',
    color: '#8b5cf6', // Violet
    bgGradient: 'from-violet-500/20 to-purple-500/10',
    icon: Mic,
  },
  'audio-trim': {
    name: 'Audio Trimmer',
    color: '#06b6d4', // Cyan
    bgGradient: 'from-cyan-500/20 to-blue-500/10',
    icon: Scissors,
  },
  'video-cut': {
    name: 'Video Editor',
    color: '#3b82f6', // Blue
    bgGradient: 'from-blue-500/20 to-indigo-500/10',
    icon: Video,
  },
  'converter': {
    name: 'Format Converter',
    color: '#a855f7', // Purple
    bgGradient: 'from-purple-500/20 to-pink-500/10',
    icon: RefreshCw,
  },
  'audio-compress': {
    name: 'Audio Compressor',
    color: '#10b981', // Emerald
    bgGradient: 'from-emerald-500/20 to-teal-500/10',
    icon: Layers,
  },
  'video-compress': {
    name: 'Video Compressor',
    color: '#f59e0b', // Amber
    bgGradient: 'from-amber-500/20 to-orange-500/10',
    icon: Minimize2,
  },
  'metadata': {
    name: 'Metadata Editor',
    color: '#ec4899', // Pink
    bgGradient: 'from-pink-500/20 to-rose-500/10',
    icon: Tag,
  },
  'dashboard': {
    name: 'Dashboard',
    color: '#71717a',
    bgGradient: 'from-zinc-500/20 to-zinc-500/10',
    icon: Layers,
  },
  'settings': {
    name: 'Settings',
    color: '#71717a',
    bgGradient: 'from-zinc-500/20 to-zinc-500/10',
    icon: Layers,
  },
};

function formatTimer(secs: number): string {
  if (!secs || isNaN(secs) || secs < 0) return '00:00.00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

// ── Floating Recorder Capsule ────────────────────────────────────────────────
const FloatingRecorderItem: React.FC<{
  job: ActiveJob;
  onOpen: () => void;
}> = ({ onOpen }) => {
  const {
    isPaused,
    durationSec,
    activePreset,
    pauseRecording,
    resumeRecording,
    stopRecording,
  } = useSoundRecorder();

  return (
    <div
      onClick={onOpen}
      className="flex items-center space-x-3 px-4 py-2.5 rounded-2xl
                 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl
                 border border-zinc-200/90 dark:border-zinc-800/90
                 shadow-2xl hover:shadow-[0_12px_36px_rgba(139,92,246,0.2)]
                 hover:border-violet-300 dark:hover:border-violet-800/80
                 transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer select-none"
    >
      {/* Pulsing Status Dot & Mic Icon */}
      <div className="relative flex items-center justify-center">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs ${
            isPaused ? 'bg-amber-500' : 'bg-violet-600 dark:bg-violet-500 shadow-violet-500/30'
          }`}
        >
          <Mic className="w-4 h-4 text-white" />
        </div>

        {!isPaused && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-600 border-2 border-white dark:border-zinc-900" />
          </span>
        )}
      </div>

      {/* Live Timer & Format Specs */}
      <div className="flex flex-col min-w-0 pr-1">
        <div className="flex items-center space-x-1.5">
          <span
            className={`text-[10px] font-mono font-black uppercase tracking-wider ${
              isPaused ? 'text-amber-500' : 'text-violet-600 dark:text-violet-400'
            }`}
          >
            {isPaused ? 'PAUSED' : 'REC'}
          </span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase">
            .{activePreset.format}
          </span>
        </div>

        <span className="text-sm font-black font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
          {formatTimer(durationSec)}
        </span>
      </div>

      {/* Animated equalizer waves */}
      <div className="flex items-center gap-0.5 h-4 px-1">
        {[0.4, 0.9, 0.6, 1.0, 0.5, 0.8].map((scale, i) => (
          <div
            key={i}
            className={`w-0.5 rounded-full transition-all ${
              isPaused
                ? 'h-1.5 bg-zinc-300 dark:bg-zinc-700'
                : 'bg-violet-500 dark:bg-violet-400 animate-pulse'
            }`}
            style={{
              height: isPaused ? '6px' : `${scale * 16}px`,
              animationDuration: `${0.4 + (i % 3) * 0.2}s`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>

      <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />

      {/* Quick Actions */}
      <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={isPaused ? resumeRecording : pauseRecording}
          className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-xs"
          title={isPaused ? 'Resume Recording' : 'Pause Recording'}
        >
          {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
        </button>

        <button
          type="button"
          onClick={() => {
            stopRecording();
            onOpen();
          }}
          className="w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-95 text-white flex items-center justify-center transition-transform cursor-pointer shadow-md shadow-violet-600/25"
          title="Stop and Review in Studio"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
        </button>

        <button
          type="button"
          onClick={onOpen}
          className="w-8 h-8 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
          title="Maximize Studio Recorder"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ── Generic Tool Floating Task Capsule ───────────────────────────────────────
const FloatingGenericTaskItem: React.FC<{
  job: ActiveJob;
  onOpen: () => void;
  onDismiss: () => void;
}> = ({ job, onOpen, onDismiss }) => {
  const config = TOOL_CONFIGS[job.tool] || TOOL_CONFIGS['converter'];
  const Icon = config.icon;
  const progressPercent = Math.min(100, Math.max(0, Math.round(job.progress || 0)));

  return (
    <div
      onClick={onOpen}
      className="flex items-center space-x-3 px-4 py-3 rounded-2xl
                 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl
                 border border-zinc-200/90 dark:border-zinc-800/90
                 shadow-2xl hover:shadow-[0_12px_36px_rgba(0,0,0,0.2)]
                 hover:border-zinc-300 dark:hover:border-zinc-700
                 transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer select-none group min-w-[280px] max-w-sm"
    >
      {/* Icon Badge */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0 relative overflow-hidden"
        style={{ backgroundColor: config.color }}
      >
        <Icon className="w-4 h-4 text-white animate-pulse" />
      </div>

      {/* Info & Live Progress */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center justify-between space-x-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
            {config.name}
          </span>
          <span className="text-[11px] font-mono font-black" style={{ color: config.color }}>
            {progressPercent > 0 ? `${progressPercent}%` : 'Working…'}
          </span>
        </div>

        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5 leading-tight">
          {job.label || 'Processing media task…'}
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1.5 relative">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${Math.max(5, progressPercent)}%`,
              backgroundColor: config.color,
            }}
          />
        </div>
      </div>

      <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />

      {/* Quick Switch Button */}
      <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onOpen}
          className="w-8 h-8 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
          title={`Open ${config.name}`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="w-8 h-8 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
          title="Dismiss indicator"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ── Main Floating Job Manager ────────────────────────────────────────────────
export const FloatingJobManager: React.FC = () => {
  const { activeTool, setActiveTool } = useMediaContext();
  const { jobs, clearJob } = useJobStore();

  // Find all active background jobs that belong to a tool OTHER than the current one
  const activeBackgroundJobs = Object.values(jobs).filter(
    (job) => job && job.status === 'processing' && job.tool !== activeTool
  );

  if (activeBackgroundJobs.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-8 z-50 flex flex-col space-y-3 pointer-events-auto animate-in fade-in slide-in-from-bottom-5 zoom-in-95 duration-200">
      {activeBackgroundJobs.map((job) => {
        if (job.tool === 'recorder') {
          return (
            <FloatingRecorderItem
              key={job.tool}
              job={job}
              onOpen={() => setActiveTool('recorder')}
            />
          );
        }

        return (
          <FloatingGenericTaskItem
            key={job.tool}
            job={job}
            onOpen={() => setActiveTool(job.tool)}
            onDismiss={() => clearJob(job.tool)}
          />
        );
      })}
    </div>
  );
};
