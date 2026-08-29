// ─── DownloadQueueRow.tsx ───────────────────────────────────────────────────
// Interactive row item representing an active or completed download job.

import React from 'react';
import {
  Film,
  Music,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  FolderOpen,
  XCircle,
  Scissors,
  RefreshCw,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { DownloadJob } from '@/types/mediaDownloader';
import { useMediaContext } from '@/Provider/MediaContext';
import { MediaItem } from '@/types';

interface DownloadQueueRowProps {
  job: DownloadJob;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  accentColor: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(secs?: number): string {
  if (!secs || isNaN(secs) || secs <= 0) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const DownloadQueueRow: React.FC<DownloadQueueRowProps> = ({
  job,
  onCancel,
  onRemove,
  accentColor,
}) => {
  const { setActiveTool, addMediaItem, setSelectedMedia } = useMediaContext();

  const isVideo = job.targetType === 'video';
  const isDownloading = job.status === 'downloading' || job.status === 'merging';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isCancelled = job.status === 'cancelled';

  // Reveal file in Explorer
  const handleReveal = () => {
    if (job.outputPath) {
      window.ipcRenderer?.invoke('shell:reveal-file', job.outputPath);
    }
  };

  // Helper to construct a MediaItem and select it globally
  const dispatchToTool = (tool: 'audio-trim' | 'video-cut' | 'converter') => {
    if (!job.outputPath) return;

    const fileName = job.outputPath.split(/[/\\]/).pop() || job.title || 'media';
    const ext = fileName.split('.').pop()?.toUpperCase() || (isVideo ? 'MP4' : 'MP3');

    const mediaItem: MediaItem = {
      id: 'job_' + job.id + '_' + Date.now(),
      name: fileName,
      path: job.outputPath,
      size: job.totalBytes || job.downloadedBytes || 0,
      type: isVideo ? 'video' : 'audio',
      format: ext,
      duration: job.duration || 0,
      addedAt: new Date().toLocaleTimeString(),
    };

    addMediaItem(mediaItem);
    setSelectedMedia(mediaItem);
    setActiveTool(tool);
  };

  // Open in Trimmer
  const handleOpenInTrimmer = () => {
    dispatchToTool(isVideo ? 'video-cut' : 'audio-trim');
  };

  // Open in Converter
  const handleOpenInConverter = () => {
    dispatchToTool('converter');
  };

  return (
    <div className="p-4 rounded-3xl bg-white/90 dark:bg-[#071f2e]/90 border-2 border-cyan-300/80 dark:border-cyan-500/30 shadow-md hover:border-cyan-400 dark:hover:border-cyan-500/50 transition-all flex flex-col space-y-3">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Thumbnail & Details */}
        <div className="flex items-center space-x-3.5 min-w-0 flex-1">
          {/* Thumbnail / Icon */}
          <div className="w-18 h-12 rounded-2xl overflow-hidden bg-cyan-950 border border-cyan-300/60 dark:border-cyan-500/30 shrink-0 flex items-center justify-center relative shadow-xs">
            {job.thumbnail ? (
              <img
                src={job.thumbnail}
                alt={job.title}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : isVideo ? (
              <Film className="w-6 h-6 text-cyan-400" />
            ) : (
              <Music className="w-6 h-6 text-cyan-400" />
            )}

            {/* Type badge */}
            <span className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-black/85 text-cyan-300">
              {job.ext}
            </span>
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1 space-y-1">
            <h4
              className="text-xs font-black text-cyan-950 dark:text-cyan-50 truncate"
              title={job.title}
            >
              {job.title}
            </h4>

            <div className="flex items-center space-x-2 text-[11px] font-mono text-cyan-900/70 dark:text-cyan-300/70 font-semibold">
              <span>{job.qualityLabel}</span>
              <span>·</span>
              <span>{formatBytes(job.totalBytes || job.downloadedBytes)}</span>
              {job.duration ? (
                <>
                  <span>·</span>
                  <span>{formatDuration(job.duration)}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {/* Completed Quick Actions */}
          {isCompleted && (
            <>
              {/* Reveal in Explorer */}
              <button
                type="button"
                onClick={handleReveal}
                className="p-2 rounded-xl bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-950/80 dark:hover:bg-cyan-900 text-cyan-950 dark:text-cyan-200 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-2xs"
                title="Reveal file in Explorer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reveal</span>
              </button>

              {/* Open in Trimmer */}
              <button
                type="button"
                onClick={handleOpenInTrimmer}
                className="p-2 px-3 rounded-xl bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-950/80 dark:hover:bg-cyan-900 text-cyan-950 dark:text-cyan-200 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-2xs"
                title={isVideo ? 'Edit in Video Cutter Studio' : 'Trim in Audio Studio'}
              >
                <Scissors className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isVideo ? 'Cut Video' : 'Trim Audio'}</span>
              </button>

              {/* Open in Converter */}
              <button
                type="button"
                onClick={handleOpenInConverter}
                className="p-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white text-xs font-black transition-all cursor-pointer flex items-center space-x-1 shadow-md shadow-cyan-600/20"
                title="Open in Format Converter"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Convert</span>
              </button>
            </>
          )}

          {/* Cancel Downloading Button */}
          {isDownloading && (
            <button
              type="button"
              onClick={() => onCancel(job.id)}
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
              title="Cancel download"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cancel</span>
            </button>
          )}

          {/* Dismiss / Delete row */}
          {!isDownloading && (
            <button
              type="button"
              onClick={() => onRemove(job.id)}
              className="p-2 rounded-xl hover:bg-red-500/10 text-cyan-800/60 hover:text-red-500 dark:text-cyan-400/60 transition-colors cursor-pointer"
              title="Remove from list"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress & Speed Meters */}
      {isDownloading && (
        <div className="space-y-1.5 pt-1">
          <div className="w-full h-2 rounded-full bg-cyan-200/60 dark:bg-cyan-950/80 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-cyan-500 to-sky-500 shadow-xs"
              style={{ width: `${job.progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-cyan-900/80 dark:text-cyan-300/80">
            <span className="flex items-center space-x-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-cyan-600 dark:text-cyan-400" />
              <span>{job.status === 'merging' ? 'Merging Video & Audio Streams...' : `Downloading (${Math.round(job.progress)}%)`}</span>
            </span>

            <div className="flex items-center space-x-2">
              {job.speed ? <span>{job.speed}</span> : null}
              {job.eta ? <span>ETA: {job.eta}</span> : null}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {isFailed && job.error && (
        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[11px] font-medium flex items-center space-x-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{job.error}</span>
        </div>
      )}
    </div>
  );
};
