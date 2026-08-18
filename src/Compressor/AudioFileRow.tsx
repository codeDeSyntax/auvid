// ─── Audio File Row ────────────────────────────────────────────────────────────
// Individual file entry in the compressor queue. Memo-wrapped to prevent
// re-renders of sibling rows when only one file's progress changes.

import React, { memo } from 'react';
import { Play, Pause, Sparkles, FolderOpen, Trash2, X, Download, Check } from 'lucide-react';
import { AudioFileEntry } from '@/types/audioCompressor';
import { PlayingEqualizer } from '@/components/Player/PlayingEqualizer';

interface AudioFileRowProps {
  file: AudioFileEntry;
  isSelected: boolean;
  isPreviewing?: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onCompress: () => void;
  onCancel: () => void;
  onReveal: (path: string) => void;
  onSave?: (file: AudioFileEntry) => void;
  onPlayPreview?: (file: AudioFileEntry) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(sec: number): string {
  if (!sec || isNaN(sec)) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  processing: 'Processing…',
  done: 'Compressed (Preview Ready)',
  error: 'Error',
  cancelled: 'Cancelled',
};

export const AudioFileRow: React.FC<AudioFileRowProps> = memo(
  ({
    file,
    isSelected,
    isPreviewing = false,
    onSelect,
    onRemove,
    onCompress,
    onCancel,
    onReveal,
    onSave,
    onPlayPreview,
  }) => {
    const isDone = file.status === 'done';
    const isProcessing = file.status === 'processing';
    const isError = file.status === 'error';
    const savings = file.result?.savedPercent ?? 0;

    return (
      <div
        onClick={onSelect}
        className={`group relative flex flex-col px-4 py-3.5 cursor-pointer transition-all border-b border-zinc-200/80 dark:border-zinc-800/60 ${
          isSelected
            ? 'bg-zinc-100/90 dark:bg-zinc-800/60 border-l-4'
            : 'hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 border-l-4 border-l-transparent'
        }`}
        style={isSelected ? { borderLeftColor: 'var(--accent)' } : undefined}
      >
        {/* Main row */}
        <div className="flex items-center space-x-3">
          {/* Play / Status Icon with Mini Pulsing Equalizer */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlayPreview?.(file);
            }}
            title={isDone ? "Listen & Compare (Original vs Compressed)" : "Play Audio Preview"}
            className="group/btn shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black transition-all hover:scale-105 active:scale-95 cursor-pointer relative shadow-xs"
            style={{
              backgroundColor: isPreviewing
                ? 'var(--accent)'
                : isDone
                ? 'color-mix(in srgb, var(--accent) 20%, transparent)'
                : 'color-mix(in srgb, var(--accent) 12%, transparent)',
              color: isPreviewing ? '#000000' : 'var(--accent)',
            }}
          >
            {isPreviewing ? (
              <PlayingEqualizer isPlaying={true} barCount={3} />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          {/* File info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-0.5">
              <span
                className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate"
                title={file.name}
              >
                {file.name}
              </span>
              <span className="shrink-0 px-1.5 py-0.5 text-[9px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 rounded font-mono uppercase font-semibold">
                {file.format}
              </span>

              {isPreviewing && (
                <PlayingEqualizer isPlaying={true} barCount={4} className="shrink-0" />
              )}

              {isDone && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayPreview?.(file);
                  }}
                  className="shrink-0 flex items-center space-x-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/25 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span className="hidden sm:inline">Listen &amp; Compare</span>
                  <span className="sm:hidden">Compare</span>
                </button>
              )}
            </div>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>{formatBytes(file.size)}</span>
              {file.probe && (
                <>
                  <span>·</span>
                  <span>{formatDuration(file.probe.duration)}</span>
                  <span className="hidden sm:inline">
                    <span>·</span>
                    <span className="ml-2">{file.probe.bitrate} kbps</span>
                  </span>
                  <span className="hidden md:inline">
                    <span>·</span>
                    <span className="ml-2">{file.probe.sampleRate / 1000} kHz</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Savings badge */}
          {isDone && savings > 0 && (
            <div className="shrink-0 text-right mr-1">
              <div className="font-black text-sm" style={{ color: 'var(--accent)' }}>
                -{savings}%
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {formatBytes(file.result!.compressedSize)}
              </div>
            </div>
          )}

          {/* Status & Saved state */}
          <div className="shrink-0 flex items-center space-x-1.5">
            {isDone && file.isSaved ? (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-md flex items-center space-x-1">
                <Check className="w-3 h-3" />
                <span>Saved</span>
              </span>
            ) : (
              <div
                className={`text-[11px] font-bold ${
                  isError
                    ? 'text-red-500 dark:text-red-400'
                    : file.status === 'cancelled'
                    ? 'text-zinc-400 dark:text-zinc-500'
                    : ''
                }`}
                style={
                  isProcessing || isDone
                    ? { color: 'var(--accent)' }
                    : file.status === 'queued'
                    ? { color: undefined }
                    : undefined
                }
              >
                {isProcessing ? `${file.progress}%` : isDone ? "Ready to Save" : STATUS_LABELS[file.status]}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div
            className={`shrink-0 flex items-center space-x-1 transition-opacity ${
              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {isProcessing ? (
              <button
                onClick={onCancel}
                title="Cancel"
                className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors text-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : !isDone ? (
              <button
                onClick={onCompress}
                title="Compress this file"
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 shadow-sm cursor-pointer flex items-center space-x-1 bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Compress</span>
              </button>
            ) : (
              <div className="flex items-center space-x-1">
                {!file.isSaved && onSave && (
                  <button
                    onClick={() => onSave(file)}
                    title="Save compressed audio file"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 shadow-xs cursor-pointer flex items-center space-x-1 bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black"
                  >
                    <Download className="w-3 h-3" />
                    <span>Save</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    const targetPath = file.savedPath || file.result?.outputPath;
                    if (targetPath) onReveal(targetPath);
                  }}
                  title={file.isSaved ? "Reveal in Output Folder" : "Reveal Staged File"}
                  className="p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--accent) 18%, transparent)',
                    color: 'var(--accent)',
                  }}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {!isProcessing && (
              <button
                onClick={onRemove}
                title="Remove from queue"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {(isProcessing || isDone) && (
          <div className="mt-2.5 ml-12">
            <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${isDone ? 100 : file.progress}%`,
                  backgroundColor: 'var(--accent)',
                }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {isError && file.errorMessage && (
          <p className="mt-1.5 ml-12 text-[11px] text-red-500 truncate font-medium">{file.errorMessage}</p>
        )}
      </div>
    );
  },
);

AudioFileRow.displayName = 'AudioFileRow';
