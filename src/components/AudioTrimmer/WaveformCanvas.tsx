// ─── WaveformCanvas ────────────────────────────────────────────────────────────
// Canvas-based waveform renderer with interactive trim handles,
// fade-curve overlays, and a moving playhead.

import React, { useRef, useEffect, useCallback, MouseEvent } from 'react';
import { WaveformPeaks } from './useWaveformDecoder';

export interface WaveformRegion {
  inPoint: number;   // seconds from start
  outPoint: number;  // seconds from start
}

export interface WaveformFades {
  fadeInDuration: number;   // seconds
  fadeOutDuration: number;  // seconds
}

export interface WaveformCanvasProps {
  peaks: WaveformPeaks | null;
  duration: number;
  region: WaveformRegion;
  fades: WaveformFades;
  playhead: number;        // seconds
  accentColor: string;
  isDarkMode: boolean;
  onRegionChange: (region: WaveformRegion) => void;
  onSeek: (time: number, isDragging?: boolean) => void;
  className?: string;
}

type DragTarget = 'in' | 'out' | 'playhead' | null;

const HANDLE_HIT_PX = 16;
const MIN_REGION_SEC = 0.1;
const SIDE_PAD = 26; // Side margin in pixels so START and END tabs never get clipped off at edges

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  peaks,
  duration,
  region,
  fades,
  playhead,
  accentColor,
  isDarkMode,
  onRegionChange,
  onSeek,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragTarget>(null);
  const animFrameRef = useRef<number>(0);

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
      if (width <= SIDE_PAD * 2) return 0;
      const trackW = width - SIDE_PAD * 2;
      const clampedX = Math.max(SIDE_PAD, Math.min(width - SIDE_PAD, x));
      return Math.max(0, Math.min(duration, ((clampedX - SIDE_PAD) / trackW) * duration));
    },
    [duration],
  );

  // ── Draw ────────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    if (W <= 0 || H <= 0) return;

    // Ensure backing buffer matches DPR
    const targetW = Math.round(W * dpr);
    const targetH = Math.round(H * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    // Reset transform matrix and apply DPR scale
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    // ── Layout metrics (all in CSS pixels) ──
    const topGutter = 20;    // Headroom for top START / END tabs
    const bottomGutter = 22; // Footer for bottom playhead puck & time ruler
    const trackTop = topGutter;
    const trackBottom = H - bottomGutter;
    const trackH = Math.max(10, trackBottom - trackTop);
    const trackLeft = SIDE_PAD;
    const trackRight = W - SIDE_PAD;
    const trackW = Math.max(1, trackRight - trackLeft);
    const mid = trackTop + trackH / 2;

    // Clear canvas background
    const bgColor = isDarkMode ? '#131316' : '#f8fafc';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    // ── Track Background Box & Border ──
    const trackBg = isDarkMode ? '#18181b' : '#ffffff';
    ctx.fillStyle = trackBg;
    ctx.fillRect(trackLeft, trackTop, trackW, trackH);

    // ── Background Grid Lines (Studio grid pattern) ──
    ctx.strokeStyle = isDarkMode ? '#27272a55' : '#e2e8f0aa';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    const hSteps = 4;
    for (let i = 1; i < hSteps; i++) {
      const y = trackTop + (trackH / hSteps) * i;
      ctx.beginPath();
      ctx.moveTo(trackLeft, y);
      ctx.lineTo(trackRight, y);
      ctx.stroke();
    }

    // Vertical grid lines
    const vSteps = 16;
    for (let i = 1; i < vSteps; i++) {
      const x = trackLeft + (trackW / vSteps) * i;
      ctx.beginPath();
      ctx.moveTo(x, trackTop);
      ctx.lineTo(x, trackBottom);
      ctx.stroke();
    }

    // Effective in and out times (fallback to duration if outPoint is 0)
    const effectiveIn = region.inPoint;
    const effectiveOut = region.outPoint > 0 ? region.outPoint : duration;

    // ── Selected Region Shading [inPoint .. outPoint] ──
    if (duration > 0) {
      const inX = timeToX(effectiveIn, W);
      const outX = timeToX(effectiveOut, W);
      const regionW = Math.max(0, outX - inX);

      // Selected area background tint (vibrant cyan/sky blue)
      ctx.fillStyle = isDarkMode ? 'rgba(56, 189, 248, 0.22)' : 'rgba(14, 165, 233, 0.18)';
      ctx.fillRect(inX, trackTop, regionW, trackH);

      // Top & bottom bounding border for selected area
      ctx.strokeStyle = isDarkMode ? 'rgba(56, 189, 248, 0.55)' : 'rgba(14, 165, 233, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(inX, trackTop);
      ctx.lineTo(outX, trackTop);
      ctx.moveTo(inX, trackBottom);
      ctx.lineTo(outX, trackBottom);
      ctx.stroke();

      // Outside unselected dim overlay
      ctx.fillStyle = isDarkMode ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.06)';
      if (inX > trackLeft) {
        ctx.fillRect(trackLeft, trackTop, inX - trackLeft, trackH);
      }
      if (outX < trackRight) {
        ctx.fillRect(outX, trackTop, trackRight - outX, trackH);
      }
    }

    // ── Waveform Outline / Bars ──
    if (peaks && peaks.length > 0) {
      const barW = trackW / peaks.length;
      const inX = timeToX(effectiveIn, W);
      const outX = timeToX(effectiveOut, W);
      const halfH = (trackH / 2) * 0.88;

      for (let i = 0; i < peaks.length; i++) {
        const x = trackLeft + i * barW;
        const maxY = Math.abs(peaks.maxs[i]) * halfH;
        const minY = Math.abs(peaks.mins[i]) * halfH;
        const isInRegion = x >= inX && x <= outX;

        if (isInRegion) {
          // Inside selection: Vibrant blue/cyan waveform
          ctx.fillStyle = isDarkMode ? '#38bdf8' : '#0284c7';
        } else {
          // Outside selection: muted color
          ctx.fillStyle = isDarkMode ? '#52525baa' : '#94a3b8aa';
        }

        ctx.fillRect(x, mid - maxY, Math.max(barW - 0.5, 0.75), maxY + minY);
      }
    } else {
      // Flat center line if no waveform
      ctx.strokeStyle = isDarkMode ? '#3f3f46' : '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(trackLeft, mid);
      ctx.lineTo(trackRight, mid);
      ctx.stroke();
    }

    // ── Track Outer Border ──
    ctx.strokeStyle = isDarkMode ? '#3f3f46' : '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(trackLeft, trackTop, trackW, trackH);

    // ── Center Zero Line ──
    ctx.strokeStyle = isDarkMode ? '#3f3f4677' : '#cbd5e177';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(trackLeft, mid);
    ctx.lineTo(trackRight, mid);
    ctx.stroke();

    // ── BAR 1: Selection Start (Green / Lime with Top START Tab) ──
    if (duration > 0) {
      const inX = timeToX(effectiveIn, W);
      const startColor = '#84cc16'; // Lime green
      const startDarkColor = '#4d7c0f';

      // Vertical Line across track
      ctx.strokeStyle = startColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(inX, trackTop);
      ctx.lineTo(inX, trackBottom);
      ctx.stroke();

      // Top Tab Handle (Protruding above track)
      const tabW = 38;
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

      // Start Tab Label
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('START', tabX + tabW / 2, tabY + tabH / 2 + 3);
    }

    // ── BAR 2: Selection End (Purple / Lavender with Top END Tab) ──
    if (duration > 0) {
      const outX = timeToX(effectiveOut, W);
      const endColor = '#c084fc'; // Purple / Lavender
      const endDarkColor = '#7e22ce';

      // Vertical Line across track
      ctx.strokeStyle = endColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(outX, trackTop);
      ctx.lineTo(outX, trackBottom);
      ctx.stroke();

      // Top Tab Handle (Protruding above track)
      const tabW = 34;
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

      // End Tab Label
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('END', tabX + tabW / 2, tabY + tabH / 2 + 3);
    }

    // ── BAR 3: Song Play Point (Electric Blue with Bottom Scrubber Puck) ──
    if (duration > 0) {
      const px = timeToX(playhead, W);
      const playColor = '#3b82f6'; // Electric blue

      // Vertical Line across entire track
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

      // Bottom Circular Scrubber Puck (Bullseye handle at track bottom ruler)
      const puckY = trackBottom + 10;
      
      // Outer blue circle
      ctx.fillStyle = playColor;
      ctx.beginPath();
      ctx.arc(px, puckY, 7.5, 0, Math.PI * 2);
      ctx.fill();

      // Middle white ring
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, puckY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Inner blue dot
      ctx.fillStyle = playColor;
      ctx.beginPath();
      ctx.arc(px, puckY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Time ruler ticks in bottom gutter ──
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
  }, [peaks, duration, region, fades, playhead, accentColor, isDarkMode, timeToX]);

  // Re-draw on every prop change
  useEffect(() => {
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  // Resize observer to handle canvas DPR and container size changes
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mouse events ──────────────────────────────────────────────────────────
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

    const HIT_PX = 16;

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
      // Clicked open track area -> seek playhead and begin dragging
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
    const HIT_PX = 16;

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
        style={{ cursor: 'crosshair' }}
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}
