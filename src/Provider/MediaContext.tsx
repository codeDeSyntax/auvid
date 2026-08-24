import React, { createContext, useContext, useState, ReactNode } from "react";
import { MediaItem, MediaTool, ProcessingJob, OutputFile } from "../types/index.js";

interface MediaContextType {
  activeTool: MediaTool;
  setActiveTool: (tool: MediaTool) => void;
  mediaList: MediaItem[];
  selectedMedia: MediaItem | null;
  setSelectedMedia: (item: MediaItem | null) => void;
  addMediaItem: (item: MediaItem) => void;
  addMediaFiles: (files: FileList | File[]) => void;
  removeMediaItem: (id: string) => void;
  clearAllMedia: () => void;
  jobs: ProcessingJob[];
  addJob: (job: ProcessingJob) => void;
  // Recent output files (last 5 saved/completed outputs across all tools)
  outputFiles: OutputFile[];
  addOutputFile: (file: OutputFile) => void;
  clearOutputFiles: () => void;
  handleMinimize: () => void;
  handleMaximize: () => void;
  handleClose: () => void;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

const MAX_RECENT_OUTPUTS = 5;

export const MediaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTool, setActiveTool] = useState<MediaTool>("dashboard");
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [outputFiles, setOutputFiles] = useState<OutputFile[]>(() => {
    // Persist recents across sessions via localStorage
    try {
      const stored = localStorage.getItem("auvid_recent_outputs");
      if (stored) return JSON.parse(stored) as OutputFile[];
    } catch { /* ignore */ }
    return [];
  });

  const addMediaItem = (item: MediaItem) => {
    setMediaList((prev) => {
      if (prev.some((m) => m.path === item.path)) return prev;
      return [item, ...prev];
    });
    if (!selectedMedia) {
      setSelectedMedia(item);
    }
  };

  const addMediaFiles = (rawFiles: FileList | File[]) => {
    const filesArr = Array.from(rawFiles);
    const newItems: MediaItem[] = [];

    const AUDIO_EXTS = new Set([
      'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'aiff', 'aif', 'alac',
      'ac3', 'amr', 'ape', 'dts', 'mp2', 'mp1', 'm4b', 'm4p', 'aifc', 'caf', 'pcm',
    ]);
    const VIDEO_EXTS = new Set([
      'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp', '3g2',
      'mpg', 'mpeg', 'm2ts', 'ts', 'ogv', 'vob', 'asf', 'rm', 'rmvb', 'divx',
    ]);

    filesArr.forEach((file) => {
      const isVideo = file.type.startsWith("video/");
      const isAudio = file.type.startsWith("audio/");
      const ext = file.name.split(".").pop()?.toLowerCase() || "";

      if (!isVideo && !isAudio && !AUDIO_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) return;

      const mediaType: 'audio' | 'video' = (isVideo || VIDEO_EXTS.has(ext)) ? 'video' : 'audio';
      const resolvedPath = (window.api?.getPathForFile ? window.api.getPathForFile(file) : '') || (file as File & { path?: string }).path || file.name;
      const filePath = resolvedPath;

      const item: MediaItem = {
        id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        name: file.name,
        path: filePath,
        size: file.size,
        type: mediaType,
        format: ext.toUpperCase(),
        addedAt: new Date().toLocaleTimeString(),
        rawFile: file,
      };
      newItems.push(item);
    });

    if (newItems.length > 0) {
      setMediaList((prev) => {
        const filteredNew = newItems.filter((ni) => !prev.some((p) => p.path === ni.path));
        return [...filteredNew, ...prev];
      });
      if (!selectedMedia) {
        setSelectedMedia(newItems[0]);
      }
    }
  };

  const removeMediaItem = (id: string) => {
    setMediaList((prev) => prev.filter((m) => m.id !== id));
    if (selectedMedia?.id === id) {
      setSelectedMedia(null);
    }
  };

  const clearAllMedia = () => {
    setMediaList([]);
    setSelectedMedia(null);
  };

  const addJob = (job: ProcessingJob) => {
    setJobs((prev) => [job, ...prev]);
  };

  // ── Output Files (Recents) ────────────────────────────────────────────────
  const addOutputFile = (file: OutputFile) => {
    setOutputFiles((prev) => {
      // Remove any existing entry for same savedPath to avoid duplicates
      const deduped = prev.filter((f) => f.savedPath !== file.savedPath && f.id !== file.id);
      // Prepend and keep only last MAX_RECENT_OUTPUTS
      const next = [file, ...deduped].slice(0, MAX_RECENT_OUTPUTS);
      try {
        localStorage.setItem("auvid_recent_outputs", JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  const clearOutputFiles = () => {
    setOutputFiles([]);
    try { localStorage.removeItem("auvid_recent_outputs"); } catch { /* ignore */ }
  };

  const handleMinimize = () => {
    if (window.api?.minimizeApp) window.api.minimizeApp();
  };

  const handleMaximize = () => {
    if (window.api?.maximizeApp) window.api.maximizeApp();
  };

  const handleClose = () => {
    if (window.api?.closeApp) window.api.closeApp();
  };

  return (
    <MediaContext.Provider
      value={{
        activeTool,
        setActiveTool,
        mediaList,
        selectedMedia,
        setSelectedMedia,
        addMediaItem,
        addMediaFiles,
        removeMediaItem,
        clearAllMedia,
        jobs,
        addJob,
        outputFiles,
        addOutputFile,
        clearOutputFiles,
        handleMinimize,
        handleMaximize,
        handleClose,
      }}
    >
      {children}
    </MediaContext.Provider>
  );
};

export const useMediaContext = () => {
  const context = useContext(MediaContext);
  if (!context) {
    throw new Error("useMediaContext must be used within a MediaProvider");
  }
  return context;
};
