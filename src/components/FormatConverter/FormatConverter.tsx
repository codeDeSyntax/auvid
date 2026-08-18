// ─── FormatConverter.tsx ──────────────────────────────────────────────────
// High-performance Universal Format Converter studio for audio, video, soundtrack extraction, and GIFs.

import React, { useRef, useState, useCallback } from 'react';
import {
  Upload, FolderOpen, Play, CheckCircle2,
  Trash2, Sparkles, Loader2, RefreshCw, Layers,
  HardDrive, Zap, Info, ArrowRightLeft, ArrowRight
} from 'lucide-react';
import { useTheme } from '@/Provider/Theme';
import { useFormatConverter } from './useFormatConverter';
import { ConverterFileRow } from './ConverterFileRow';
import { ConverterSettingsPanel } from './ConverterSettingsPanel';
import { ConverterConfirmModal } from './ConverterConfirmModal';
import {
  ConverterFileEntry,
  TargetFormat,
  AUDIO_FORMATS,
  VIDEO_FORMATS,
} from '@/types/formatConverter';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const FormatConverter: React.FC = () => {
  const { accentColor } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    files,
    settings,
    setSettings,
    globalTargetFormat,
    setAllTargetFormats,
    updateFileFormat,
    isProcessing,
    addFiles,
    removeFile,
    clearCompleted,
    clearAll,
    processSingle,
    processBatch,
  } = useFormatConverter();

  // Confirmation Modal State
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState<'batch' | ConverterFileEntry>('batch');

  // Handle native file picking
  const handleBrowseFiles = useCallback(async () => {
    try {
      const selected = (await window.ipcRenderer?.invoke('dialog:open-converter-files')) as string[] | null;
      if (selected && selected.length > 0) {
        addFiles(selected);
      }
    } catch (_) {}
  }, [addFiles]);

  // Handle HTML5 file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files;
    if (!picked || picked.length === 0) return;

    const paths: string[] = [];
    for (let i = 0; i < picked.length; i++) {
      const f = picked[i];
      const p =
        (window as unknown as { api?: { getPathForFile: (file: File) => string } }).api?.getPathForFile(f) ||
        (f as unknown as { path?: string }).path ||
        f.name;
      if (p) paths.push(p);
    }

    if (paths.length > 0) {
      addFiles(paths);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag and Drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files;
    if (!dropped || dropped.length === 0) return;

    const paths: string[] = [];
    for (let i = 0; i < dropped.length; i++) {
      const f = dropped[i];
      const p =
        (window as unknown as { api?: { getPathForFile: (file: File) => string } }).api?.getPathForFile(f) ||
        (f as unknown as { path?: string }).path;
      if (p) paths.push(p);
    }

    if (paths.length > 0) {
      addFiles(paths);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleOpenSingleConfirm = (entry: ConverterFileEntry) => {
    setModalTarget(entry);
    setConfirmModalOpen(true);
  };

  const handleOpenBatchConfirm = () => {
    setModalTarget('batch');
    setConfirmModalOpen(true);
  };

  const handleConfirmStart = () => {
    setConfirmModalOpen(false);
    if (modalTarget === 'batch') {
      processBatch();
    } else {
      processSingle(modalTarget);
    }
  };

  const totalOriginalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
  const completedCount = files.filter(f => f.status === 'completed').length;
  const pendingCount = files.filter(f => f.status === 'idle' || f.status === 'failed').length;

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden bg-transparent"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Header */}
      <div className="px-8 pt-6 pb-4 shrink-0 flex items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2 border border-zinc-200/80 dark:border-zinc-800/80 bg-transparent backdrop-blur-md shadow-xs">
            <span style={{ color: accentColor }}>Universal Converter</span>
            <span className="text-[10px] text-zinc-400 font-mono">· Audio ↔ Video ↔ GIF</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 leading-tight tracking-tight">
            Format Converter
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Convert any audio or video format with high-fidelity transcode pipelines
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleBrowseFiles}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-200 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Browse Media</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Add Files</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {files.length === 0 ? (
          /* ── Empty State (100% Full Width) ── */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
            <div className="relative mb-3 group">
              <div
                className="absolute inset-0 rounded-full blur-2xl opacity-25 dark:opacity-30 transition-all group-hover:opacity-40"
                style={{ backgroundColor: accentColor }}
              />
              <img
                src="/empty-trimmer.png"
                alt="Format Converter"
                className="relative w-44 h-44 object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-xl"
              />
            </div>

            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              No Media Files Added
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md leading-relaxed">
              Drag &amp; drop any audio or video files here. Convert between MP3, WAV, FLAC, AAC, MP4, MKV, MOV, WebM, and animated GIFs.
            </p>

            <div className="mt-6 flex items-center space-x-3">
              <button
                type="button"
                onClick={handleBrowseFiles}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Select Files to Convert</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── Loaded Queue Studio Layout ── */
          <>
            {/* Left Main Queue Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-6 space-y-4">
              {/* Queue Header & Global Format Selector */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/80 gap-3 flex-wrap">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Queue ({files.length} {files.length === 1 ? 'file' : 'files'})
                  </span>
                  <span className="text-xs font-mono text-zinc-400">
                    Total: {formatBytes(totalOriginalSize)}
                  </span>
                </div>

                {/* Convert All To Pill */}
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                    Convert all to:
                  </span>
                  <select
                    value={globalTargetFormat}
                    onChange={e => setAllTargetFormats(e.target.value as TargetFormat)}
                    className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xs cursor-pointer"
                  >
                    <optgroup label="Popular Audio">
                      <option value="mp3">MP3</option>
                      <option value="wav">WAV</option>
                      <option value="flac">FLAC</option>
                      <option value="aac">AAC</option>
                      <option value="m4a">M4A</option>
                      <option value="opus">OPUS</option>
                    </optgroup>
                    <optgroup label="Popular Video">
                      <option value="mp4">MP4</option>
                      <option value="mkv">MKV</option>
                      <option value="mov">MOV</option>
                      <option value="webm">WEBM</option>
                      <option value="gif">GIF (Animated)</option>
                    </optgroup>
                  </select>

                  {completedCount > 0 && (
                    <button
                      type="button"
                      onClick={clearCompleted}
                      className="text-xs font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer ml-2"
                    >
                      Clear Completed
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={isProcessing}
                    className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Scrollable Converter File Rows */}
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-2.5 pr-1">
                {files.map((file) => (
                  <ConverterFileRow
                    key={file.id}
                    entry={file}
                    onRemove={removeFile}
                    onFormatChange={updateFileFormat}
                    onConvertSingle={handleOpenSingleConfirm}
                    accentColor={accentColor}
                  />
                ))}
              </div>

              {/* Bottom Action Bar */}
              <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {pendingCount > 0 ? `${pendingCount} files ready for conversion` : 'All conversions finished!'}
                </div>

                <button
                  type="button"
                  onClick={handleOpenBatchConfirm}
                  disabled={isProcessing || pendingCount === 0}
                  style={{ backgroundColor: accentColor }}
                  className="px-6 py-3 rounded-xl text-xs font-black text-black shadow-md hover:brightness-105 active:scale-95 transition-all flex items-center space-x-2 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin fill-black" />
                      <span>Converting Queue…</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-black" />
                      <span>Convert All ({pendingCount})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Settings Panel */}
            <ConverterSettingsPanel
              settings={settings}
              onChange={setSettings}
              selectedFormat={globalTargetFormat}
              accentColor={accentColor}
            />
          </>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Summary Confirmation Receipt Dialog */}
      <ConverterConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirmStart}
        type={modalTarget === 'batch' ? 'batch' : 'single'}
        targetFile={modalTarget === 'batch' ? null : modalTarget}
        batchCount={pendingCount}
        globalTargetFormat={globalTargetFormat}
        settings={settings}
        accentColor={accentColor}
      />
    </div>
  );
};
