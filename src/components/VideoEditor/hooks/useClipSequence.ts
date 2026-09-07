// ─── useClipSequence.ts ───────────────────────────────────────────────────────
// Multi-clip timeline management:
//   - Ordered sequence of ClipSegment[]
//   - Razor split at playhead
//   - Drag reorder
//   - Delete segment
//   - Total sequence duration calculation

import { useState, useCallback } from 'react';
import type { ClipSegment, VideoFile } from '../types';

export function useClipSequence() {
  const [clips, setClips] = useState<ClipSegment[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);

  const activeClip = clips.find((c) => c.id === activeClipId) ?? clips[0] ?? null;

  /** Total duration of the whole assembled sequence */
  const totalSequenceDuration = clips.reduce((sum, c) => sum + c.duration, 0);

  // ── Build initial single-clip sequence from a loaded VideoFile ────────────
  const initFromFile = useCallback((file: VideoFile) => {
    const clip: ClipSegment = {
      id: crypto.randomUUID(),
      fileId: file.id,
      filePath: file.path,
      fileName: file.name,
      inPoint: 0,
      outPoint: file.duration,
      duration: file.duration,
      thumbnails: file.thumbnails,
    };
    setClips([clip]);
    setActiveClipId(clip.id);
  }, []);

  // ── Add a VideoFile as a new clip at the end of the sequence ──────────────
  const addClipFromFile = useCallback((file: VideoFile) => {
    const clip: ClipSegment = {
      id: crypto.randomUUID(),
      fileId: file.id,
      filePath: file.path,
      fileName: file.name,
      inPoint: 0,
      outPoint: file.duration,
      duration: file.duration,
      thumbnails: file.thumbnails,
    };
    setClips((prev) => [...prev, clip]);
    setActiveClipId(clip.id);
  }, []);

  // ── Update in/out points of an existing clip ──────────────────────────────
  const updateClipRegion = useCallback((id: string, inPoint: number, outPoint: number) => {
    setClips((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, inPoint, outPoint, duration: Math.max(0, outPoint - inPoint) }
          : c,
      ),
    );
  }, []);

  // ── Razor split: split the active clip at a given time within its source ──
  // `atTime` is a position within the source file, between clip.inPoint and clip.outPoint
  const razorSplit = useCallback((atTime: number) => {
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === activeClipId);
      if (idx < 0) return prev;

      const clip = prev[idx];
      if (atTime <= clip.inPoint + 0.1 || atTime >= clip.outPoint - 0.1) return prev;

      const left: ClipSegment = {
        ...clip,
        id: crypto.randomUUID(),
        outPoint: atTime,
        duration: atTime - clip.inPoint,
      };
      const right: ClipSegment = {
        ...clip,
        id: crypto.randomUUID(),
        inPoint: atTime,
        duration: clip.outPoint - atTime,
      };

      const next = [...prev];
      next.splice(idx, 1, left, right);
      setActiveClipId(right.id);
      return next;
    });
  }, [activeClipId]);

  // ── Delete a clip from the sequence ──────────────────────────────────────
  const deleteClip = useCallback((id: string) => {
    setClips((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (id === activeClipId) {
        setActiveClipId(remaining[0]?.id ?? null);
      }
      return remaining;
    });
  }, [activeClipId]);

  // ── Reorder clips (drag and drop) ─────────────────────────────────────────
  const reorderClip = useCallback((fromIdx: number, toIdx: number) => {
    setClips((prev) => {
      if (fromIdx === toIdx) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  // ── Update thumbnails for a clip (after thumbnail gen completes) ──────────
  const updateClipThumbnails = useCallback((fileId: string, thumbnails: string[]) => {
    setClips((prev) =>
      prev.map((c) => (c.fileId === fileId ? { ...c, thumbnails } : c)),
    );
  }, []);

  // ── Clear the whole sequence ──────────────────────────────────────────────
  const clearSequence = useCallback(() => {
    setClips([]);
    setActiveClipId(null);
  }, []);

  return {
    clips,
    activeClip,
    activeClipId,
    setActiveClipId,
    totalSequenceDuration,
    initFromFile,
    addClipFromFile,
    updateClipRegion,
    razorSplit,
    deleteClip,
    reorderClip,
    updateClipThumbnails,
    clearSequence,
  };
}
