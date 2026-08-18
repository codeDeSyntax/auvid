import React, { useEffect } from 'react';
import {
  X,
  Zap,
  Sliders,
  FileAudio,
  HardDrive,
  Cpu,
  Layers,
  FolderOpen,
  CheckCircle2,
} from 'lucide-react';
import { AudioFileEntry, AudioCompressSettings } from '@/types/audioCompressor';

interface CompressConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type: 'single' | 'batch';
  targetFile?: AudioFileEntry | null;
  batchCount?: number;
  settings: AudioCompressSettings;
  outputDir: string;
  useHWAccel: boolean;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const CompressConfirmModal: React.FC<CompressConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  type,
  targetFile,
  batchCount = 0,
  settings,
  outputDir,
  useHWAccel,
}) => {
  // Handle ESC and ENTER keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
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
        return `Target: ${settings.percentageReduction}% of original size`;
      case 'targetSize':
        return `Target exact size: ${settings.targetSizeMB} MB`;
      case 'bitrate':
        return `Custom bitrate: ${settings.bitrate} kbps (${settings.bitrateMode.toUpperCase()})`;
      case 'quality':
        return `Perceptual Quality: Level ${settings.qualityLevel}/10`;
      default:
        return 'Standard Compression';
    }
  };

  // Estimated single file output calculation
  let estimatedSizeStr = '';
  if (targetFile) {
    if (settings.mode === 'percentage') {
      const est = Math.round(targetFile.size * (settings.percentageReduction / 100));
      estimatedSizeStr = `${formatBytes(est)} (~${settings.percentageReduction}% of original)`;
    } else if (settings.mode === 'targetSize') {
      estimatedSizeStr = `~${settings.targetSizeMB} MB`;
    } else if (settings.mode === 'bitrate' && targetFile.probe?.duration) {
      const est = Math.round((settings.bitrate * 1000 * targetFile.probe.duration) / 8);
      estimatedSizeStr = `~${formatBytes(est)}`;
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 leading-snug">
                {isBatch ? `Compress All (${batchCount} Files)` : 'Confirm Compression Settings'}
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Review your parameters before processing begins
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar">
          {/* Target File summary card (if single file) */}
          {targetFile && (
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-zinc-200/80 dark:bg-zinc-700/80 flex items-center justify-center text-zinc-700 dark:text-zinc-200 shrink-0">
                  <FileAudio className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {targetFile.name}
                  </p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    Original size: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{formatBytes(targetFile.size)}</span>
                  </p>
                </div>
              </div>

              {estimatedSizeStr && (
                <div className="shrink-0 text-right">
                  <span className="text-[10px] text-zinc-400 block uppercase font-bold tracking-wider">Est. Output</span>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{estimatedSizeStr}</span>
                </div>
              )}
            </div>
          )}

          {/* Batch count badge (if batch) */}
          {isBatch && (
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 flex items-center space-x-2 text-xs text-zinc-700 dark:text-zinc-300">
              <Layers className="w-4 h-4 text-cyan-500 shrink-0" />
              <span>
                All <strong>{batchCount}</strong> queued audio files will begin compressing concurrently in parallel.
              </span>
            </div>
          )}

          {/* Settings Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Mode & Target */}
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/70 dark:border-zinc-800/80 space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                Compression Mode
              </span>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                {getModeLabel()}
              </span>
            </div>

            {/* Output Format */}
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/70 dark:border-zinc-800/80 space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                Output Format
              </span>
              <div className="flex items-center space-x-1.5">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 uppercase">
                  {settings.outputFormat}
                </span>
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {settings.outputFormat.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Channels & Sample Rate */}
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/70 dark:border-zinc-800/80 space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                Audio Channels & Rate
              </span>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                {settings.channels === 'mono' ? 'Mono (1 channel)' : 'Stereo (2 channels)'}
                {settings.sampleRate ? ` · ${settings.sampleRate / 1000} kHz` : ' · Auto rate'}
              </span>
            </div>

            {/* Hardware Acceleration */}
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/70 dark:border-zinc-800/80 space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                Acceleration
              </span>
              <div className="flex items-center space-x-1.5">
                <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {useHWAccel ? 'Hardware (GPU)' : 'Standard (CPU)'}
                </span>
              </div>
            </div>
          </div>

          {/* Staging / Destination Note */}
          <div className="p-3 rounded-2xl bg-zinc-100/70 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 flex items-start space-x-2.5 text-xs text-zinc-600 dark:text-zinc-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                Non-destructive staging workflow:
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Outputs are safely created in temporary staging so you can preview original vs compressed before choosing to Save.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end space-x-2.5 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            className="flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-black bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isBatch ? 'Start All Compressions' : 'Start Compression'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
