// ─── FloatingRecorderWidget.tsx ──────────────────────────────────────────────
// Sleek floating glassmorphism capsule displayed at the bottom right whenever a sound
// recording is in progress and the user navigates to another workspace tool.

import React from 'react';
import { Play, Pause, Square, ExternalLink, Mic } from 'lucide-react';
import { useTheme } from '@/Provider/Theme';
import { useMediaContext } from '@/Provider/MediaContext';
import { useSoundRecorder } from '@/Provider/SoundRecorderContext';

function formatTimer(secs: number): string {
  if (!secs || isNaN(secs) || secs < 0) return '00:00.00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export const FloatingRecorderWidget: React.FC = () => {
  const { accentColor } = useTheme();
  const { activeTool, setActiveTool } = useMediaContext();
  const {
    isRecording,
    isPaused,
    durationSec,
    activePreset,
    pauseRecording,
    resumeRecording,
    stopRecording,
  } = useSoundRecorder();

  // Only show when recording/paused AND on a different tab
  if ((!isRecording && !isPaused) || activeTool === 'recorder') {
    return null;
  }

  const handleOpenRecorder = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTool('recorder');
  };

  return (
    <div
      onClick={handleOpenRecorder}
      className="fixed bottom-6 right-8 z-50 animate-in fade-in slide-in-from-bottom-5 zoom-in-95 duration-200 cursor-pointer select-none group"
      title="Click to open Studio Recorder"
    >
      <div
        className="flex items-center space-x-3 px-4 py-2.5 rounded-2xl
                   bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl
                   border border-zinc-200/90 dark:border-zinc-800/90
                   shadow-2xl hover:shadow-[0_12px_36px_rgba(139,92,246,0.2)]
                   hover:border-violet-300 dark:hover:border-violet-800/80
                   transition-all duration-200 transform hover:-translate-y-0.5"
      >
        {/* Pulsing Status Dot & Mic Icon */}
        <div className="relative flex items-center justify-center">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs ${
              isPaused
                ? 'bg-amber-500'
                : 'bg-violet-600 dark:bg-violet-500 shadow-violet-500/30'
            }`}
          >
            <Mic className="w-4 h-4 text-white" />
          </div>

          {/* Animated pulse ring */}
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
            <span className={`text-[10px] font-mono font-black uppercase tracking-wider ${
              isPaused ? 'text-amber-500' : 'text-violet-600 dark:text-violet-400'
            }`}>
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

        {/* Animated equalizer waves when recording */}
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

        {/* Divider */}
        <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />

        {/* Quick Action Controls */}
        <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
          {/* Pause / Resume Button */}
          <button
            type="button"
            onClick={isPaused ? resumeRecording : pauseRecording}
            className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-xs"
            title={isPaused ? 'Resume Recording' : 'Pause Recording'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
          </button>

          {/* Stop Button */}
          <button
            type="button"
            onClick={() => {
              stopRecording();
              setActiveTool('recorder');
            }}
            className="w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-95 text-white flex items-center justify-center transition-transform cursor-pointer shadow-md shadow-violet-600/25"
            title="Stop and Review in Studio"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* Open In Studio View Button */}
          <button
            type="button"
            onClick={handleOpenRecorder}
            className="w-8 h-8 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
            title="Maximize Studio Recorder"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </div>
  );
};
