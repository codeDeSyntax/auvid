// ─── VideoFileRow.tsx ────────────────────────────────────────────────────────
// Interactive queue row for each video file with thumbnail, metadata, and status.

import React from 'react';
import {
  Video, Play, CheckCircle2, AlertCircle, Loader2,
  Trash2, FolderOpen, RefreshCw, Film, ArrowRight
} from 'lucide-react';
import { VideoCompressFileEntry, VideoCompressSettings } from '@/types/videoCompressor';

interface VideoFileRowProps {
  entry: VideoCompressFileEntry;
  globalSettings: VideoCompressSettings;
  onRemove: (id: string) => void;
  onCompressSingle: (entry: VideoCompressFileEntry) => void;
  accentColor: string;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTime(secs: number): string {
  if (!secs || isNaN(secs) || secs < 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const VideoFileRow: React.FC<VideoFileRowProps> = ({
  entry,
  globalSettings,
  onRemove,
  onCompressSingle,
  accentColor,
}) => {
  const settings = entry.settingsOverride ? { ...globalSettings, ...entry.settingsOverride } : globalSettings;

  // Compute estimated size
  let estimatedBytes = 0;
  if (entry.probe?.duration && entry.size > 0) {
    if (settings.mode === 'targetSize') {
      const mult = settings.targetSizeUnit === 'KB' ? 1024 : 1024 * 1024;
      estimatedBytes = settings.targetSizeMB * mult;
    } else if (settings.mode === 'percentage') {
      estimatedBytes = Math.round(entry.size * ((100 - settings.percentageReduction) / 100));
    } else if (settings.mode === 'bitrate') {
      const aBitrate = settings.audioCodec === 'mute' ? 0 : settings.audioBitrateKbps;
      estimatedBytes = Math.round(((settings.videoBitrateKbps + aBitrate) * 1000 * entry.probe.duration) / 8);
    } else {
      // CRF rough heuristic
      const factor = Math.max(0.1, Math.min(0.9, 1 - (settings.crf - 18) * 0.04));
      estimatedBytes = Math.round(entry.size * factor);
    }
  }

  const savingsPct = entry.size > 0 && estimatedBytes > 0
    ? Math.round((1 - estimatedBytes / entry.size) * 100)
    : 0;

  const actualSavingsPct = entry.compressedSize && entry.size > 0
    ? Math.round((1 - entry.compressedSize / entry.size) * 100)
    : 0;

  return (
    <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Thumbnail & Details */}
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          {/* Thumbnail */}
          <div className="w-16 h-12 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 shrink-0 flex items-center justify-center relative">
            {entry.probe?.thumbnail ? (
              <img
                src={entry.probe.thumbnail}
                alt={entry.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Film className="w-5 h-5 text-zinc-400" />
            )}
            {entry.probe?.duration ? (
              <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/80 text-[8px] font-mono font-bold text-white">
                {formatTime(entry.probe.duration)}
              </span>
            ) : null}
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate" title={entry.name}>
                {entry.name}
              </p>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                {settings.container}
              </span>
            </div>

            {/* Probe info & Estimated sizes */}
            <div className="flex items-center space-x-2 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">
              <span>{formatBytes(entry.size)}</span>
              {entry.probe && (
                <>
                  <span>·</span>
                  <span>{entry.probe.width}x{entry.probe.height}</span>
                  <span>·</span>
                  <span>{entry.probe.fps}fps</span>
                </>
              )}
              {entry.status === 'completed' && entry.compressedSize ? (
                <>
                  <span>·</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatBytes(entry.compressedSize)} (-{actualSavingsPct}%)
                  </span>
                </>
              ) : estimatedBytes > 0 && entry.status === 'idle' ? (
                <>
                  <span>·</span>
                  <span className="font-bold" style={{ color: accentColor }}>
                    Est: {formatBytes(estimatedBytes)} (-{savingsPct}%)
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right: Status & Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          {entry.status === 'probing' && (
            <div className="flex items-center space-x-1.5 text-xs text-zinc-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Probing…</span>
            </div>
          )}

          {entry.status === 'compressing' && (
            <div className="flex items-center space-x-2">
              <div className="flex flex-col items-end">
                <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>
                  {entry.progress}%
                </span>
                {entry.fps && (
                  <span className="text-[9px] font-mono text-zinc-400">
                    {entry.fps} fps
                  </span>
                )}
              </div>
            </div>
          )}

          {entry.status === 'completed' && (
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => entry.compressedPath && window.ipcRenderer?.invoke('shell:reveal-file', entry.compressedPath)}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center space-x-1 cursor-pointer"
                title="Show compressed video in folder"
              >
                <FolderOpen className="w-3 h-3" />
                <span>Show</span>
              </button>
            </div>
          )}

          {entry.status === 'failed' && (
            <div className="flex items-center space-x-1 text-xs text-red-500 font-bold" title={entry.error}>
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Failed</span>
            </div>
          )}

          {entry.status === 'idle' && (
            <button
              type="button"
              onClick={() => onCompressSingle(entry)}
              className="p-2 rounded-xl text-zinc-500 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Compress this video"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onRemove(entry.id)}
            disabled={entry.status === 'compressing'}
            className="p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40"
            title="Remove from queue"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar when compressing */}
      {entry.status === 'compressing' && (
        <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{ width: `${entry.progress}%`, backgroundColor: accentColor }}
          />
        </div>
      )}
    </div>
  );
};
