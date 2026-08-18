// ─── VideoTimeline.tsx ────────────────────────────────────────────────────────
// Interactive canvas-based video timeline featuring:
//   - Filmstrip keyframe preview thumbnails across the timeline width
//   - Draggable Start [IN] and End [OUT] trim boundary tabs
//   - High-precision playhead scrubber puck with timecode ruler ticks
//   - Smooth 60 FPS dragging and seek support

import React, { useRef, useEffect, useCallback, MouseEvent } from 'react';

export interface VideoRegion {
  inPoint: number;
  outPoint: number;
}

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
}

type DragTarget = 'in' | 'out' | 'playhead' | null;

const HANDLE_HIT_PX = 16;
const MIN_REGION_SEC = 0.2;
const SIDE_PAD = 26; // Side margin in pixels so START and END tabs never get clipped off at edges

export const VideoTimeline: React.FC<VideoTimelineProps> = ({
  duration,
  region,
  playhead,
  thumbnails,
  accentColor,
  isDarkMode,
  onRegionChange,
  onSeek,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragTarget>(null);
  const animFrameRef = useRef<number>(0);
  const loadedThumbsRef = useRef<HTMLImageElement[]>([]);

  // ── Pre-load thumbnail images for canvas drawing ────────────────────────────
  useEffect(() => {
    let active = true;
    const imgs: HTMLImageElement[] = [];

    thumbnails.forEach((src) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        if (active && canvasRef.current) {
          // Re-draw when thumbnail image is loaded
          animFrameRef.current = requestAnimationFrame(draw);
        }
      };
      imgs.push(img);
    });

    loadedThumbsRef.current = imgs;
    return () => {
      active = false;
    };
  }, [thumbnails]);

  // ── Coordinate helpers ──────────────────────────────────────────────────────
  const timeToX = useCallback(
    (time: number, width: number): number => {
      if (duration <= 0) return SIDE_PAD;
      const trackW = Math.max(1, width - SIDE_PAD * 2);
      const clampedTime = Math.max(0, Math.min(duration, time));
      return SIDE_PAD + (clampedTime / duration) * trackW;
    },
    [duration],
  );

  const xToTime = useCallback(
    (x: number, width: number): number => {
      if (width <= SIDE_PAD * 2 || duration <= 0) return 0;
      const trackW = width - SIDE_PAD * 2;
      const clampedX = Math.max(SIDE_PAD, Math.min(width - SIDE_PAD, x));
      return Math.max(0, Math.min(duration, ((clampedX - SIDE_PAD) / trackW) * duration));
    },
    [duration],
  );

  // ── Canvas Draw ─────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const trackTop = 20;
    const trackBottom = H - 20;
    const trackHeight = trackBottom - trackTop;
    const trackWidth = Math.max(1, W - SIDE_PAD * 2);

    // 1. Background Track Box
    ctx.fillStyle = isDarkMode ? '#18181b' : '#f4f4f5';
    ctx.fillRect(SIDE_PAD, trackTop, trackWidth, trackHeight);

    // 2. Render Filmstrip Keyframe Thumbnails
    const thumbs = loadedThumbsRef.current;
    if (thumbs.length > 0) {
      const thumbSlotW = trackWidth / thumbs.length;
      thumbs.forEach((img, idx) => {
        if (img.complete && img.naturalWidth > 0) {
          const x = SIDE_PAD + idx * thumbSlotW;
          try {
            ctx.drawImage(img, x, trackTop, thumbSlotW, trackHeight);
          } catch (_) {}
        }
      });
    }

    // 3. Selection Region Calculations
    const effectiveIn = region.inPoint;
    const effectiveOut = region.outPoint > 0 ? region.outPoint : duration;
    const inX = timeToX(effectiveIn, W);
    const outX = timeToX(effectiveOut, W);

    // 4. Dimmed Out-of-Selection Overlays (Left & Right)
    ctx.fillStyle = isDarkMode ? 'rgba(0, 0, 0, 0.70)' : 'rgba(255, 255, 255, 0.75)';
    if (inX > SIDE_PAD) {
      ctx.fillRect(SIDE_PAD, trackTop, inX - SIDE_PAD, trackHeight);
    }
    if (outX < W - SIDE_PAD) {
      ctx.fillRect(outX, trackTop, W - SIDE_PAD - outX, trackHeight);
    }

    // 5. Active Selection Border / Glow
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(inX, trackTop, Math.max(2, outX - inX), trackHeight);

    // ── BAR 1: Selection Start [IN] (Cyan with Top START Tab) ────────────────
    if (duration > 0) {
      const startColor = '#06b6d4'; // Cyan
      const startDarkColor = '#0891b2';

      ctx.strokeStyle = startColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(inX, trackTop);
      ctx.lineTo(inX, trackBottom);
      ctx.stroke();

      // Top Tab Handle
      const tabW = 42;
      const tabH = 18;
      const tabX = Math.max(2, inX - tabW / 2);
      const tabY = 2;

      ctx.fillStyle = startColor;
      ctx.strokeStyle = startDarkColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(tabX, tabY, tabW, tabH, [4, 4, 0, 0]);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('START', tabX + tabW / 2, tabY + tabH / 2 + 3);
    }

    // ── BAR 2: Selection End [OUT] (Lavender / Purple with Top END Tab) ─────
    if (duration > 0) {
      const endColor = '#c084fc'; // Purple / Lavender
      const endDarkColor = '#7e22ce';

      ctx.strokeStyle = endColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(outX, trackTop);
      ctx.lineTo(outX, trackBottom);
      ctx.stroke();

      // Top Tab Handle
      const tabW = 36;
      const tabH = 18;
      const tabX = Math.min(W - tabW - 2, outX - tabW / 2);
      const tabY = 2;

      ctx.fillStyle = endColor;
      ctx.strokeStyle = endDarkColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(tabX, tabY, tabW, tabH, [4, 4, 0, 0]);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('END', tabX + tabW / 2, tabY + tabH / 2 + 3);
    }

    // ── BAR 3: Video Playhead (Electric Blue with Bottom Scrubber Puck) ──────
    if (duration > 0) {
      const px = timeToX(playhead, W);
      const playColor = '#3b82f6';

      // Vertical Line
      ctx.strokeStyle = playColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, trackTop);
      ctx.lineTo(px, trackBottom);
      ctx.stroke();

      // Top subtle marker pin
      ctx.fillStyle = playColor;
      ctx.beginPath();
      ctx.moveTo(px - 4, trackTop);
      ctx.lineTo(px + 4, trackTop);
      ctx.lineTo(px, trackTop + 5);
      ctx.closePath();
      ctx.fill();

      // Bottom Circular Scrubber Puck
      const puckY = trackBottom + 10;
      ctx.fillStyle = playColor;
      ctx.beginPath();
      ctx.arc(px, puckY, 7.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, puckY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = playColor;
      ctx.beginPath();
      ctx.arc(px, puckY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Time ruler ticks in bottom gutter ─────────────────────────────────────
    if (duration > 0) {
      const tickInterval = computeTickInterval(duration);
      ctx.fillStyle = isDarkMode ? '#71717a' : '#94a3b8';
      ctx.font = '8.5px sans-serif';
      ctx.textAlign = 'center';

      let t = 0;
      while (t <= duration) {
        const x = timeToX(t, W);
        ctx.strokeStyle = isDarkMode ? '#27272a' : '#e2e8f0';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, trackBottom);
        ctx.lineTo(x, trackBottom + 4);
        ctx.stroke();
        ctx.fillText(formatTime(t), x, H - 2);
        t += tickInterval;
      }
    }

    ctx.restore();
  }, [duration, region, playhead, accentColor, isDarkMode, timeToX]);

  // Re-draw on state updates
  useEffect(() => {
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  // Resize observer to maintain canvas DPR & sharp drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      draw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    resize();
    return () => ro.disconnect();
  }, [draw]);

  // ── Mouse Drag & Seek Handlers ──────────────────────────────────────────────
  const getCanvasPos = (e: MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasPos(e);
    const W = canvasRef.current!.getBoundingClientRect().width;
    const H = canvasRef.current!.getBoundingClientRect().height;
    const effectiveIn = region.inPoint;
    const effectiveOut = region.outPoint > 0 ? region.outPoint : duration;
    const inX = timeToX(effectiveIn, W);
    const outX = timeToX(effectiveOut, W);
    const px = timeToX(playhead, W);

    const dIn = Math.abs(x - inX);
    const dOut = Math.abs(x - outX);
    const dPlay = Math.abs(x - px);

    const HIT_PX = HANDLE_HIT_PX;

    // Top area priority (Tabs)
    if (y <= 24) {
      if (dIn <= HIT_PX && dIn <= dOut) {
        dragRef.current = 'in';
        return;
      }
      if (dOut <= HIT_PX) {
        dragRef.current = 'out';
        return;
      }
    }

    // Bottom area priority (Playhead Puck)
    if (y >= H - 24 && dPlay <= HIT_PX) {
      dragRef.current = 'playhead';
      return;
    }

    // General line hit tests
    if (dIn <= HIT_PX && (dIn <= dOut && dIn <= dPlay)) {
      dragRef.current = 'in';
    } else if (dOut <= HIT_PX && (dOut <= dIn && dOut <= dPlay)) {
      dragRef.current = 'out';
    } else if (dPlay <= HIT_PX) {
      dragRef.current = 'playhead';
    } else {
      dragRef.current = 'playhead';
      const t = xToTime(x, W);
      onSeek(t, true);
    }
  };

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const { x } = getCanvasPos(e);
    const W = canvasRef.current!.getBoundingClientRect().width;
    const t = xToTime(x, W);

    if (dragRef.current === 'in') {
      const currentOut = region.outPoint > 0 ? region.outPoint : duration;
      onRegionChange({
        ...region,
        inPoint: Math.max(0, Math.min(t, currentOut - MIN_REGION_SEC)),
      });
    } else if (dragRef.current === 'out') {
      onRegionChange({
        ...region,
        outPoint: Math.min(duration, Math.max(t, region.inPoint + MIN_REGION_SEC)),
      });
    } else if (dragRef.current === 'playhead') {
      onSeek(t, true);
    }
  };

  const handleMouseUp = (e: MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current === 'playhead') {
      const { x } = getCanvasPos(e);
      const W = canvasRef.current!.getBoundingClientRect().width;
      const t = xToTime(x, W);
      onSeek(t, false);
    }
    dragRef.current = null;
  };

  const getCursor = (e: MouseEvent<HTMLCanvasElement>): string => {
    const { x, y } = getCanvasPos(e);
    const W = canvasRef.current!.getBoundingClientRect().width;
    const H = canvasRef.current!.getBoundingClientRect().height;
    const effectiveIn = region.inPoint;
    const effectiveOut = region.outPoint > 0 ? region.outPoint : duration;
    const inX = timeToX(effectiveIn, W);
    const outX = timeToX(effectiveOut, W);
    const px = timeToX(playhead, W);
    const HIT_PX = HANDLE_HIT_PX;

    if (y <= 24 && (Math.abs(x - inX) <= HIT_PX || Math.abs(x - outX) <= HIT_PX)) {
      return 'col-resize';
    }
    if (y >= H - 24 && Math.abs(x - px) <= HIT_PX) {
      return 'ew-resize';
    }
    if (Math.abs(x - inX) <= HIT_PX || Math.abs(x - outX) <= HIT_PX || Math.abs(x - px) <= HIT_PX) {
      return 'col-resize';
    }
    return 'pointer';
  };

  return (
    <div className={`relative w-full h-full select-none ${className}`}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => {
          handleMouseMove(e);
          if (canvasRef.current) canvasRef.current.style.cursor = getCursor(e);
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
};

// ── Timecode Helpers ──────────────────────────────────────────────────────────
function computeTickInterval(duration: number): number {
  const targets = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
  for (const t of targets) {
    if (duration / t <= 20) return t;
  }
  return 60;
}

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
