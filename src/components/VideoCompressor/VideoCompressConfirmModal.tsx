// ─── VideoCompressConfirmModal.tsx ───────────────────────────────────────────
// Clean receipt-style summary confirmation modal before executing video compression.

import React, { useEffect } from 'react';
import { X, Play, Receipt, ArrowRight, Video, Sparkles, Layers } from 'lucide-react';
import { VideoCompressSettings, VideoCompressFileEntry } from '@/types/videoCompressor';

export interface VideoCompressConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type: 'single' | 'batch';
  targetFile?: VideoCompressFileEntry | null;
  batchCount?: number;
  settings: VideoCompressSettings;
  outputDir: string;
  useHWAccel: boolean;
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

export const VideoCompressConfirmModal: React.FC<VideoCompressConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  type,
  targetFile,
  batchCount = 0,
  settings,
  outputDir,
  useHWAccel,
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

  const isBatch = type === 'batch';

  // Mode label helper
  const getModeLabel = () => {
    switch (settings.mode) {
      case 'percentage':
        return `Reduction: ${settings.percentageReduction}% of original size`;
      case 'targetSize':
        return `Target Size: ${settings.targetSizeMB} ${settings.targetSizeUnit}`;
      case 'crf':
        return `Constant Quality: CRF ${settings.crf} (${settings.codec.toUpperCase()})`;
      case 'bitrate':
        return `Target Bitrate: ${settings.videoBitrateKbps} kbps`;
      default:
        return 'Standard Compression';
    }
  };

  // Estimated size for single file
  let estimatedSizeStr = '~Proportional';
  if (targetFile?.probe?.duration && targetFile.size > 0) {
    if (settings.mode === 'targetSize') {
      estimatedSizeStr = `~${settings.targetSizeMB} ${settings.targetSizeUnit}`;
    } else if (settings.mode === 'percentage') {
      const est = Math.round(targetFile.size * ((100 - settings.percentageReduction) / 100));
      const pct = Math.round((1 - est / targetFile.size) * 100);
      estimatedSizeStr = `${formatBytes(est)} (-${pct}% savings)`;
    } else if (settings.mode === 'bitrate') {
      const est = Math.round(((settings.videoBitrateKbps + (settings.audioCodec === 'mute' ? 0 : settings.audioBitrateKbps)) * 1000 * targetFile.probe.duration) / 8);
      estimatedSizeStr = `~${formatBytes(est)}`;
    }
  }

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
                {isBatch ? `Batch Compress Receipt (${batchCount} Files)` : 'Video Compress Receipt'}
              </h3>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                {useHWAccel ? 'HARDWARE_GPU_ENCODE' : 'SOFTWARE_CPU_MAX_DENSITY'}
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
        <div className="px-6 py-4 space-y-3 font-mono text-xs max-h-[70vh] overflow-y-auto no-scrollbar">

          {/* Single File Title or Batch Summary */}
          <div className="pb-3 border-b border-dashed border-zinc-200 dark:border-zinc-800">
            {targetFile ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate text-xs" title={targetFile.name}>
                    {targetFile.name}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0">
                    .{settings.container}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5 font-sans">
                  {targetFile.probe ? `${targetFile.probe.width}x${targetFile.probe.height} · ${targetFile.probe.fps}fps · ${formatTime(targetFile.probe.duration)}` : formatBytes(targetFile.size)}
                </p>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                  Batch Job: {batchCount} Video Files
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  .{settings.container}
                </span>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="space-y-2 text-[11px]">
            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Compression Mode</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{getModeLabel()}</span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Video Codec</span>
              <span className="text-zinc-900 dark:text-zinc-100 uppercase">{settings.codec} (libx{settings.codec})</span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Resolution Scaling</span>
              <span className="text-zinc-900 dark:text-zinc-100 font-bold">
                {settings.resolution === 'original' ? 'Keep Original Resolution' : settings.resolution.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Frame Rate</span>
              <span className="text-zinc-900 dark:text-zinc-100">
                {settings.fps === 'original' ? 'Keep Original FPS' : `${settings.fps} fps`}
              </span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Audio Channel</span>
              <span className="text-zinc-900 dark:text-zinc-100">
                {settings.audioCodec === 'mute'
                  ? 'Muted (Audio Stripped)'
                  : `${settings.audioCodec.toUpperCase()} · ${settings.audioBitrateKbps} kbps (${settings.audioChannels})`}
              </span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Speed Preset</span>
              <span className="text-zinc-900 dark:text-zinc-100 capitalize">{settings.speedPreset}</span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Output Directory</span>
              <span className="text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]" title={outputDir}>
                Videos/AUVID
              </span>
            </div>
          </div>

          {/* Dashed Total Divider */}
          <div className="pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-zinc-700 dark:text-zinc-300">Estimated Output Size</span>
              <span style={{ color: accentColor }} className="text-sm font-black">
                {estimatedSizeStr}
              </span>
            </div>
          </div>
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
            style={{ backgroundColor: accentColor }}
            className="px-5 py-2.5 rounded-xl text-xs font-black text-black shadow-md hover:brightness-105 active:scale-95 transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            <span>{isBatch ? `Compress All (${batchCount})` : 'Start Video Compression'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
