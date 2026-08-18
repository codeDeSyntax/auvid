// ─── Audio Compressor Workspace ───────────────────────────────────────────────
// Full-featured audio compression tool matching the XConvert-inspired UI.
// Left: file queue + drop zone + A/B Audio Comparison Player
// Right: settings panel (global or per-file)

import React, { useCallback, useRef, useState } from 'react';
import { Save, Zap, Loader2 } from 'lucide-react';
import { useAudioCompressor } from './useAudioCompressor';
import { AudioFileRow } from './AudioFileRow';
import { AudioSettingsPanel } from './AudioSettingsPanel';
import { AudioComparisonPlayer } from '@/components/Player/AudioComparisonPlayer';
import { CompressConfirmModal } from './CompressConfirmModal';
import { AudioFileEntry } from '@/types/audioCompressor';
import { getAssetPath } from '@/utils/assets';

// ─── Supported format chips ────────────────────────────────────────────────────
const FORMAT_CHIPS = ['MP3', 'WAV', 'FLAC', 'AAC', 'M4A', 'OGG', 'OPUS', 'WMA', 'AC3', 'AIFF', 'ALAC'];

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export const AudioCompressor: React.FC = () => {
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
    setOutputDir,
    pickOutputDir,
    setUseHWAccel,
    openOutputFolder,
    revealFile,
    saveFile,
    saveFileAs,
    saveAll,
  } = useAudioCompressor();

  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [previewingFileId, setPreviewingFileId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
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
  const totalSaved = doneFiles.reduce((acc, f) => acc + (f.size - (f.result?.compressedSize ?? f.size)), 0);

  // ── Settings for selected file or global ────────────────────────────────────
  const panelSettings = selectedFile?.customSettings
    ? selectedFile.settings
    : globalSettings;

  const panelOnChange = selectedFile?.customSettings
    ? (patch: Partial<typeof globalSettings>) => updateFileSettings(selectedFile.id, patch)
    : updateGlobalSettings;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.flac,.aac,.m4a,.ogg,.opus,.wma,.ac3,.aiff,.alac,.amr"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3.5  shrink-0 bg-transparent  gap-2">
        <div className="flex items-center gap-2">
          <button
            id="audio-compressor-add-btn"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-black bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <span className="text-base leading-none font-black">+</span>
            <span className="hidden sm:inline">Add Audio Files</span>
            <span className="sm:hidden">Add</span>
          </button>

          {files.length > 0 && (
            <button
              onClick={clearAll}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-600 dark:text-zinc-400 hover:text-red-500 border border-zinc-200 dark:border-zinc-700/60 transition-all cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>


        {/* Queue summary count */}
        {files.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
            <span>
              {files.length} {files.length === 1 ? 'file' : 'files'}
            </span>
            {doneFiles.length > 0 && (
              <span>
                Saved{' '}
                <span className="font-bold" style={{ color: 'var(--accent)' }}>{formatBytes(totalSaved)}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Main split layout ────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: File queue + Audio Comparison Player */}
        <div className="flex-1 flex flex-col overflow-hidden bg-zinc50">
          {files.length === 0 ? (
            /* ── Empty / Drop zone ── */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 flex flex-col items-center justify-center cursor-pointer m-6 rounded-3xl border-2 border-dashed transition-all duration-200 ${
                isDragging
                  ? 'scale-[1.005]'
                  : 'border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-white/60 dark:bg-zinc-900/30 hover:bg-white dark:hover:bg-zinc-900/50 shadow-sm'
              }`}
              style={
                isDragging
                  ? {
                      borderColor: 'var(--accent)',
                      backgroundColor: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                    }
                  : undefined
              }
            >
              <div className="flex flex-col items-center space-y-3 text-center px-8 max-w-md select-none">
                <div className="relative mb-1 group">
                  <div
                    className="absolute inset-0 rounded-full blur-2xl opacity-25 dark:opacity-30 transition-all group-hover:opacity-40"
                    style={{ backgroundColor: 'var(--accent)' }}
                  />
                  <img
                    src={getAssetPath("empty-trimmer.png")}
                    alt="Audio Compressor"
                    className="relative w-40 h-40 object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-xl"
                  />
                </div>
                <div>
                  <p className="text-lg font-black text-zinc-900 dark:text-zinc-100 mb-1 tracking-tight">
                    {isDragging ? 'Drop Audio Files Here' : 'Drag & Drop Audio Files to Compress'}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    or click to browse from your computer · MP3, WAV, FLAC, AAC, OGG, OPUS, M4A
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* ── File list with A/B Player at Top ── */
            <div
              className="flex-1 overflow-y-auto no-scrollbar"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Max-width content wrapper – prevents stretching on wide windows */}
              <div className="max-w-3xl mx-auto px-4 sm:px-5 py-4 sm:py-5 space-y-4">
                {/* Integrated A/B Audio Comparison Player */}
                {previewingFile && (
                  <AudioComparisonPlayer
                    file={previewingFile}
                    onClose={() => setPreviewingFileId(null)}
                    onReveal={revealFile}
                  />
                )}

                {/* File list container */}
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

                {/* Drop more files zone at bottom */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-2xl border border-dashed transition-all cursor-pointer py-4 text-center ${
                    isDragging
                      ? ''
                      : 'border-zinc-300 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-300 bg-white/40 dark:bg-zinc-900/20'
                  }`}
                  style={
                    isDragging
                      ? {
                          borderColor: 'var(--accent)',
                          backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                          color: 'var(--accent)',
                        }
                      : undefined
                  }
                >
                  <span className="text-xs font-bold">+ Drop or click to add more audio files</span>
                </div>
              </div>
            </div>
          )}


          {/* ── Bottom Bar ─────────────────────────────────────────────────── */}
          {files.length > 0 && (
            <div className="shrink-0 border-t border-zinc-200/80 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-900/70 backdrop-blur-md px-6 py-3.5 space-y-3 shadow-sm">
              {/* Output directory row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider shrink-0">
                  Output:
                </span>
                {outputDir ? (
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span
                      className="flex-1 text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl px-3 py-1.5 truncate border border-zinc-200 dark:border-zinc-700/60 font-mono min-w-0"
                      title={outputDir}
                    >
                      {outputDir}
                    </span>
                    <button
                      onClick={() => openOutputFolder(outputDir)}
                      className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                    >
                      Open
                    </button>
                    <button
                      onClick={pickOutputDir}
                      className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                      Default: Music/AUVID
                    </span>
                    <button
                      onClick={pickOutputDir}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors border border-zinc-200 dark:border-zinc-700/60 cursor-pointer"
                    >
                      Choose Folder
                    </button>
                  </div>
                )}
              </div>

              {/* Action row */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {doneFiles.length > 0 && (
                    <span>
                      <strong className="text-zinc-900 dark:text-zinc-100">{doneFiles.length}</strong> of{' '}
                      <strong>{files.length}</strong> compressed
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Save All button – only appears when there are unsaved compressed files */}
                  {unsavedDoneFiles.length > 0 && (
                    <button
                      onClick={saveAll}
                      className="flex items-center space-x-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-xs hover:shadow-sm transition-all cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save All ({unsavedDoneFiles.length})</span>
                    </button>
                  )}

                  <button
                    id="audio-compressor-compress-all-btn"
                    onClick={handleRequestCompressAll}
                    disabled={isCompressingAll || files.every(f => f.status === 'done')}
                    className="flex items-center space-x-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-lg active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isCompressingAll ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="hidden sm:inline">Compressing…</span>
                        <span className="sm:hidden">Working…</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span className="hidden sm:inline">Compress All ({files.length})</span>
                        <span className="sm:hidden">Compress ({files.length})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Settings Panel */}
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
      </div>

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
