// ─── Media Downloader Types ──────────────────────────────────────────────────
// Interfaces for the Televzr/SaveFrom-style universal web downloader suite.

export type DownloadTargetType = 'video' | 'audio';

export type AudioExtractFormat = 'mp3' | 'm4a' | 'flac' | 'wav' | 'opus';

export interface StreamFormatOption {
  formatId: string;
  type: DownloadTargetType;
  qualityLabel: string;        // e.g. "4K (2160p)", "1080p Full HD", "720p HD", "Audio MP3 (320k)"
  resolution?: string;         // e.g. "1920x1080"
  height?: number;             // e.g. 1080
  fps?: number;                // e.g. 60
  ext: string;                 // e.g. "mp4", "webm", "mp3", "m4a"
  filesize?: number;           // in bytes (or approximate)
  vcodec?: string;             // e.g. "avc1.640028" or "vp9"
  acodec?: string;             // e.g. "mp4a.40.2" or "opus"
  isRecommended?: boolean;
}

export interface DownloadProbeResult {
  url: string;
  title: string;
  siteName: string;            // e.g. "YouTube", "TikTok", "Instagram", "Twitter", "SoundCloud"
  uploader?: string;
  channelUrl?: string;
  duration?: number;           // in seconds
  thumbnail?: string;
  description?: string;
  viewCount?: number;
  uploadDate?: string;
  formats: StreamFormatOption[];
  isLive?: boolean;
}

export type DownloadJobStatus =
  | 'probing'
  | 'queued'
  | 'downloading'
  | 'merging'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DownloadJob {
  id: string;
  url: string;
  title: string;
  siteName: string;
  thumbnail?: string;
  duration?: number;
  targetType: DownloadTargetType;
  selectedFormatId: string;
  qualityLabel: string;
  ext: string;
  status: DownloadJobStatus;
  progress: number;            // 0 - 100
  downloadedBytes?: number;
  totalBytes?: number;
  speed?: string;              // e.g. "4.8 MB/s"
  eta?: string;                // e.g. "00:45"
  outputPath?: string;
  outputSize?: number;
  error?: string;
  createdAt: number;
}

export interface DownloadSettings {
  maxConcurrent: number;       // 1 - 5 (default 2)
  autoPasteClipboard: boolean; // default true
  defaultTargetType: DownloadTargetType;
  defaultAudioFormat: AudioExtractFormat;
  embedThumbnail: boolean;     // default true
  embedSubtitles: boolean;     // default false
}

export const DEFAULT_DOWNLOAD_SETTINGS: DownloadSettings = {
  maxConcurrent: 2,
  autoPasteClipboard: true,
  defaultTargetType: 'video',
  defaultAudioFormat: 'mp3',
  embedThumbnail: true,
  embedSubtitles: false,
};
