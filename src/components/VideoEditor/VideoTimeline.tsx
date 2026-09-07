// ─── VideoTimeline.tsx ────────────────────────────────────────────────────────
// Clipchamp-Grade Multi-Track Timeline:
//   - Top Time Ruler with 10s tick marks, "+" crosses, and clip duration pill (e.g. 16m 14s)
//   - Full-Height Playhead with white capsule head, crisp vertical needle, and bottom puck
//   - Track 1: Text Track ("T + Add text")
//   - Track 2: Video Filmstrip Track with draggable IN/OUT handles, thumbnails & speaker icon
//   - Track 3: Audio Waveform Track ("♪ + Add audio") with HIDE/SHOW toggle
//   - Floating Bottom-Right Zoom Toolbar: Zoom in/out, fit to timeline
//   - Themed natively with AUVID's var(--accent) cyan styling

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Type, Music, Volume2, ZoomIn, ZoomOut, Maximize2,
} from 'lucide-react';
import type { VideoRegion, ClipSegment } from './types';

export interface VideoTimelineProps {
  duration: number;
  region: VideoRegion;
  playhead: number;
  thumbnails: string[];
  accentColor: string;
  isDarkMode: boolean;
  onRegionChange: (region: VideoRegion) => void;
  onSeek: (time: number, isDragging?: boolean) => void;
  className?: string;
  clips?: ClipSegment[];
  activeClipId?: string;
  onSelectClip?: (id: string) => void;
  razorMode?: boolean;
  onRazorSplit?: (time: number) => void;
  // Audio & Text track integrations
  bgmTrackName?: string | null;
  onAddAudio?: () => void;
  onAddText?: () => void;
}

const MIN_REGION_SEC = 0.2;

