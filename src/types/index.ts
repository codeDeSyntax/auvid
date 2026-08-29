export type MediaTool = 'dashboard' | 'downloader' | 'audio-compress' | 'video-compress' | 'audio-trim' | 'video-cut' | 'converter' | 'recorder' | 'metadata' | 'settings';

export interface MediaItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'audio' | 'video';
  duration?: number;
  format?: string;
  addedAt: string;
  rawFile?: File;
}

export interface ProcessingJob {
  id: string;
  fileName: string;
  tool: MediaTool;
  progress: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error?: string;
}

/** A completed/saved output file that appears in the Recents feed */
export interface OutputFile {
  id: string;
  name: string;
  savedPath: string;
  originalName: string;
  size: number;           // bytes — compressed size
  originalSize: number;  // bytes — original size
  format: string;
  type: 'audio' | 'video';
  tool: MediaTool;
  savedAt: string;       // human-readable time string
  savedAtMs: number;     // timestamp ms for sorting
}
