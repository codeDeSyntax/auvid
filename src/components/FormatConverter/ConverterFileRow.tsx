// ─── ConverterFileRow.tsx ────────────────────────────────────────────────────
// Interactive queue row for format converter with per-file target format selector.

import React from 'react';
import {
  Film, Music, Play, CheckCircle2, AlertCircle,
  Loader2, Trash2, FolderOpen, ArrowRight, RefreshCw
} from 'lucide-react';
import {
  ConverterFileEntry,
  TargetFormat,
  AUDIO_FORMATS,
  VIDEO_FORMATS,
} from '@/types/formatConverter';

interface ConverterFileRowProps {
  entry: ConverterFileEntry;
  onRemove: (id: string) => void;
  onFormatChange: (id: string, format: TargetFormat) => void;
  onConvertSingle: (entry: ConverterFileEntry) => void;
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

export const ConverterFileRow: React.FC<ConverterFileRowProps> = ({
  entry,
  onRemove,
  onFormatChange,
  onConvertSingle,
  accentColor,
}) => {
  const isVideo = entry.probe?.type === 'video';

  return (
    <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Thumbnail & Details */}
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          {/* Thumbnail / Icon */}
          <div className="w-14 h-11 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 shrink-0 flex items-center justify-center relative">
            {entry.probe?.thumbnail ? (
              <img
                src={entry.probe.thumbnail}
                alt={entry.name}
                className="w-full h-full object-cover"
              />
            ) : isVideo ? (
              <Film className="w-5 h-5 text-zinc-400" />
            ) : (
              <Music className="w-5 h-5 text-zinc-400" />
            )}
            {entry.probe?.duration ? (
              <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/80 text-[7px] font-mono font-bold text-white">
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
                {entry.probe?.format || entry.name.split('.').pop()}
              </span>
            </div>

            {/* Probe info & Target Format Arrow */}
            <div className="flex items-center space-x-2 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">
              <span>{formatBytes(entry.size)}</span>
              {entry.probe?.duration && (
                <>
                  <span>·</span>
                  <span>{formatTime(entry.probe.duration)}</span>
                </>
              )}
              {entry.status === 'completed' && entry.convertedSize ? (
                <>
                  <span>·</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatBytes(entry.convertedSize)}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Center: Target Format Dropdown */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
          <select
            value={entry.targetFormat}
            onChange={e => onFormatChange(entry.id, e.target.value as TargetFormat)}
            disabled={entry.status === 'converting'}
            className="px-2.5 py-1 text-xs font-mono font-bold uppercase bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl cursor-pointer disabled:opacity-40"
          >
            <optgroup label="Audio Formats">
              {AUDIO_FORMATS.map(f => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Video Formats">
              {VIDEO_FORMATS.map(f => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Right: Status & Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          {entry.status === 'probing' && (
            <div className="flex items-center space-x-1.5 text-xs text-zinc-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Probing…</span>
            </div>
          )}

          {entry.status === 'converting' && (
            <div className="flex items-center space-x-2">
              <div className="flex flex-col items-end">
                <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>
                  {entry.progress}%
                </span>
                {entry.speed && (
                  <span className="text-[9px] font-mono text-zinc-400">
                    {entry.speed}
                  </span>
                )}
              </div>
            </div>
          )}

          {entry.status === 'completed' && (
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => entry.convertedPath && window.ipcRenderer?.invoke('shell:reveal-file', entry.convertedPath)}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center space-x-1 cursor-pointer"
                title="Show in folder"
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
              onClick={() => onConvertSingle(entry)}
              className="p-2 rounded-xl text-zinc-500 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Convert this file"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onRemove(entry.id)}
            disabled={entry.status === 'converting'}
            className="p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40"
            title="Remove from queue"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar when converting */}
      {entry.status === 'converting' && (
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