export const VideoTimeline: React.FC<VideoTimelineProps> = ({
  duration,
  region,
  playhead,
  thumbnails,
  accentColor = '#06b6d4',
  isDarkMode = true,
  onRegionChange,
  onSeek,
  className = '',
  clips = [],
  activeClipId,
  onSelectClip,
  razorMode = false,
  onRazorSplit,
  bgmTrackName,
  onAddAudio,
  onAddText,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingPlayhead = useRef(false);
  const isDraggingHandle = useRef<'in' | 'out' | null>(null);

  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0); // 1.0x to 4.0x
  const [isAudioHidden, setIsAudioHidden] = useState<boolean>(false);
  const [textTrackAdded, setTextTrackAdded] = useState<boolean>(false);

  // Coordinate helper: time to percentage (0 to 100%)
  const timeToPct = useCallback(
    (t: number): number => {
      if (duration <= 0) return 0;
      return Math.max(0, Math.min(100, (t / duration) * 100));
    },
    [duration],
  );

  // Coordinate helper: clientX to time in seconds
  const clientXToTime = useCallback(
    (clientX: number): number => {
      if (!trackContainerRef.current || duration <= 0) return 0;
      const rect = trackContainerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      return pct * duration;
    },
    [duration],
  );

  // ── Global Mouse Listeners for Playhead & Handle Dragging ──────────────────
  useEffect(() => {
    const handleWindowMouseMove = (e: globalThis.MouseEvent) => {
      if (isDraggingPlayhead.current) {
        const t = clientXToTime(e.clientX);
        onSeek(t, true);
      } else if (isDraggingHandle.current === 'in') {
        const t = clientXToTime(e.clientX);
        const curOut = region.outPoint > 0 ? region.outPoint : duration;
        onRegionChange({
          ...region,
          inPoint: Math.max(0, Math.min(t, curOut - MIN_REGION_SEC)),
        });
      } else if (isDraggingHandle.current === 'out') {
        const t = clientXToTime(e.clientX);
        onRegionChange({
          ...region,
          outPoint: Math.min(duration, Math.max(t, region.inPoint + MIN_REGION_SEC)),
        });
      }
    };

    const handleWindowMouseUp = (e: globalThis.MouseEvent) => {
      if (isDraggingPlayhead.current) {
        const t = clientXToTime(e.clientX);
        onSeek(t, false);
        isDraggingPlayhead.current = false;
      }
      isDraggingHandle.current = null;
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [clientXToTime, duration, onRegionChange, onSeek, region]);

  // Handle click / mousedown on tracks or ruler
  const handleTrackAreaMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // If clicked on razor mode, split at that time
    if (razorMode && onRazorSplit) {
      const t = clientXToTime(e.clientX);
      onRazorSplit(t);
      return;
    }

    isDraggingPlayhead.current = true;
    const t = clientXToTime(e.clientX);
    onSeek(t, true);
  };

  // Generate ruler tick marks with pixel-aware adaptive spacing
  const rulerTicks = React.useMemo(() => {
    if (duration <= 0) return [];
    // Candidate step sizes in seconds
    const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    // ~600px ruler width assumed; min 72px gap between labels
    const maxTicks = Math.floor(600 / 72);
    const step = candidates.find((s) => Math.ceil(duration / s) <= maxTicks) ?? 600;
    const ticks: { time: number; label: string; pct: number }[] = [];
    for (let t = 0; t <= duration; t += step) {
      ticks.push({ time: t, label: formatTime(t, false), pct: (t / duration) * 100 });
    }
    return ticks;
  }, [duration]);

  const effectiveIn = region.inPoint;
  const effectiveOut = region.outPoint > 0 ? region.outPoint : duration;
  const inPct = timeToPct(effectiveIn);
  const outPct = timeToPct(effectiveOut);
  const playheadPct = timeToPct(playhead);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col w-full h-full bg-[#f4f5f7] dark:bg-[#111115] text-zinc-700 dark:text-zinc-300 select-none overflow-hidden ${className}`}
    >
      {/* ── 1. Time Ruler Bar (Clipchamp style: Pure white with dots) ───── */}
      <div
        className="relative h-7 shrink-0 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 cursor-pointer overflow-hidden"
        onMouseDown={handleTrackAreaMouseDown}
        onMouseMove={(e) => {
          if (razorMode) setHoverTime(clientXToTime(e.clientX));
        }}
        onMouseLeave={() => setHoverTime(null)}
      >
        <div
          ref={trackContainerRef}
          className="relative w-full h-full"
          style={{ width: `${zoomLevel * 100}%` }}
        >
          {/* Ruler tick lines + time labels */}
          {rulerTicks.map((tick) => (
            <div
              key={tick.time}
              className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
              style={{ left: `${tick.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="w-px h-2 bg-zinc-300 dark:bg-zinc-600 mt-0.5 shrink-0" />
              <span className="text-[9px] font-mono font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5 whitespace-nowrap leading-none">
                {tick.label}
              </span>
            </div>
          ))}

          {/* Clip Duration Pill Tag at Selection End */}
          {duration > 0 && (
            <div
              className="absolute top-1 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shadow pointer-events-none z-10"
              style={{
                left: `${outPct}%`,
                backgroundColor: 'color-mix(in srgb, var(--accent) 25%, transparent)',
                color: 'var(--accent)',
                border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
              }}
            >
              {formatDurationHuman(effectiveOut - effectiveIn)}
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Multi-Track Workspace Area ──────────────────────────────── */}
      <div
        className="flex-1 min-h-0 relative overflow-y-auto overflow-x-auto no-scrollbar py-2 px-3 space-y-2 cursor-pointer"
        onMouseDown={handleTrackAreaMouseDown}
        onMouseMove={(e) => {
          if (razorMode) setHoverTime(clientXToTime(e.clientX));
        }}
        onMouseLeave={() => setHoverTime(null)}
      >
        <div
          className="relative min-w-full flex flex-col gap-2 pb-10"
          style={{ width: `${zoomLevel * 100}%` }}
        >
          {/* ── TRACK 1: Text Overlay Track ("T + Add text") ───────────── */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              setTextTrackAdded((prev) => !prev);
              onAddText?.();
            }}
            className={`h-7 rounded-lg border border-dashed flex items-center px-3 gap-2 transition-colors cursor-pointer group ${
              textTrackAdded
                ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300'
                : 'border-zinc-300 dark:border-zinc-700/80 bg-white dark:bg-zinc-900/60 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-600 dark:text-zinc-400 shadow-2xs'
            }`}
          >
            <Type className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="text-[11px] font-bold tracking-tight">
              {textTrackAdded ? 'Text Overlay Layer Active' : '+ Add text'}
            </span>
          </div>

          {/* ── TRACK 2: Main Video Filmstrip Track ────────────────────── */}
          <div className="relative h-14 rounded-xl bg-zinc-900 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 overflow-hidden group shadow-sm">
            {/* Trimmed Selection Block with Clipchamp Handles & Accent Outline */}
            <div
              className="absolute inset-y-0 rounded-lg overflow-hidden flex items-center transition-all z-10"
              style={{
                left: `${inPct}%`,
                width: `${Math.max(1, outPct - inPct)}%`,
                border: '2px solid var(--accent)',
                boxShadow: '0 0 16px color-mix(in srgb, var(--accent) 30%, transparent)',
              }}
            >
              {/* Keyframe Thumbnails Continuous Strip */}
              <div className="absolute inset-0 flex items-center pointer-events-none opacity-85">
                {thumbnails.length > 0 ? (
                  thumbnails.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className="h-full flex-1 object-cover min-w-[48px]"
                    />
                  ))
                ) : (
                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-600 text-xs">
                    No thumbnails
                  </div>
                )}
              </div>

              {/* Top-Left Audio Speaker Icon Badge (Matching Clipchamp) */}
              <div className="absolute top-1.5 left-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-sm flex items-center gap-1 text-[10px] font-bold text-white shadow pointer-events-none z-20">
                <Volume2 className="w-3 h-3 text-cyan-400" />
              </div>

              {/* Left [IN] Boundary Handle (White Capsule Pill Grip) */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  isDraggingHandle.current = 'in';
                }}
                className="absolute left-0 inset-y-0 w-3 rounded-l-md flex items-center justify-center cursor-ew-resize z-30 transition-transform active:scale-110"
                style={{ backgroundColor: 'var(--accent)' }}
                title="Drag to trim start"
              >
                <div className="w-0.5 h-4 bg-black/60 rounded-full" />
              </div>

              {/* Right [OUT] Boundary Handle (White Capsule Pill Grip) */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  isDraggingHandle.current = 'out';
                }}
                className="absolute right-0 inset-y-0 w-3 rounded-r-md flex items-center justify-center cursor-ew-resize z-30 transition-transform active:scale-110"
                style={{ backgroundColor: 'var(--accent)' }}
                title="Drag to trim end"
              >
                <div className="w-0.5 h-4 bg-black/60 rounded-full" />
              </div>
            </div>

            {/* Dimmed Out-of-bounds overlays */}
            {inPct > 0 && (
              <div
                className="absolute top-0 bottom-0 left-0 bg-black/75 pointer-events-none"
                style={{ width: `${inPct}%` }}
              />
            )}
            {outPct < 100 && (
              <div
                className="absolute top-0 bottom-0 right-0 bg-black/75 pointer-events-none"
                style={{ width: `${100 - outPct}%` }}
              />
            )}
          </div>

          {/* ── TRACK 3: Audio Waveform Track ("♪ + Add audio") ────────── */}
          {!isAudioHidden && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onAddAudio?.();
              }}
              className="relative h-8 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700/80 bg-white dark:bg-zinc-900/60 hover:border-zinc-400 dark:hover:border-zinc-600 flex items-center justify-between px-3 transition-colors cursor-pointer group shadow-2xs"
            >
              <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200">
                <Music className="w-3.5 h-3.5 text-cyan-500" />
                <span className="text-[11px] font-bold">
                  {bgmTrackName ? `Audio: ${bgmTrackName}` : '+ Add audio'}
                </span>
              </div>

              {/* Simulated Waveform Pattern across track */}
              <div className="flex items-center gap-0.5 h-4 opacity-40 group-hover:opacity-60 transition-opacity">
                {Array.from({ length: 32 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-0.5 rounded-full bg-cyan-500"
                    style={{ height: `${20 + ((i * 17) % 80)}%` }}
                  />
                ))}
              </div>

              {/* Hide button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAudioHidden(true);
                }}
                className="text-[10px] font-mono uppercase tracking-wider font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                title="Hide audio track"
              >
                HIDE
              </button>
            </div>
          )}

          {/* ── 3. Full-Height Clipchamp Playhead Needle (Dark in light mode, white in dark mode) ── */}
          {duration > 0 && (
            <div
              className="absolute top-[-28px] bottom-0 w-0 z-40 pointer-events-none select-none"
              style={{ left: `${playheadPct}%` }}
            >
              {/* Playhead Top Rounded Capsule Pill Handle */}
              <div
                className="absolute -top-1 -translate-x-1/2 w-3.5 h-6 rounded-full bg-zinc-900 dark:bg-white shadow-xl flex items-center justify-center cursor-ew-resize pointer-events-auto hover:scale-110 active:scale-95 transition-transform border border-black/20 dark:border-white/20"
                title="Playhead Scrub Puck"
              >
                <div className="w-1 h-2 bg-zinc-400 dark:bg-zinc-600 rounded-full" />
              </div>

              {/* Playhead Vertical Line extending across all tracks */}
              <div className="w-[1.5px] h-full bg-zinc-900 dark:bg-white shadow-[0_0_8px_rgba(0,0,0,0.25)] dark:shadow-[0_0_8px_rgba(255,255,255,0.8)] -translate-x-1/2" />

              {/* Playhead Bottom Triangle Pointer */}
              <div
                className="absolute -bottom-1 -translate-x-1/2 w-0 h-0 pointer-events-none"
                style={{
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: `7px solid ${isDarkMode ? 'white' : '#18181b'}`,
                }}
              />
            </div>
          )}

          {/* ── 4. Razor Split Guide Needle (When Razor Mode Active) ─── */}
          {razorMode && hoverTime !== null && duration > 0 && (
            <div
              className="absolute top-[-28px] bottom-0 w-0 z-30 pointer-events-none"
              style={{ left: `${timeToPct(hoverTime)}%` }}
            >
              <div className="w-[2px] h-full border-l-2 border-dashed border-red-500 -translate-x-1/2" />
              <div className="absolute top-0 -translate-x-1/2 px-1.5 py-0.5 rounded bg-red-500 text-white text-[8px] font-black shadow">
                SPLIT
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Floating Bottom-Right Zoom Toolbar (Clipchamp White Pill) ── */}
      <div className="absolute bottom-4 right-5 z-30 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-md text-zinc-600 dark:text-zinc-300">
        <button
          type="button"
          onClick={() => setZoomLevel((z) => Math.max(1.0, z - 0.5))}
          disabled={zoomLevel <= 1.0}
          className="p-1 hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setZoomLevel((z) => Math.min(4.0, z + 0.5))}
          disabled={zoomLevel >= 4.0}
          className="p-1 hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-3 bg-zinc-700 mx-0.5" />

        <button
          type="button"
          onClick={() => setZoomLevel(1.0)}
          className="p-1 hover:text-white transition-colors cursor-pointer"
          title="Fit to Timeline"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ── Timecode Format Helpers ──────────────────────────────────────────────────
export function formatTime(seconds: number, includeSubseconds = true): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);

  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');

  if (h > 0) {
    const hh = h.toString().padStart(2, '0');
    return includeSubseconds ? `${hh}:${mm}:${ss}.${ms}` : `${hh}:${mm}:${ss}`;
  }
  return includeSubseconds ? `${mm}:${ss}.${ms}` : `${mm}:${ss}`;
}

export function formatDurationHuman(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
