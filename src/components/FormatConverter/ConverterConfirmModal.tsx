// ─── ConverterConfirmModal.tsx ───────────────────────────────────────────────
// Clean receipt-style summary confirmation modal before executing format conversion.

import React, { useEffect } from 'react';
import { X, Play, Receipt, ArrowRight, ArrowRightLeft, Layers, Music, Video } from 'lucide-react';
import { ConverterFileEntry, ConverterSettings, TargetFormat } from '@/types/formatConverter';

export interface ConverterConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type: 'single' | 'batch';
  targetFile?: ConverterFileEntry | null;
  batchCount?: number;
  globalTargetFormat: TargetFormat;
  settings: ConverterSettings;
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

export const ConverterConfirmModal: React.FC<ConverterConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  type,
  targetFile,
  batchCount = 0,
  globalTargetFormat,
  settings,
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
  const targetFmt = (targetFile?.targetFormat || globalTargetFormat).toUpperCase();

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
                {isBatch ? `Batch Conversion Receipt (${batchCount} Files)` : 'Format Conversion Receipt'}
              </h3>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                TARGET_CONTAINER: {targetFmt}
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
                    .{targetFile.targetFormat}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5 font-sans">
                  {targetFile.probe ? `${targetFile.probe.format.toUpperCase()} · ${formatBytes(targetFile.size)} · ${formatTime(targetFile.probe.duration)}` : formatBytes(targetFile.size)}
                </p>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                  Batch Job: {batchCount} Media Files
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  .{globalTargetFormat}
                </span>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="space-y-2 text-[11px]">
            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Target Format</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100" style={{ color: accentColor }}>
                .{targetFmt.toLowerCase()}
              </span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Audio Bitrate</span>
              <span className="text-zinc-900 dark:text-zinc-100">{settings.audioBitrate} kbps</span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Audio Sample Rate</span>
              <span className="text-zinc-900 dark:text-zinc-100">{settings.audioSampleRate / 1000} kHz ({settings.audioChannels})</span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Video Resolution</span>
              <span className="text-zinc-900 dark:text-zinc-100">
                {settings.videoResolution === 'original' ? 'Keep Source Res' : settings.videoResolution.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Video Codec</span>
              <span className="text-zinc-900 dark:text-zinc-100 uppercase">{settings.videoCodec}</span>
            </div>

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Output Destination</span>
              <span className="text-zinc-900 dark:text-zinc-100">AUVID Library Folder</span>
            </div>
          </div>

          {/* Dashed Total Divider */}
          <div className="pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-zinc-700 dark:text-zinc-300">Conversion Pipeline</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                High-Fidelity FFmpeg Stream
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
            <span>{isBatch ? `Convert All (${batchCount})` : 'Start Format Conversion'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
