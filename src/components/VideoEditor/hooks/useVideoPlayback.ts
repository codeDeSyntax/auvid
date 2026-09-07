// ─── useVideoPlayback.ts ──────────────────────────────────────────────────────
// Full video playback engine: play/pause/seek/loop/frame-step
// and 60fps requestAnimationFrame playhead tracker with region enforcement.

import { useState, useRef, useEffect, useCallback } from 'react';
import type { VideoRegion } from '../types';

interface UseVideoPlaybackProps {
  duration: number;
  region: VideoRegion;
  isLooping: boolean;
}

export function useVideoPlayback({ duration, region, isLooping }: UseVideoPlaybackProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isPlayingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const regionRef = useRef(region);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1.0);

  // Keep regionRef in sync
  useEffect(() => {
    regionRef.current = region;
  }, [region]);

  // ── Sync video element speed/volume ───────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = isMuted ? 0 : Math.min(1.0, Math.max(0, volume));
  }, [volume, isMuted]);

  // ── Stop playback ─────────────────────────────────────────────────────────
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

  // ── Start playback ────────────────────────────────────────────────────────
  const startPlayback = useCallback((fromTime?: number) => {
    const video = videoRef.current;
    if (!video) return;

    const curRegion = regionRef.current;
    const totalDur = duration > 0 ? duration : video.duration || 0;
    let end = curRegion.outPoint > curRegion.inPoint ? curRegion.outPoint : totalDur;
    if (end <= 0 || end > totalDur) end = totalDur;

    let targetTime = fromTime !== undefined ? fromTime : video.currentTime;
    if (targetTime >= end - 0.05 || targetTime < curRegion.inPoint) {
      targetTime = curRegion.inPoint;
    }

    video.currentTime = targetTime;
    setPlayhead(targetTime);

    video
      .play()
      .then(() => {
        isPlayingRef.current = true;
        setIsPlaying(true);
      })
      .catch((err) => {
        console.warn('[useVideoPlayback] Playback prevented:', err);
        isPlayingRef.current = false;
        setIsPlaying(false);
      });
  }, [duration]);

  // ── Toggle play/pause ─────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else {
      startPlayback();
    }
  }, [startPlayback]);

  // ── Frame step helper ─────────────────────────────────────────────────────
  const stepFrame = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.max(0, Math.min(duration, video.currentTime + seconds));
    video.currentTime = next;
    setPlayhead(next);
  }, [duration]);

  // ── Seek scrub ────────────────────────────────────────────────────────────
  const handleSeek = useCallback((time: number, isDragging = false) => {
    isDraggingRef.current = isDragging;
    const video = videoRef.current;
    const totalDur = duration > 0 ? duration : video?.duration || 0;
    const clamped = Math.max(0, Math.min(totalDur > 0 ? totalDur : time, time));
    setPlayhead(clamped);

    if (video) {
      if (!isNaN(clamped) && isFinite(clamped)) {
        try { video.currentTime = clamped; } catch (_) {}
      }
      if (!isDragging && isPlayingRef.current && video.paused) {
        video.play().catch(() => {});
      }
    }
  }, [duration]);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const handleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      video.requestFullscreen().catch(() => {});
    }
  }, []);

  // ── 60fps playhead tracker with region loop/boundary enforcement ──────────
  useEffect(() => {
    let animId: number;
    const track = () => {
      const video = videoRef.current;
      if (video && !video.paused && !isDraggingRef.current) {
        const cur = video.currentTime;
        const curRegion = regionRef.current;
        const totalDur = duration > 0 ? duration : video.duration || 0;
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

  return {
    videoRef,
    isPlaying,
    playhead,
    isMuted,
    volume,
    setIsMuted,
    setVolume,
    stopPlayback,
    startPlayback,
    togglePlay,
    toggleMute: () => setIsMuted((prev) => !prev),
    stepFrame,
    handleSeek,
    handleFullscreen,
    setPlayhead,
  };
}
