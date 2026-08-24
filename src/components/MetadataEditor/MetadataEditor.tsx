// ─── Metadata Editor ──────────────────────────────────────────────────────────
// Scans output directory (or user-set path) for media files and allows
// editing ID3 tags, cover art, title, artist, album, year, genre, track, comment
// directly in-place on existing files (no duplicate or new files generated).

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Music,
  Film,
  Tag,
  FolderOpen,
  RefreshCw,
  Save,
  Upload,
  X,
  Image as ImageIcon,
  ChevronRight,
  Loader2,
  Check,
  AlertCircle,
  FileAudio2,
  ExternalLink,
} from 'lucide-react';
import { getAssetPath } from '@/utils/assets';
import { useTheme } from '@/Provider/Theme';
import { CustomDropdown, DropdownOption } from '@/components/common/CustomDropdown';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MediaMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  track?: string;
  comment?: string;
  albumArtist?: string;
  composer?: string;
  diskNumber?: string;
  coverArt?: string | null;   // base64 data URL
}

interface MetaFile {
  id: string;
  name: string;
  path: string;
  size: number;
  format: string;
  type: 'audio' | 'video';
  metadata?: MediaMetadata;
  status: 'idle' | 'loading' | 'loaded' | 'saving' | 'saved' | 'error';
  errorMsg?: string;
  dirty?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const AUDIO_EXTS = new Set([
  'mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'aiff', 'aif', 'alac',
  'ac3', 'amr', 'ape', 'dts', 'mp2', 'mp1', 'm4b', 'm4p', 'aifc', 'caf', 'pcm',
]);

const VIDEO_EXTS = new Set([
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp', '3g2',
  'mpg', 'mpeg', 'm2ts', 'ts', 'ogv', 'vob', 'asf', 'rm', 'rmvb', 'divx',
]);

const GENRES = [
  'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge',
  'Hip-Hop', 'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B',
  'Rap', 'Reggae', 'Rock', 'Techno', 'Industrial', 'Alternative', 'Ska',
  'Death Metal', 'Soundtrack', 'Ambient', 'Trip-Hop',
  'Vocal', 'Jazz+Funk', 'Fusion', 'Trance', 'Classical', 'Instrumental', 'Acid',
  'House', 'Game', 'Sound Clip', 'Gospel', 'Noise', 'Alternative Rock', 'Bass',
  'Soul', 'Punk', 'Electronic', 'K-Pop', 'Afrobeats', 'Lo-Fi', 'Acoustic',
];

const GENRE_OPTIONS: DropdownOption<string>[] = [
  { value: '', label: '— Select Genre —' },
  ...GENRES.map(g => ({ value: g, label: g })),
];

// ─── Field Component ──────────────────────────────────────────────────────────

const MetaInputField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
}> = ({ label, value, onChange, placeholder, type = 'text' }) => {
  return (
    <div className="flex flex-col space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </label>
      <input
        type={type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className="w-full bg-transparent border-b border-t-0 border-x-0 border-solid border-zinc-300/80 dark:border-zinc-700/90 hover:border-zinc-400 dark:hover:border-zinc-500 focus:border-b-2 focus:border-zinc-900 dark:focus:border-cyan-400 text-zinc-900 dark:text-zinc-100 text-xs py-1.5 px-0.5 focus:outline-none transition-colors font-medium placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
      />
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const MetadataEditor: React.FC = () => {
  const { accentColor, isDarkMode } = useTheme();

  const [scanPath, setScanPath] = useState<string>('');
  const [displayPath, setDisplayPath] = useState<string>('');
  const [files, setFiles] = useState<MetaFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [editFields, setEditFields] = useState<MediaMetadata>({});
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const selectedFile = files.find(f => f.id === selectedId) ?? null;

  // ── Load metadata for a single file ───────────────────────────────────────
  const loadMetadata = useCallback(async (file: MetaFile) => {
    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'loading' } : f));
    try {
      const meta = await window.ipcRenderer?.invoke('metadata:read', file.path) as MediaMetadata | null;
      const loaded = meta ?? {};
      setFiles(prev => prev.map(f =>
        f.id === file.id ? { ...f, status: 'loaded', metadata: loaded, dirty: false } : f
      ));
      setEditFields(loaded);
    } catch (err) {
      setFiles(prev => prev.map(f =>
        f.id === file.id ? { ...f, status: 'error', errorMsg: String(err) } : f
      ));
    }
  }, []);

  // ── Background loader for cover art thumbnails ────────────────────────────
  const loadAllThumbnails = useCallback(async (fileList: MetaFile[]) => {
    for (const f of fileList) {
      try {
        const meta = await window.ipcRenderer?.invoke('metadata:read', f.path) as MediaMetadata | null;
        if (meta) {
          setFiles(prev => prev.map(item =>
            item.id === f.id
              ? {
                  ...item,
                  metadata: meta,
                  status: item.status === 'idle' ? 'loaded' : item.status,
                }
              : item
          ));
        }
      } catch {
        /* ignore thumbnail read error */
      }
    }
  }, []);

  // ── Directory scanning (current folder only) ──────────────────────────────
  const scanDirectory = useCallback(async (dir: string) => {
    if (!dir) return;
    setIsScanning(true);
    setFiles([]);
    setSelectedId(null);

    let foundEntries: Array<{ name: string; path: string; size: number; isFile: boolean }> = [];

    try {
      const entries = await window.ipcRenderer?.invoke('fs:list-directory', dir) as Array<{
        name: string; path: string; size: number; isFile: boolean;
      }> | null;

      if (entries) {
        foundEntries = entries;
      }
    } catch (err) {
      console.error('[MetadataEditor] Scan error:', err);
    }

    const diskFiles: MetaFile[] = foundEntries
      .filter(e => e.isFile)
      .map(e => {
        const ext = e.name.split('.').pop()?.toLowerCase() ?? '';
        const isAudio = AUDIO_EXTS.has(ext);
        const isVideo = VIDEO_EXTS.has(ext);
        if (!isAudio && !isVideo) return null;
        return {
          id: Math.random().toString(36).slice(2),
          name: e.name,
          path: e.path,
          size: e.size,
          format: ext.toUpperCase(),
          type: isAudio ? 'audio' : 'video',
          status: 'idle',
        } as MetaFile;
      })
      .filter(Boolean) as MetaFile[];

    setFiles(diskFiles);
    if (diskFiles.length > 0) {
      setSelectedId(diskFiles[0].id);
      loadMetadata(diskFiles[0]);
      loadAllThumbnails(diskFiles);
    }

    setIsScanning(false);
  }, [loadMetadata, loadAllThumbnails]);

  // ── Resolve & load output dir on mount ────────────────────────────────────
  useEffect(() => {
    const resolveDir = async () => {
      const customAudio = localStorage.getItem('auvid_custom_audio_output_dir');
      const customBase = localStorage.getItem('auvid_custom_base_output_dir');

      if (customAudio) {
        setScanPath(customAudio);
        setDisplayPath(customAudio);
        return;
      }
      if (customBase) {
        setScanPath(customBase);
        setDisplayPath(customBase);
        return;
      }

      // Fall back to app default dirs via IPC
      try {
        const dirs = await window.ipcRenderer?.invoke('app:get-default-output-dirs') as {
          baseDir: string; audioDir: string; videoDir: string;
        } | null;
        if (dirs?.audioDir) {
          setScanPath(dirs.audioDir);
          setDisplayPath(dirs.audioDir);
        }
      } catch { /* ignore */ }
    };

    resolveDir();
  }, []);

  // Auto-scan when path is resolved or when mediaList changes
  useEffect(() => {
    scanDirectory(scanPath);
  }, [scanPath, scanDirectory]);

  // ── Pick a different folder ───────────────────────────────────────────────
  const handlePickFolder = async () => {
    try {
      const result = await window.ipcRenderer?.invoke('dialog:open-folder') as string | null;
      if (result) {
        setScanPath(result);
        setDisplayPath(result);
      }
    } catch { /* ignore */ }
  };

  // ── Select file ───────────────────────────────────────────────────────────
  const handleSelectFile = (file: MetaFile) => {
    setSelectedId(file.id);
    if (file.status === 'idle' || file.status === 'error') {
      loadMetadata(file);
    } else if (file.status === 'loaded' || file.status === 'saved') {
      setEditFields(file.metadata ?? {});
    }
  };

  // ── Field change ──────────────────────────────────────────────────────────
  const handleFieldChange = (key: keyof MediaMetadata, value: string) => {
    setEditFields(prev => ({ ...prev, [key]: value }));
    setFiles(prev => prev.map(f => f.id === selectedId ? { ...f, dirty: true } : f));
  };

  // ── Cover art ─────────────────────────────────────────────────────────────
  const handleCoverFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      setEditFields(prev => ({ ...prev, coverArt: dataUrl }));
      setFiles(prev => prev.map(f =>
        f.id === selectedId
          ? { ...f, dirty: true, metadata: { ...f.metadata, coverArt: dataUrl } }
          : f
      ));
    };
    reader.readAsDataURL(file);
  };

  const handleCoverInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCoverFile(file);
  };

  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCover(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) handleCoverFile(file);
  };

  // ── Add files manually ────────────────────────────────────────────────────
  const handleAddFiles = (rawFiles: FileList | null) => {
    if (!rawFiles) return;
    const newFiles: MetaFile[] = [];
    Array.from(rawFiles).forEach(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      const isAudio = AUDIO_EXTS.has(ext);
      const isVideo = VIDEO_EXTS.has(ext);
      if (!isAudio && !isVideo) return;
      const path = (f as File & { path?: string }).path || f.name;
      newFiles.push({
        id: Math.random().toString(36).slice(2),
        name: f.name,
        path,
        size: f.size,
        format: ext.toUpperCase(),
        type: isAudio ? 'audio' : 'video',
        status: 'idle',
      });
    });
    if (newFiles.length > 0) {
      setFiles(prev => {
        const combined = [...newFiles.filter(n => !prev.some(p => p.path === n.path)), ...prev];
        return combined;
      });
      loadAllThumbnails(newFiles);
    }
  };

  // ── Save metadata directly to existing file in-place ──────────────────────
  const handleSave = async () => {
    if (!selectedFile) return;
    setFiles(prev => prev.map(f => f.id === selectedId ? { ...f, status: 'saving' } : f));
    try {
      await window.ipcRenderer?.invoke('metadata:write', { path: selectedFile.path, metadata: editFields });
      setFiles(prev => prev.map(f =>
        f.id === selectedId ? { ...f, status: 'saved', metadata: editFields, dirty: false } : f
      ));
    } catch (err) {
      setFiles(prev => prev.map(f =>
        f.id === selectedId ? { ...f, status: 'error', errorMsg: String(err) } : f
      ));
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
      {/* ── Header ── */}
      <div className="px-8 pt-6 pb-4 shrink-0 flex items-center justify-between gap-4 border-b border-solid border-x-0 border-t-0 border-zinc-200/80 dark:border-zinc-800/70">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2 border border-zinc-200/80 dark:border-zinc-800/80 bg-transparent backdrop-blur-md shadow-xs">
            {/* <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} /> */}
            <span style={{ color: accentColor }}>Metadata Editor</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 leading-tight tracking-tight">
            Edit Media Tags & Artwork
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Edits ID3 tags and properties directly in your existing files — without creating duplicate outputs.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/60 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Add Files</span>
          </button>

          <button
            onClick={handlePickFolder}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/60 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Change Folder</span>
          </button>

          <button
            onClick={() => scanDirectory(scanPath)}
            disabled={isScanning || !scanPath}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-xs transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning…' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ── Path indicator ── */}
      {displayPath && (
        <div className="px-8 py-2 shrink-0 flex items-center space-x-2  border-b border-zinc-200/60 dark:border-zinc-800/60">
          <FolderOpen className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">{displayPath}</span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-600 shrink-0 ml-auto">
            {files.length} media file{files.length !== 1 ? 's' : ''} · In-place editing
          </span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,video/*,.flac,.aiff,.alac,.opus,.wma"
        className="hidden"
        onChange={e => handleAddFiles(e.target.files)}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverInputChange}
      />

      {/* ── Body: Left file list + Right editor ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ── LEFT: File List ── */}
        <div className="w-80 min-w-[240px] shrink-0 flex flex-col border-r border-zinc-200/80 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800/60 shrink-0 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Files</span>
            {files.length > 0 && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{files.length}</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {isScanning ? (
              <div className="flex flex-col items-center justify-center h-full py-10 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: accentColor }} />
                <p className="text-xs text-zinc-400">Scanning folder…</p>
              </div>
            ) : files.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 px-4 text-center space-y-2 select-none">
                <div className="relative mb-1 group">
                  <div
                    className="absolute inset-0 rounded-full blur-xl opacity-20"
                    style={{ backgroundColor: accentColor }}
                  />
                  <img
                    src={getAssetPath("empty-trimmer.png")}
                    alt="No files"
                    className="relative w-24 h-24 object-contain transition-transform group-hover:scale-105"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">No media files found</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 leading-relaxed">
                    Change folder or add files manually using the buttons above.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
                {files.map(file => {
                  const isSelected = file.id === selectedId;
                  const coverImage = file.metadata?.coverArt;

                  return (
                    <button
                      key={file.id}
                      onClick={() => handleSelectFile(file)}
                      style={isSelected ? {
                        borderLeftColor: accentColor,
                        backgroundColor: `${accentColor}12`,
                      } : {}}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center space-x-3 transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-l-2'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30 border-l-2 border-transparent'
                      }`}
                    >
                      {/* Cover image or media type icon */}
                      <div
                        style={isSelected && !coverImage ? {
                          backgroundColor: `${accentColor}25`,
                          color: accentColor,
                        } : {}}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs shrink-0 overflow-hidden relative border border-zinc-200/70 dark:border-zinc-700/60 shadow-2xs ${
                          isSelected && !coverImage ? '' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {coverImage ? (
                          <img
                            src={coverImage}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : file.type === 'video' ? (
                          <Film className="w-4 h-4" />
                        ) : (
                          <Music className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            style={isSelected ? { color: isDarkMode ? accentColor : undefined } : {}}
                            className={`text-[11px] font-semibold truncate ${
                              isSelected ? 'text-zinc-900 font-bold' : 'text-zinc-800 dark:text-zinc-200'
                            }`}
                          >
                            {file.name}
                          </span>
                          {file.status === 'loading' && (
                            <Loader2 className="w-3 h-3 animate-spin shrink-0" style={{ color: accentColor }} />
                          )}
                          {file.status === 'saved' && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
                          {file.status === 'error' && <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />}
                          {file.dirty && (
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                              style={{ backgroundColor: accentColor }}
                            />
                          )}
                        </div>
                        <div className="flex items-center space-x-1.5 mt-0.5">
                          <span className="text-[9px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1 rounded uppercase">
                            {file.format}
                          </span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-600">{formatBytes(file.size)}</span>
                        </div>
                      </div>

                      {isSelected && (
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Editor (Constrained with max width, unsqueezed image) ── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {!selectedFile ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center select-none">
              <div className="relative mb-3 group">
                <div
                  className="absolute inset-0 rounded-full blur-2xl opacity-25 dark:opacity-30 transition-all group-hover:opacity-40"
                  style={{ backgroundColor: accentColor }}
                />
                <img
                  src={getAssetPath("empty-trimmer.png")}
                  alt="Metadata Editor"
                  className="relative w-44 h-44 object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-xl"
                />
              </div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 mb-1.5 tracking-tight">No File Selected</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed">
                Select a media file from the list on the left to inspect and edit its ID3 metadata tags, cover artwork, and properties directly.
              </p>
            </div>
          ) : selectedFile.status === 'loading' ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Reading metadata directly from file…</p>
            </div>
          ) : selectedFile.status === 'error' ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-red-500" />
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Failed to read metadata</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-500 max-w-xs leading-relaxed">{selectedFile.errorMsg}</p>
              <button
                onClick={() => loadMetadata(selectedFile)}
                className="mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black transition-all active:scale-95 cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Editor header with file info + Save Changes button */}
              <div className="flex items-center justify-between px-8 py-3 border-b border-zinc-200/80 dark:border-zinc-800/70 shrink-0 bg-white/60 dark:bg-zinc-900/40">
                <div className="flex items-center space-x-3 min-w-0">
                  <div
                    style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  >
                    {selectedFile.type === 'video' ? <Film className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                      {formatBytes(selectedFile.size)} · {selectedFile.format} · In-place edit
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {selectedFile.status === 'saved' && (
                    <span className="flex items-center space-x-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="w-3 h-3" />
                      <span>Updated In-Place</span>
                    </span>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={selectedFile.status === 'saving' || !selectedFile.dirty}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {selectedFile.status === 'saving' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{selectedFile.status === 'saving' ? 'Saving…' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>

              {/* Editor form with image on the left and all inputs on the right */}
              <div className="flex-1 overflow-y-auto no-scrollbar px-8 py-6">
                <div className="max-w-3xl mx-auto w-full flex flex-col md:flex-row gap-6 items-start">

                  {/* ── LEFT: Small Cover Art Box ── */}
                  <div className="w-full md:w-48 shrink-0 flex flex-col space-y-3">
                    <div className="bg-white/80 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-3.5 shadow-xs flex flex-col items-center">
                      <div className="w-full flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Cover Artwork
                        </span>
                        {editFields.coverArt && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditFields(p => ({ ...p, coverArt: null }));
                              setFiles(prev => prev.map(f => f.id === selectedId ? { ...f, dirty: true, metadata: { ...f.metadata, coverArt: null } } : f));
                            }}
                            className="text-[10px] text-red-500 hover:text-red-600 font-semibold cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      {/* Small natural aspect ratio container */}
                      <div
                        style={isDraggingCover ? { borderColor: accentColor } : {}}
                        className={`relative w-full rounded-xl border-2 transition-all cursor-pointer overflow-hidden p-2 flex items-center justify-center min-h-[130px] max-h-48 bg-zinc-50/80 dark:bg-zinc-950/40 ${
                          isDraggingCover
                            ? 'scale-[1.02] bg-zinc-100 dark:bg-zinc-800/80'
                            : editFields.coverArt
                            ? 'border-zinc-200/80 dark:border-zinc-700/60 shadow-2xs'
                            : 'border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'
                        }`}
                        onClick={() => coverInputRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); setIsDraggingCover(true); }}
                        onDragLeave={() => setIsDraggingCover(false)}
                        onDrop={handleCoverDrop}
                      >
                        {editFields.coverArt ? (
                          <div className="relative group w-full flex items-center justify-center">
                            <img
                              src={editFields.coverArt}
                              alt="Cover"
                              className="max-h-36 max-w-full rounded-lg object-contain shadow-xs"
                            />
                            <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={e => { e.stopPropagation(); coverInputRef.current?.click(); }}
                                className="p-1.5 rounded-lg bg-white/95 text-zinc-800 hover:bg-white text-[10px] font-bold shadow-xs cursor-pointer flex items-center space-x-1"
                              >
                                <ImageIcon className="w-3 h-3" />
                                <span>Change</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 space-y-1.5 py-4 text-center">
                            <div className="w-8 h-8 rounded-lg bg-zinc-200/60 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                            <p className="text-[10px] font-semibold leading-tight">
                              Add Artwork
                            </p>
                            <p className="text-[9px] text-zinc-400 dark:text-zinc-600">
                              Click or drop image
                            </p>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="mt-2.5 w-full py-1.5 rounded-xl text-[11px] font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer text-center"
                      >
                        {editFields.coverArt ? 'Replace Image' : 'Upload Image'}
                      </button>
                    </div>
                  </div>

                  {/* ── RIGHT: All Inputs Listed ── */}
                  <div className="flex-1 min-w-0 space-y-4 w-full">

                    {/* Track & Artist Info */}
                    <div className="bg-white/80 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 shadow-xs space-y-4">
                      <div className="flex items-center space-x-2 pb-2 border-b border-zinc-100 dark:border-zinc-800/60">
                        <Tag className="w-4 h-4" style={{ color: accentColor }} />
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Track & Album Information</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="sm:col-span-2">
                          <MetaInputField
                            label="Title"
                            value={editFields.title ?? ''}
                            onChange={v => handleFieldChange('title', v)}
                            placeholder="Song or track title"
                          />
                        </div>
                        <MetaInputField
                          label="Artist"
                          value={editFields.artist ?? ''}
                          onChange={v => handleFieldChange('artist', v)}
                          placeholder="Performing artist"
                        />
                        <MetaInputField
                          label="Album"
                          value={editFields.album ?? ''}
                          onChange={v => handleFieldChange('album', v)}
                          placeholder="Album name"
                        />
                        <MetaInputField
                          label="Album Artist"
                          value={editFields.albumArtist ?? ''}
                          onChange={v => handleFieldChange('albumArtist', v)}
                          placeholder="e.g. Various Artists"
                        />
                        <MetaInputField
                          label="Composer"
                          value={editFields.composer ?? ''}
                          onChange={v => handleFieldChange('composer', v)}
                          placeholder="Composer name"
                        />
                      </div>
                    </div>

                    {/* Genre & Numbers */}
                    <div className="bg-white/80 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 shadow-xs space-y-4">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block pb-2 border-b border-zinc-100 dark:border-zinc-800/60">
                        Genre & Track Organization
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        <div className="sm:col-span-3">
                          <div className="flex flex-col space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                              Genre
                            </label>
                            <CustomDropdown
                              value={editFields.genre ?? ''}
                              options={GENRE_OPTIONS}
                              onChange={v => handleFieldChange('genre', v)}
                              placeholder="Select Genre"
                              className="w-full"
                              buttonClassName="w-full bg-transparent border-b border-t-0 border-x-0 border-solid border-zinc-300/80 dark:border-zinc-700/90 hover:border-zinc-400 dark:hover:border-zinc-500 text-zinc-900 dark:text-zinc-100 text-xs py-1.5 px-0.5 rounded-none shadow-none"
                            />
                          </div>
                        </div>

                        <MetaInputField
                          label="Track #"
                          value={editFields.track ?? ''}
                          onChange={v => handleFieldChange('track', v)}
                          placeholder="e.g. 1"
                          type="number"
                        />
                        <MetaInputField
                          label="Disc #"
                          value={editFields.diskNumber ?? ''}
                          onChange={v => handleFieldChange('diskNumber', v)}
                          placeholder="e.g. 1"
                          type="number"
                        />
                        <MetaInputField
                          label="Year"
                          value={editFields.year ?? ''}
                          onChange={v => handleFieldChange('year', v)}
                          placeholder="e.g. 2024"
                          type="number"
                        />
                      </div>
                    </div>

                    {/* Comments */}
                    <div className="bg-white/80 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 shadow-xs space-y-3">
                      <div className="flex flex-col space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Comment / Notes
                        </label>
                        <textarea
                          value={editFields.comment ?? ''}
                          onChange={e => handleFieldChange('comment', e.target.value)}
                          placeholder="Notes, copyright, or comments"
                          rows={3}
                          className="w-full bg-transparent border-b border-t-0 border-x-0 border-solid border-zinc-300/80 dark:border-zinc-700/90 hover:border-zinc-400 dark:hover:border-zinc-500 focus:border-b-2 focus:border-zinc-900 dark:focus:border-cyan-400 text-zinc-900 dark:text-zinc-100 text-xs py-1.5 px-0.5 focus:outline-none transition-colors font-medium placeholder:text-zinc-400 dark:placeholder:text-zinc-600 resize-none no-scrollbar"
                        />
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
