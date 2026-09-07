// ─── useVideoFiles.ts ─────────────────────────────────────────────────────────
// Manages the list of loaded video files:
//   - Loading files from native dialog or file input
//   - IPC probing metadata via video:get-info
//   - Background thumbnail generation via video:get-thumbnails
//   - Syncing from global MediaContext (when files arrive from Downloader/Home)

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMediaContext } from '@/Provider/MediaContext';
import type { VideoFile } from '../types';
import { VIDEO_EXTS } from '../types';

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function probeVideoInfo(filePath: string): Promise<Partial<VideoFile>> {
  try {
    const info = await window.ipcRenderer?.invoke('video:get-info', filePath) as {
      duration: number;
      width: number;
      height: number;
      aspectRatio: string;
      fps: number;
      videoCodec: string;
      audioCodec: string;
    } | null;
    if (!info) return {};
    return {
      duration: info.duration,
      width: info.width,
      height: info.height,
      aspectRatio: info.aspectRatio,
      fps: info.fps,
      videoCodec: info.videoCodec,
      audioCodec: info.audioCodec,
    };
  } catch {
    return {};
  }
}

function makeBlankFile(id: string, name: string, path: string, size = 0): VideoFile {
  return {
    id,
    name,
    path,
    size,
    duration: 0,
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    fps: 30,
    videoCodec: 'unknown',
    audioCodec: 'none',
    thumbnails: [],
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVideoFiles() {
  const { mediaList, selectedMedia } = useMediaContext();

  const [files, setFiles] = useState<VideoFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedFile = files.find((f) => f.id === selectedId) ?? null;

  // ── Load a single file path (probe + queue thumbnail gen) ──────────────────
  const loadFileByPath = useCallback(async (filePath: string, size = 0): Promise<string | null> => {
    // De-dupe
    let existing: VideoFile | undefined;
    setFiles((prev) => {
      existing = prev.find((f) => f.path === filePath);
      return prev;
    });
    if (existing) {
      setSelectedId(existing.id);
      return existing.id;
    }

    const id = crypto.randomUUID();
    const name = filePath.split(/[\\/]/).pop() ?? filePath;
    const blank = makeBlankFile(id, name, filePath, size);
    setFiles((prev) => [...prev, blank]);
    setSelectedId(id);

    // Async probe
    const info = await probeVideoInfo(filePath);
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, ...info } : f,
      ),
    );
    return id;
  }, []);

  // ── Load multiple paths at once (dialog result) ────────────────────────────
  const addFiles = useCallback(async (paths: string[]) => {
    for (const p of paths) {
      await loadFileByPath(p);
    }
  }, [loadFileByPath]);

  // ── Handle HTML file input change ──────────────────────────────────────────
  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files;
      if (!picked || picked.length === 0) return;
      for (let i = 0; i < picked.length; i++) {
        const f = picked[i];
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        if (!VIDEO_EXTS.has(ext)) continue;
        const p =
          (window as unknown as { api?: { getPathForFile: (file: File) => string } }).api
            ?.getPathForFile(f) ||
          (f as unknown as { path?: string }).path ||
          f.name;
        await loadFileByPath(p, f.size);
      }
      if (e.target) e.target.value = '';
    },
    [loadFileByPath],
  );

  // ── Browse via Electron native dialog ──────────────────────────────────────
  const handleBrowseVideo = useCallback(async () => {
    try {
      const result =
        ((await window.ipcRenderer?.invoke('dialog:open-video-files')) as string[] | null) ??
        ((await window.ipcRenderer?.invoke('dialog:open-video-file')) as string[] | null);
      if (!result || result.length === 0) return;
      await addFiles(result);
    } catch (err) {
      console.error('[useVideoFiles] Browse error:', err);
    }
  }, [addFiles]);

  // ── Remove a file from the list ────────────────────────────────────────────
  const removeFile = useCallback(
    (id: string) => {
      setFiles((prev) => {
        const remaining = prev.filter((f) => f.id !== id);
        if (id === selectedId) {
          const removedIdx = prev.findIndex((f) => f.id === id);
          const next = remaining[removedIdx] ?? remaining[removedIdx - 1] ?? null;
          setSelectedId(next?.id ?? null);
        }
        return remaining;
      });
    },
    [selectedId],
  );

  // ── Background thumbnail generation ───────────────────────────────────────
  useEffect(() => {
    let active = true;
    files.forEach(async (f) => {
      if (f.thumbnails.length === 0) {
        try {
          const thumbs = (await window.ipcRenderer?.invoke(
            'video:get-thumbnails',
            f.path,
            10,
          )) as string[] | null;
          if (active && thumbs && thumbs.length > 0) {
            setFiles((prev) =>
              prev.map((item) => (item.id === f.id ? { ...item, thumbnails: thumbs } : item)),
            );
          }
        } catch (_) {}
      }
    });
    return () => {
      active = false;
    };
  }, [files]);

  // ── Sync files arriving from global MediaContext ───────────────────────────
  const syncedPathsRef = useRef(new Set<string>());
  useEffect(() => {
    if (mediaList.length === 0) return;
    const videoItems = mediaList.filter(
      (m) =>
        m.type === 'video' ||
        (m.format ? VIDEO_EXTS.has(m.format.toLowerCase()) : false) ||
        VIDEO_EXTS.has(m.name.split('.').pop()?.toLowerCase() || ''),
    );

    videoItems.forEach((item) => {
      if (syncedPathsRef.current.has(item.path)) return;
      syncedPathsRef.current.add(item.path);
      loadFileByPath(item.path, item.size || 0).then((id) => {
        if (id && selectedMedia && selectedMedia.id === item.id) {
          setSelectedId(id);
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaList]);

  return {
    files,
    selectedId,
    selectedFile,
    setSelectedId,
    loadFileByPath,
    addFiles,
    removeFile,
    handleFileInputChange,
    handleBrowseVideo,
    browseVideoFiles: handleBrowseVideo,
  };
}
