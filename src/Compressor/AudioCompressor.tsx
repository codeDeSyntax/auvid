// ─── Audio Compressor Workspace ───────────────────────────────────────────────
// Full-featured audio compression studio matching the Video Compressor layout.
// Left: Header + file queue + drop zone + A/B Audio Comparison Player
// Right: Settings panel (hidden when queue is empty)

import React, { useCallback, useRef, useState } from 'react';
import {
  Upload, FolderOpen, Play, CheckCircle2,
  Trash2, Loader2, Zap, Save
} from 'lucide-react';
import { useTheme } from '@/Provider/Theme';
import { useMediaContext } from '@/Provider/MediaContext';
import { useAudioCompressor } from './useAudioCompressor';
import { AudioFileRow } from './AudioFileRow';
import { AudioSettingsPanel } from './AudioSettingsPanel';
import { AudioComparisonPlayer } from '@/components/Player/AudioComparisonPlayer';
import { CompressConfirmModal } from './CompressConfirmModal';
import { AudioFileEntry } from '@/types/audioCompressor';
import { getAssetPath } from '@/utils/assets';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const AudioCompressor: React.FC = () => {
  const { accentColor } = useTheme();
  const { addMediaItem } = useMediaContext();

  const {
    files,
    globalSettings,
    outputDir,
    useHWAccel,
    isCompressingAll,
    addFiles,
    removeFile,
    clearAll,
    updateGlobalSettings,
    updateFileSettings,
    toggleCustomSettings,
    applyGlobalToAll,
    compressFile,
    compressAll,
    cancelFile,
    pickOutputDir,
    revealFile,
    saveFile,
    saveAll,
  } = useAudioCompressor();

  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [previewingFileId, setPreviewingFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Confirmation Modal State ───────────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'batch';
    targetFile?: AudioFileEntry | null;
  }>({
    isOpen: false,
    type: 'single',
    targetFile: null,
  });

  const selectedFile = files.find(f => f.id === selectedFileId) ?? null;
  const previewingFile = files.find(f => f.id === previewingFileId) ?? selectedFile ?? (files.length > 0 ? files[0] : null);

  // Native file browsing dialog
  const handleBrowseFiles = useCallback(async () => {
    try {
      const selected = (await window.ipcRenderer?.invoke('dialog:open-audio-compress')) as string[] | null;
      if (selected && selected.length > 0) {
        for (const filePath of selected) {
          const name = filePath.split(/[/\\]/).pop() || 'Audio File';
          addMediaItem({
            id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
            name,
            path: filePath,
            size: 0,
            format: (name.split('.').pop() || 'MP3').toUpperCase(),
            type: 'audio',
            duration: 0,
            addedAt: Date.now(),
          });
        }
      }
    } catch (_) {
      fileInputRef.current?.click();
    }
  }, [addMediaItem]);

  const handleRequestCompressSingle = useCallback((file: AudioFileEntry) => {
    setSelectedFileId(file.id);
    setConfirmModal({
      isOpen: true,
      type: 'single',
      targetFile: file,
    });
  }, []);

  const handleRequestCompressAll = useCallback(() => {
    const queued = files.filter(f => f.status === 'queued' || f.status === 'error');
    if (queued.length === 0) return;
    setConfirmModal({
      isOpen: true,
      type: 'batch',
      targetFile: null,
    });
  }, [files]);

  const handleConfirmCompress = useCallback(() => {
    if (confirmModal.type === 'single' && confirmModal.targetFile) {
      compressFile(confirmModal.targetFile.id);
    } else if (confirmModal.type === 'batch') {
      compressAll();
    }
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  }, [confirmModal, compressFile, compressAll]);

  // Select first file if current selection is removed
  if (selectedFile === null && files.length > 0 && selectedFileId !== null) {
    setSelectedFileId(files[0].id);
  }

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = '';
      }
    },
    [addFiles],
  );

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const doneFiles = files.filter(f => f.status === 'done');
  const unsavedDoneFiles = doneFiles.filter(f => !f.isSaved);
  const pendingCount = files.filter(f => f.status === 'queued' || f.status === 'error').length;
  const totalOriginalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);

  // ── Settings for selected file or global ────────────────────────────────────
  const panelSettings = selectedFile?.customSettings
    ? selectedFile.settings
    : globalSettings;

  const panelOnChange = selectedFile?.customSettings
    ? (patch: Partial<typeof globalSettings>) => updateFileSettings(selectedFile.id, patch)
    : updateGlobalSettings;

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden bg-transparent text-zinc-900 dark:text-zinc-100 transition-colors duration-200"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* ── Header ── */}
      <div className="px-8 pt-6 pb-4 shrink-0 flex items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2 border border-zinc-200/80 dark:border-zinc-800/80 bg-transparent backdrop-blur-md shadow-xs">
            <span style={{ color: accentColor }}>Audio Engine</span>
            <span className="text-[10px] text-zinc-400 font-mono">· VBR / CBR</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 leading-tight tracking-tight">
            Audio Compressor
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Reduce file size while preserving high acoustic fidelity — MP3, WAV, FLAC, AAC, OGG, OPUS
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleBrowseFiles}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-200 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Browse Audio</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Add Audio</span>
          </button>
        </div>
      </div>

      {/* ── Main Body ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {files.length === 0 ? (
          /* ── Empty State (100% Full Width — Sidebar Hidden) ── */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
            <div className="relative mb-3 group">
              <div
                className="absolute inset-0 rounded-full blur-2xl opacity-25 dark:opacity-30 transition-all group-hover:opacity-40"
                style={{ backgroundColor: accentColor }}
              />
              <img
                src={getAssetPath("empty-trimmer.png")}
                alt="Audio Compressor"
                className="relative w-44 h-44 object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-xl"
              />
            </div>

            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              No Audio Files Added
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md leading-relaxed">
              Drag &amp; drop audio files anywhere on this window or click below to compress MP3, WAV, FLAC, AAC, and more.
            </p>

            <div className="mt-6 flex items-center space-x-3">
              <button
                type="button"
                onClick={handleBrowseFiles}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Select Audio to Compress</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── Loaded Queue Studio Layout (Queue on Left + AudioSettingsPanel on Right) ── */
          <>
            {/* Left Main Queue Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-6 space-y-4">
              {/* Queue Header Bar */}
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Queue ({files.length} {files.length === 1 ? 'track' : 'tracks'})
                  </span>
                  <span className="text-xs font-mono text-zinc-400">
                    Total: {formatBytes(totalOriginalSize)}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {doneFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        files.filter(f => f.status === 'done').forEach(f => removeFile(f.id));
                      }}
                      className="text-xs font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      Clear Completed
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={isCompressingAll}
                    className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Scrollable Audio File Rows + A/B Audio Comparison Player */}
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-1">
                {previewingFile && (
                  <AudioComparisonPlayer
                    file={previewingFile}
                    onClose={() => setPreviewingFileId(null)}
                    onReveal={revealFile}
                  />
                )}

                <div className="bg-white/80 dark:bg-zinc-900/60 backdrop-blur-sm border border-zinc-200/80 dark:border-zinc-800/60 rounded-2xl overflow-hidden shadow-xs divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {files.map(file => (
                    <AudioFileRow
                      key={file.id}
                      file={file}
                      isSelected={selectedFileId === file.id}
                      isPreviewing={previewingFileId === file.id}
                      onSelect={() => {
                        setSelectedFileId(file.id);
                        setPreviewingFileId(file.id);
                      }}
                      onPlayPreview={(f) => {
                        setPreviewingFileId(prev => (prev === f.id ? null : f.id));
                        setSelectedFileId(f.id);
                      }}
                      onRemove={() => {
                        removeFile(file.id);
                        if (selectedFileId === file.id) setSelectedFileId(null);
                        if (previewingFileId === file.id) setPreviewingFileId(null);
                      }}
                      onCompress={() => handleRequestCompressSingle(file)}
                      onCancel={() => cancelFile(file.id)}
                      onReveal={revealFile}
                      onSave={saveFile}
                    />
                  ))}
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {pendingCount > 0 ? `${pendingCount} audio tracks pending compression` : 'All tracks completed!'}
                </div>

                <div className="flex items-center gap-2">
                  {unsavedDoneFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={saveAll}
                      className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-xs hover:shadow-sm transition-all cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save All ({unsavedDoneFiles.length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleRequestCompressAll}
                    disabled={isCompressingAll || pendingCount === 0}
                    style={{ backgroundColor: accentColor }}
                    className="px-6 py-3 rounded-xl text-xs font-black text-black shadow-md hover:brightness-105 active:scale-95 transition-all flex items-center space-x-2 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isCompressingAll ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin fill-black" />
                        <span>Compressing Queue…</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-black" />
                        <span>Compress All ({pendingCount})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Settings Panel */}
            <AudioSettingsPanel
              selectedFile={selectedFile}
              settings={panelSettings}
              onChange={panelOnChange}
              isCustom={selectedFile?.customSettings ?? false}
              onToggleCustom={selectedFile ? () => toggleCustomSettings(selectedFile.id) : undefined}
              onApplyToAll={applyGlobalToAll}
              onCompress={selectedFile && selectedFile.status !== 'done' && selectedFile.status !== 'processing' ? () => handleRequestCompressSingle(selectedFile) : undefined}
              isCompressing={selectedFile?.status === 'processing' || isCompressingAll}
            />
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.flac,.aac,.m4a,.ogg,.opus,.wma,.ac3,.aiff,.alac,.amr"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* ── Compression Review / Confirmation Modal ── */}
      <CompressConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmCompress}
        type={confirmModal.type}
        targetFile={confirmModal.type === 'single' ? confirmModal.targetFile : null}
        batchCount={confirmModal.type === 'batch' ? files.filter(f => f.status === 'queued' || f.status === 'error').length : undefined}
        settings={confirmModal.type === 'single' && confirmModal.targetFile?.customSettings ? confirmModal.targetFile.settings : panelSettings}
        outputDir={outputDir}
        useHWAccel={useHWAccel}
      />
    </div>
  );
};

export default AudioCompressor;
