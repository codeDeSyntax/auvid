import React, { useRef, useState } from "react";
import {
  AudioOutlined,
  VideoCameraOutlined,
  SwapOutlined,
  AudioFilled,
  PlusOutlined,
  ScissorOutlined,
  DeleteOutlined,
  CompressOutlined,
  TagsOutlined,
  ArrowRightOutlined,
  FolderOpenOutlined,
  CloudUploadOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { useMediaContext } from "@/Provider/MediaContext";
import { useTheme } from "@/Provider/Theme";
import { MediaItem, MediaTool } from "@/types";
import { AudioCompressor } from "@/Compressor/AudioCompressor";
import { SettingsPage } from "@/components/Settings/SettingsPage";
import { MetadataEditor } from "@/components/MetadataEditor/MetadataEditor";
import { AudioTrimmer } from "@/components/AudioTrimmer/AudioTrimmer";
import { VideoEditor } from "@/components/VideoEditor/VideoEditor";
import { VideoCompressor } from "@/components/VideoCompressor/VideoCompressor";
import { FormatConverter } from "@/components/FormatConverter/FormatConverter";
import { SoundRecorder } from "@/components/SoundRecorder/SoundRecorder";
import { MediaDownloader } from "@/components/MediaDownloader/MediaDownloader";
import { FloatingJobManager } from "@/components/FloatingJob/FloatingJobManager";
import { getAssetPath } from "@/utils/assets";

/* ─────────────────────────── Tool card data ─────────────────────────── */
interface ToolCard {
  key: MediaTool;
  title: string;
  subtitle: string;
  imageLight: string;
  imageDark: string;
  badge?: string;
}

const TOOLS: ToolCard[] = [
  {
    key: "downloader",
    title: "Media Downloader",
    subtitle: "Download 4K, 1080p video and studio audio from YouTube, TikTok, X, 1000+ sites",
    imageLight: getAssetPath("cards/light/format-converter.jpg"),
    imageDark: getAssetPath("cards/dark/format-converter.jpg"),
    badge: "New",
  },
  {
    key: "audio-compress",
    title: "Audio Compressor",
    subtitle: "Reduce file size while preserving quality — MP3, WAV, FLAC, AAC",
    imageLight: getAssetPath("cards/light/audio-compressor.jpg"),
    imageDark: getAssetPath("cards/dark/audio-compressor.jpg"),
    badge: "Ready",
  },
  {
    key: "video-compress",
    title: "Video Compressor",
    subtitle: "Compress MP4, MKV, MOV — resize, re-encode, and shrink to kilobytes",
    imageLight: getAssetPath("cards/light/video-compressor.jpg"),
    imageDark: getAssetPath("cards/dark/video-compressor.jpg"),
  },
  {
    key: "audio-trim",
    title: "Audio Trimmer & Editor",
    subtitle: "Cut clips, fade in/out, normalize gain — with waveform preview",
    imageLight: getAssetPath("cards/light/audio-trim.jpg"),
    imageDark: getAssetPath("cards/dark/audio-trim.jpg"),
  },
  {
    key: "video-cut",
    title: "Video Editor & Cutter",
    subtitle: "Lossless cut, scene split, audio stream extraction",
    imageLight: getAssetPath("cards/light/video-editor.jpg"),
    imageDark: getAssetPath("cards/dark/video-editor.jpg"),
  },
  {
    key: "converter",
    title: "Format Converter",
    subtitle: "Convert between any audio & video formats, extract audio, create GIFs",
    imageLight: getAssetPath("cards/light/format-converter.jpg"),
    imageDark: getAssetPath("cards/dark/format-converter.jpg"),
  },
  {
    key: "metadata",
    title: "Metadata Editor",
    subtitle: "Edit ID3 tags, artwork, and media properties in bulk",
    imageLight: getAssetPath("cards/light/metadata-editor.jpg"),
    imageDark: getAssetPath("cards/dark/metadata-editor.jpg"),
  },
  {
    key: "recorder",
    title: "Sound Recorder",
    subtitle: "Capture high-efficiency voice notes (~20 KB per 10s), live waveform & timers",
    imageLight: getAssetPath("cards/light/sound-recorder.jpg"),
    imageDark: getAssetPath("cards/dark/sound-recorder.jpg"),
  },
];

/* ───────────────────────── Placeholder panel ────────────────────────── */
const PlaceholderPanel: React.FC<{
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  description: string;
  accentColor: string;
  onSelect?: () => void;
  actionLabel?: string;
}> = ({ title, subtitle, description, accentColor, onSelect, actionLabel }) => (
  <div className="flex-1 flex flex-col overflow-hidden no-scrollbar">
    {/* Top Header matching Homepage */}
    <div className="px-8 pt-7 pb-4 shrink-0 flex items-start justify-between gap-4">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2 border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-xs">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
          <span style={{ color: accentColor }}>AUVID Studio</span>
        </div>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 leading-tight tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
          {subtitle ?? description}
        </p>
      </div>

      {onSelect && (
        <button
          onClick={onSelect}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer shrink-0 mt-1"
        >
          <PlusOutlined style={{ fontSize: "14px", strokeWidth: 3 }} />
          <span>{actionLabel ?? "Import File"}</span>
        </button>
      )}
    </div>

    {/* Center Workspace Canvas */}
    <div className="flex-1 px-8 pb-8 flex flex-col overflow-hidden">
      <div className="flex-1 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800/60 rounded-3xl flex flex-col items-center justify-center text-center p-10 shadow-xs select-none">
        <div className="relative mb-3 group">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-25 dark:opacity-30 transition-all group-hover:opacity-40"
            style={{ backgroundColor: accentColor }}
          />
          <img
            src={getAssetPath("empty-trimmer.png")}
            alt={title}
            className="relative w-44 h-44 object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-xl"
          />
        </div>
        <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 mb-1.5 tracking-tight">{title}</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md leading-relaxed">{description}</p>
        {onSelect && (
          <button
            onClick={onSelect}
            className="mt-6 px-6 py-2.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black shadow-md transition-transform active:scale-95 cursor-pointer flex items-center space-x-2"
          >
            <PlusOutlined />
            <span>{actionLabel ?? "Select File"}</span>
          </button>
        )}
      </div>
    </div>
  </div>
);

/* ════════════════════════════ MAIN COMPONENT ════════════════════════════ */
export const AuvidWorkspace: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    mediaList,
    selectedMedia,
    setSelectedMedia,
    addMediaFiles,
    removeMediaItem,
    clearAllMedia,
    outputFiles,
    clearOutputFiles,
  } = useMediaContext();
  const { accentColor, isDarkMode } = useTheme();

  const [bottomTab, setBottomTab] = useState<'media' | 'recents'>('media');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    addMediaFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleOpenStorageFolder = async () => {
    try {
      const customBase = localStorage.getItem("auvid_custom_base_output_dir");
      const customAudio = localStorage.getItem("auvid_custom_audio_output_dir");

      if (customAudio) {
        window.ipcRenderer?.invoke("shell:open-folder", customAudio);
        return;
      }
      if (customBase) {
        window.ipcRenderer?.invoke("shell:open-folder", customBase);
        return;
      }

      const dirs = (await window.ipcRenderer?.invoke("app:get-default-output-dirs")) as {
        baseDir: string;
        audioDir: string;
        videoDir: string;
      } | null;

      const target = dirs?.audioDir || dirs?.baseDir;
      if (target) {
        window.ipcRenderer?.invoke("shell:open-folder", target);
      }
    } catch (err) {
      console.error("[Home] Failed to open storage folder:", err);
    }
  };

  /* ─────────────────────────── Dashboard ─────────────────────────── */
  // Recents now show the last 5 *output* files (saved/completed), not input files
  const recentOutputs = outputFiles.slice(0, 5);

  const Dashboard = (
    <div className="flex-1 flex flex-col overflow-hidden no-scrollbar">
      {/* Top greeting banner with upload button & storage folder in header area */}
      <div className="px-8 pt-7 pb-3 shrink-0 flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2 border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-xs">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
            <span style={{ color: accentColor }}>AUVID Studio</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 leading-tight tracking-tight">
            Audio &amp; Video Workstation
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
            Choose a suite below to start processing, or upload media files to begin.
          </p>
        </div>

        {/* Action Buttons in header area */}
        <div className="flex items-center space-x-2.5 shrink-0 mt-1">
          <button
            onClick={handleOpenStorageFolder}
            title="Open AUVID Output Storage Folder in File Explorer"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/60 shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <FolderOpenOutlined style={{ fontSize: "15px" }} />
            <span>Output Folder</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <PlusOutlined style={{ fontSize: "14px", strokeWidth: 3 }} />
            <span>Upload Media</span>
          </button>
        </div>
      </div>

      {/* Popular suites section title */}
      <div className="px-8 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-200 tracking-wide">
            Popular Features
          </h2>
          <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
            {TOOLS.length} suites available
          </span>
        </div>
      </div>

      {/* Horizontal card scroll with NO-SCROLLBAR */}
      <div className="px-8 pb-3 overflow-x-auto no-scrollbar shrink-0">
        <div className="flex space-x-4 pb-1" style={{ minWidth: "max-content" }}>
          {TOOLS.map((tool) => (
            <button
              key={tool.key}
              onClick={() => setActiveTool(tool.key)}
              className="group relative shrink-0 w-60 p-2.5 rounded-2xl
                         bg-white/95 dark:bg-zinc-800/50 backdrop-blur-sm
                         border border-zinc-200/80 dark:border-zinc-800/70
                         shadow-sm hover:shadow-xl hover:border-zinc-300 dark:hover:border-zinc-700
                         transition-all duration-200 hover:-translate-y-1
                         text-left cursor-pointer flex flex-col"
            >
              {/* Inset Card image with matching rounded corners & spacing */}
              <div className="h-32 w-full rounded-xl overflow-hidden bg-white dark:bg-zinc-800/40 relative border border-zinc-100/80 dark:border-zinc-800/50">
                <img
                  src={isDarkMode ? tool.imageDark : tool.imageLight}
                  alt={tool.title}
                  className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
                />

                {/* Badge */}
                {tool.badge && (
                  <span
                    className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm text-black"
                    style={{ backgroundColor: accentColor }}
                  >
                    {tool.badge}
                  </span>
                )}
              </div>

              {/* Card body */}
              <div className="px-1 pt-2.5 pb-0.5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                    {tool.title}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-2">
                    {tool.subtitle}
                  </p>
                </div>

                {/* Open arrow */}
                <div
                  className="mt-2.5 flex items-center space-x-1 text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-all transform translate-x-0 group-hover:translate-x-1"
                  style={{ color: accentColor }}
                >
                  <span>Launch Tool</span>
                  <ArrowRightOutlined style={{ fontSize: "10px" }} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Bottom Section: Tabbed List View (Uploaded Media / Recent Outputs) ── */}
      <div className="flex-1 min-h-0 px-8 pb-4 overflow-hidden">
        <div className="bg-white/95 dark:bg-zinc-800/50 backdrop-blur-md border border-zinc-200/90 dark:border-zinc-800/80 rounded-t-3xl h-full min-h-0 overflow-hidden shadow-xs flex flex-col">
          {/* ── Tab Header Bar ── */}
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-zinc-100 dark:border-zinc-800/70 shrink-0">
            {/* Tabs Switcher */}
            <div className="flex items-center space-x-1.5 p-0.5 bg-zinc-100/80 dark:bg-zinc-900/60 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
              <button
                type="button"
                onClick={() => setBottomTab('media')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  bottomTab === 'media'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <CloudUploadOutlined style={bottomTab === 'media' ? { color: accentColor } : undefined} />
                <span>Uploaded Media</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    bottomTab === 'media'
                      ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                      : 'bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500'
                  }`}
                >
                  {mediaList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setBottomTab('recents')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  bottomTab === 'recents'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <HistoryOutlined style={bottomTab === 'recents' ? { color: accentColor } : undefined} />
                <span>Recent Outputs</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    bottomTab === 'recents'
                      ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                      : 'bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500'
                  }`}
                >
                  {recentOutputs.length}
                </span>
              </button>
            </div>

            {/* Context Actions based on active tab */}
            <div className="flex items-center space-x-2">
              {bottomTab === 'media' ? (
                <>
                  {mediaList.length > 0 && (
                    <button
                      onClick={clearAllMedia}
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                    >
                      <DeleteOutlined style={{ fontSize: '11px' }} />
                      <span>Clear</span>
                    </button>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black shadow-xs transition-transform active:scale-95 cursor-pointer"
                  >
                    <PlusOutlined style={{ fontSize: '11px' }} />
                    <span>Add File</span>
                  </button>
                </>
              ) : (
                <>
                  {recentOutputs.length > 0 && (
                    <button
                      onClick={clearOutputFiles}
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                    >
                      <DeleteOutlined style={{ fontSize: '11px' }} />
                      <span>Clear</span>
                    </button>
                  )}
                  <button
                    onClick={handleOpenStorageFolder}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/60 transition-colors cursor-pointer"
                  >
                    <FolderOpenOutlined style={{ fontSize: '12px' }} />
                    <span>Open Folder</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Tab Content: Single View at a time ── */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {bottomTab === 'media' ? (
              /* Uploaded Media View */
              mediaList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none">
                  <div className="relative mb-2 group">
                    <div
                      className="absolute inset-0 rounded-full blur-xl opacity-20"
                      style={{ backgroundColor: accentColor }}
                    />
                    <img
                      src={getAssetPath("empty-trimmer.png")}
                      alt="Empty Workspace"
                      className="relative w-12 h-12 object-contain transition-transform group-hover:scale-105"
                    />
                  </div>
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Workspace is empty
                  </p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 max-w-xs leading-relaxed">
                    Drop audio or video files anywhere, or click Add File to begin.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
                  {mediaList.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-5 py-2.5 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/20 transition-colors group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0"
                          style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                        >
                          {item.type === 'video' ? <VideoCameraOutlined /> : <AudioOutlined />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span
                              className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[220px] sm:max-w-[380px] md:max-w-[500px]"
                              title={item.name}
                            >
                              {item.name}
                            </span>
                            <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded uppercase">
                              {item.format}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                            {formatSize(item.size)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedMedia(item);
                            setActiveTool(item.type === 'video' ? 'video-cut' : 'audio-compress');
                          }}
                          className="px-3 py-1 rounded-lg text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                        >
                          Open Tool
                        </button>
                        <button
                          onClick={() => removeMediaItem(item.id)}
                          className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                          title="Remove file"
                        >
                          <DeleteOutlined style={{ fontSize: '12px' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Recent Outputs View */
              recentOutputs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none">
                  <div className="relative mb-2 group">
                    <div
                      className="absolute inset-0 rounded-full blur-xl opacity-15"
                      style={{ backgroundColor: accentColor }}
                    />
                    <img
                      src={getAssetPath("empty-trimmer.png")}
                      alt="No outputs"
                      className="relative w-12 h-12 object-contain transition-transform group-hover:scale-105 opacity-80"
                    />
                  </div>
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    No recent output files
                  </p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 max-w-xs leading-relaxed">
                    Compressed or edited exports will automatically be listed here.
                  </p>
                  <button
                    onClick={handleOpenStorageFolder}
                    className="mt-3.5 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-700/60 transition-colors cursor-pointer"
                  >
                    <FolderOpenOutlined style={{ fontSize: '12px' }} />
                    <span>Open Storage Folder</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
                  {recentOutputs.map((out) => {
                    const reduction =
                      out.originalSize > 0 ? Math.round((1 - out.size / out.originalSize) * 100) : 0;
                    return (
                      <div
                        key={out.id}
                        className="flex items-center justify-between px-5 py-2.5 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/20 transition-colors"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0"
                            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                          >
                            {out.type === 'video' ? <VideoCameraOutlined /> : <AudioOutlined />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span
                                className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[220px] sm:max-w-[380px] md:max-w-[500px]"
                                title={out.name}
                              >
                                {out.name}
                              </span>
                              <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded uppercase">
                                {out.format}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 flex items-center space-x-1.5">
                              <span>{formatSize(out.size)}</span>
                              {reduction > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    -{reduction}%
                                  </span>
                                </>
                              )}
                              <span>·</span>
                              <span>{out.savedAt}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            onClick={() => {
                              window.ipcRenderer?.invoke('shell:reveal-file', out.savedPath);
                            }}
                            className="px-3 py-1 rounded-lg text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center space-x-1 cursor-pointer"
                            title={out.savedPath}
                          >
                            <FolderOpenOutlined style={{ fontSize: '11px' }} />
                            <span>Show</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );

  /* ─────────────────────────── Render ─────────────────────────── */
  return (
    <div className="relative flex-1 flex flex-col bg-zinc-50/90 dark:bg-zinc-950/95 text-zinc-900 dark:text-zinc-100 rounded-tl-3xl border-t border-l border-zinc-200/80 dark:border-zinc-800/70 overflow-hidden transition-colors duration-200 shadow-xs">
      {/* ── Soft ambient glow bloom on top-left corner ── */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-25 dark:opacity-20 transition-all duration-700 select-none z-0"
        style={{
          background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
        }}
      />

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        multiple
        accept="audio/*,video/*"
        className="hidden"
      />

      <div className="relative z-10 flex-1 flex flex-col overflow-hidden no-scrollbar">
        {/* Dashboard — shown conditionally (no persistent state needed) */}
        {activeTool === "dashboard" && Dashboard}

        {/* ── Persistently Mounted Tool Panels ─────────────────────────────── */}
        {/* Each tool stays mounted in the DOM at all times; only display     */}
        {/* is toggled. This preserves waveform caches, in-progress exports,  */}
        {/* recording sessions, and all local React state across tab switches. */}

        <div style={{ display: activeTool === "downloader" ? "flex" : "none" }} className="flex-1 flex flex-col overflow-hidden">
          <MediaDownloader />
        </div>

        <div style={{ display: activeTool === "audio-compress" ? "flex" : "none" }} className="flex-1 flex flex-col overflow-hidden">
          <AudioCompressor />
        </div>

        <div style={{ display: activeTool === "video-compress" ? "flex" : "none" }} className="flex-1 flex flex-col overflow-hidden">
          <VideoCompressor />
        </div>

        <div style={{ display: activeTool === "audio-trim" ? "flex" : "none" }} className="flex-1 flex flex-col overflow-hidden">
          <AudioTrimmer />
        </div>

        <div style={{ display: activeTool === "video-cut" ? "flex" : "none" }} className="flex-1 flex flex-col overflow-hidden">
          <VideoEditor />
        </div>

        <div style={{ display: activeTool === "converter" ? "flex" : "none" }} className="flex-1 flex flex-col overflow-hidden">
          <FormatConverter />
        </div>

        <div style={{ display: activeTool === "metadata" ? "flex" : "none" }} className="flex-1 flex flex-col overflow-hidden">
          <MetadataEditor />
        </div>

        <div style={{ display: activeTool === "recorder" ? "flex" : "none" }} className="flex-1 flex flex-col overflow-hidden">
          <SoundRecorder />
        </div>

        <div style={{ display: activeTool === "settings" ? "flex" : "none" }} className="flex-1 flex flex-col overflow-hidden">
          <SettingsPage />
        </div>
      </div>

      {/* Floating Background Task Indicators (bottom-right on other tabs) */}
      <FloatingJobManager />

    </div>
  );
};
