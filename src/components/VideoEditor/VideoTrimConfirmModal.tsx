// ─── VideoTrimConfirmModal.tsx ────────────────────────────────────────────────
// Clean receipt-style summary confirmation modal before executing video trim.

import React, { useEffect } from 'react';
import { X, Scissors, Receipt, AlertTriangle, ArrowRight, Film } from 'lucide-react';
import { formatTime, formatDurationHuman } from './VideoTimeline';

export interface VideoTrimConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fileName: string;
  filePath: string;
  sourceSize: number;
  sourceDuration: number;
  width: number;
  height: number;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  inPoint: number;
  outPoint: number;
  saveMode: 'new-file' | 'in-place';
  cutAction: 'keep' | 'delete';
  speed: number;
  gain: number;
  isMuted: boolean;
  outputFormat: string;
  targetResolution: 'original' | '1080p' | '720p' | '480p';
  accentColor: string;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const VideoTrimConfirmModal: React.FC<VideoTrimConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  fileName,
  filePath,
  sourceSize,
  sourceDuration,
  width,
  height,
  fps,
  videoCodec,
  audioCodec,
  inPoint,
  outPoint,
  saveMode,
  cutAction,
  speed,
  gain,
  isMuted,
  outputFormat,
  targetResolution,
  accentColor,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onConfirm]);

  if (!isOpen) return null;

  const targetDuration = cutAction === 'delete'
    ? Math.max(0, sourceDuration - (outPoint - inPoint))
    : Math.max(0, outPoint - inPoint);

  const estimatedSize = sourceDuration > 0 && sourceSize > 0
    ? Math.round((sourceSize * (targetDuration / sourceDuration)) / (speed > 0 ? speed : 1))
    : 0;

  const isSameFormat = outputFormat === 'same';
  const hasSpeed = Math.abs(speed - 1.0) > 0.02;
  const hasAudioGain = Math.abs(gain - 1.0) > 0.02;
  const hasResolutionChange = targetResolution !== 'original';
  const canLossless = isSameFormat && !hasSpeed && !hasAudioGain && !hasResolutionChange && cutAction === 'keep';

  const ext = outputFormat === 'same'
    ? (fileName.split('.').pop()?.toUpperCase() || 'MP4')
    : outputFormat.toUpperCase();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Receipt Container */}
      <div
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Receipt Top Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-black"
              style={{ backgroundColor: accentColor }}
            >
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                Video Trim Receipt
              </h3>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                {saveMode === 'in-place' ? 'OPERATION: CROP_OVERWRITE' : 'OPERATION: EXPORT_NEW_FILE'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Receipt Content */}
        <div className="px-6 py-4 space-y-3 font-mono text-xs">

          {/* Video Name & Codec Banner */}
          <div className="pb-3 border-b border-dashed border-zinc-200 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate text-xs" title={fileName}>
                {fileName}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0">
                .{ext.toLowerCase()}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5" title={filePath}>
              {filePath}
            </p>
          </div>

          {/* Line Items */}
          <div className="space-y-2 text-[11px]">
            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Source Duration</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatTime(sourceDuration)}</span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Source Size</span>
              <span className="text-zinc-900 dark:text-zinc-100">{formatBytes(sourceSize)}</span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Video Stream</span>
              <span className="text-zinc-900 dark:text-zinc-100">
                {width}x{height} · {fps}fps · {videoCodec.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Selection Range</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                {formatTime(inPoint)} <ArrowRight className="inline w-3 h-3 text-zinc-400 mx-0.5" /> {formatTime(outPoint)}
              </span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Cut Action</span>
              <span className="text-zinc-900 dark:text-zinc-100">
                {cutAction === 'keep' ? 'Keep Selection' : 'Cut Out Selection'}
              </span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Resolution / Speed</span>
              <span className="text-zinc-900 dark:text-zinc-100">
                {targetResolution === 'original' ? 'Original Res' : targetResolution} · {speed}x Speed
              </span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Audio Track</span>
              <span className="text-zinc-900 dark:text-zinc-100">
                {isMuted ? 'Muted' : `Volume: ${Math.round(gain * 100)}%`}
              </span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Encoding Pipeline</span>
              <span className={canLossless ? 'font-bold text-cyan-500' : 'text-zinc-900 dark:text-zinc-100'}>
                {canLossless ? 'Lossless Stream Copy (0ms)' : 'High-Quality Transcode'}
              </span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Save Destination</span>
              <span className="text-zinc-900 dark:text-zinc-100">
                {saveMode === 'in-place' ? 'Overwrite Source File' : 'AUVID Videos Folder'}
              </span>
            </div>
          </div>

          {/* Dashed Total Divider */}
          <div className="pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-zinc-700 dark:text-zinc-300">Output Duration</span>
              <span style={{ color: accentColor }} className="text-sm font-black">
                {formatTime(targetDuration)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">Estimated Output Size</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                {estimatedSize > 0 ? formatBytes(estimatedSize) : '~Proportional'}
              </span>
            </div>
          </div>

          {/* In-Place Alert */}
          {saveMode === 'in-place' && (
            <div className="pt-2 flex items-center space-x-1.5 text-[10px] text-amber-500 font-sans font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Notice: Source video will be overwritten in-place.</span>
            </div>
          )}
        </div>

        {/* Receipt Bottom Actions */}
        <div className="px-6 py-4 bg-zinc-50/80 dark:bg-zinc-950/60 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Cancel (Esc)
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={{ backgroundColor: saveMode === 'in-place' ? '#f59e0b' : accentColor }}
            className="px-5 py-2.5 rounded-xl text-xs font-black text-black shadow-md hover:brightness-105 active:scale-95 transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{saveMode === 'in-place' ? 'Crop & Overwrite' : 'Save Trimmed Video'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
