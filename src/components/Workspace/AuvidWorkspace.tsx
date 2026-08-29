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
import { MediaLibraryPage } from "@/components/MediaLibrary/MediaLibraryPage";
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
  tags?: string[];
}

const TOOLS: ToolCard[] = [
  {
    key: "downloader",
    title: "Media Downloader",
    subtitle: "Extract 4K/1080p video, studio audio, and subtitles from YouTube, TikTok, X, and 1000+ sites",
    imageLight: getAssetPath("cards/light/format-converter.jpg"),
    imageDark: getAssetPath("cards/dark/format-converter.jpg"),
    badge: "New",
    tags: ["4K Video", "MP3 Audio", "1000+ Sites"],
  },
  {
    key: "audio-compress",
    title: "Audio Compressor",
    subtitle: "Shrink audio files while preserving fidelity — MP3, WAV, FLAC, AAC, OPUS",
    imageLight: getAssetPath("cards/light/audio-compressor.jpg"),
    imageDark: getAssetPath("cards/dark/audio-compressor.jpg"),
    badge: "Ready",
    tags: ["Lossless", "Batch Queue", "Hi-Fi"],
  },
  {
    key: "video-compress",
    title: "Video Compressor",
    subtitle: "Compress MP4, MKV, MOV — dynamic bitrate scaling, resolution control, and hardware accel",
    imageLight: getAssetPath("cards/light/video-compressor.jpg"),
    imageDark: getAssetPath("cards/dark/video-compressor.jpg"),
    tags: ["H.264 / HEVC", "Smart Resize", "Fast Encode"],
  },
  {
    key: "audio-trim",
    title: "Audio Trimmer & Editor",
    subtitle: "Lossless waveform cut, fade in/out curves, gain normalization, and multi-region export",
    imageLight: getAssetPath("cards/light/audio-trim.jpg"),
    imageDark: getAssetPath("cards/dark/audio-trim.jpg"),
    tags: ["Waveform Zoom", "Fade Curves", "Precise Cut"],
  },
  {
    key: "video-cut",
    title: "Video Editor & Cutter",
    subtitle: "Instant scene splitting, lossless stream cutting, crop canvas, and audio extraction",
    imageLight: getAssetPath("cards/light/video-editor.jpg"),
    imageDark: getAssetPath("cards/dark/video-editor.jpg"),
    tags: ["Frame Preview", "Lossless Split", "Multi-Track"],
  },
  {
    key: "converter",
    title: "Format Converter",
    subtitle: "Universal converter for any video or audio codec, extract soundtracks, and animated GIFs",
    imageLight: getAssetPath("cards/light/format-converter.jpg"),
    imageDark: getAssetPath("cards/dark/format-converter.jpg"),
    tags: ["50+ Formats", "GIF Generator", "Stream Copy"],
  },
  {
    key: "metadata",
    title: "Metadata Editor",
    subtitle: "Inspect & edit ID3 tags, embedded album artwork, release years, and media properties in bulk",
    imageLight: getAssetPath("cards/light/metadata-editor.jpg"),
    imageDark: getAssetPath("cards/dark/metadata-editor.jpg"),
    tags: ["ID3v2.4", "Cover Art", "Bulk Tagging"],
  },
  {
    key: "recorder",
    title: "Sound Recorder",
    subtitle: "High-efficiency voice notes (~20 KB per 10s), live sound waveform, noise gate, and timers",
    imageLight: getAssetPath("cards/light/sound-recorder.jpg"),
    imageDark: getAssetPath("cards/dark/sound-recorder.jpg"),
    tags: ["Live Visualizer", "Compact Audio", "Direct Export"],
  },
];

export const AuvidWorkspace: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    addMediaFiles,
  } = useMediaContext();

  const { accentColor, isDarkMode } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  /* ─────────────────────────── Drag-and-Drop ─────────────────────────── */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) {
      addMediaFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addMediaFiles(e.target.files);
      e.target.value = "";
    }
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
  const Dashboard = (
    <div className="flex-1 flex flex-col overflow-hidden no-scrollbar relative">
      {/* Top greeting banner with upload button & storage folder in header area */}
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 pb-2 sm:pb-3 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 relative z-10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mb-1 border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-xs">
            <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
            <span style={{ color: accentColor }}>AUVID Studio</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 leading-tight tracking-tight">
            Audio &amp; Video Workstation
          </h1>
          <p className="text-[11px] sm:text-xs md:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-xl">
            Choose a specialized studio suite below to start editing, compressing, or converting.
          </p>
        </div>

        {/* Action Buttons in header area */}
        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={() => setActiveTool("files")}
            title="Open Workspace Files & Recents"
            className="flex items-center space-x-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/60 shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <FolderOpenOutlined style={{ fontSize: "13px" }} />
            <span>Media Library</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <PlusOutlined style={{ fontSize: "12px", strokeWidth: 3 }} />
            <span>Upload Media</span>
          </button>
        </div>
      </div>

      {/* ── Studio Suites Grid (Fully Responsive Layout) ── */}
      <div className="flex-1 min-h-0 px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 flex flex-col gap-2.5 sm:gap-3.5 overflow-hidden relative z-10">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Studio Suites ({TOOLS.length} Available)
          </h2>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-2">
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-4.5 h-full auto-rows-fr">
            {TOOLS.map((tool) => (
              <button
                key={tool.key}
                onClick={() => setActiveTool(tool.key)}
                className="group relative p-3 sm:p-4 md:p-4.5 rounded-2xl sm:rounded-3xl
                           bg-white/90 dark:bg-zinc-800/40 backdrop-blur-xl
                           border border-zinc-200/80 dark:border-zinc-700/60
                           hover:border-cyan-400/60 dark:hover:border-cyan-500/50
                           shadow-xs hover:shadow-xl hover:shadow-cyan-500/5
                           transition-all duration-300 hover:-translate-y-0.5
                           text-left cursor-pointer flex flex-row items-center gap-3 sm:gap-4 md:gap-5 w-full overflow-hidden"
              >
                {/* Left Inset Fixed Thumbnail Frame with Padding from Card Edges */}
                <div className="w-20 h-16 sm:w-28 sm:h-20 md:w-36 md:h-24 shrink-0 rounded-xl sm:rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800/80 relative border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center shadow-xs">
                  <img
                    src={isDarkMode ? tool.imageDark : tool.imageLight}
                    alt={tool.title}
                    className="w-full h-full object-cover rounded-xl sm:rounded-2xl group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Badge */}
                  {tool.badge && (
                    <span
                      className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 text-[8px] sm:text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-xs text-black uppercase tracking-wider"
                      style={{ backgroundColor: accentColor }}
                    >
                      {tool.badge}
                    </span>
                  )}
                </div>

                {/* Right Content Area (Strict overflow prevention) */}
                <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center py-0.5">
                  <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                    <h3 className="text-xs sm:text-sm md:text-base font-black text-zinc-900 dark:text-zinc-50 tracking-tight group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors truncate">
                      {tool.title}
                    </h3>
                    <ArrowRightOutlined
                      className="text-[9px] sm:text-[10px] opacity-0 group-hover:opacity-100 transition-all transform -translate-x-1 group-hover:translate-x-0 shrink-0"
                      style={{ color: accentColor }}
                    />
                  </div>

                  <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 sm:mt-1 leading-snug line-clamp-2">
                    {tool.subtitle}
                  </p>

                  {/* Feature Tags / Highlights */}
                  {tool.tags && tool.tags.length > 0 && (
                    <div className="hidden sm:flex items-center gap-1.5 mt-1.5 sm:mt-2 overflow-hidden flex-nowrap">
                      {tool.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-zinc-100/90 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/40 shrink-0 truncate max-w-[110px]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  /* ─────────────────────────── Active Tool Renderer ─────────────────────────── */
  const renderActiveTool = () => {
    switch (activeTool) {
      case "files":
        return <MediaLibraryPage />;
      case "downloader":
        return <MediaDownloader />;
      case "audio-compress":
        return <AudioCompressor />;
      case "video-compress":
        return <VideoCompressor />;
      case "audio-trim":
        return <AudioTrimmer />;
      case "video-cut":
        return <VideoEditor />;
      case "converter":
        return <FormatConverter />;
      case "metadata":
        return <MetadataEditor />;
      case "recorder":
        return <SoundRecorder />;
      case "settings":
        return <SettingsPage />;
      default:
        return Dashboard;
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex-1 flex flex-col bg-zinc-50/90 dark:bg-zinc-950/95 text-zinc-900 dark:text-zinc-100 rounded-tl-3xl border-t border-l border-zinc-200/80 dark:border-zinc-800/80 shadow-xs overflow-hidden select-none"
    >
      {/* Hidden file picker input for Dashboard Upload Media button */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,video/*,.mp3,.wav,.flac,.aac,.m4a,.ogg,.opus,.wma,.aiff,.alac,.mp4,.mkv,.avi,.mov,.wmv,.flv,.webm,.m4v,.ts,.3gp"
        onChange={handleFileInput}
        className="hidden"
      />

      {/* Global Drag-and-Drop Overlay with Ambient Glow */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 dark:bg-zinc-950/85 backdrop-blur-md border-2 border-dashed transition-all duration-300 animate-in fade-in"
             style={{ borderColor: accentColor }}>
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl mb-4 animate-bounce"
               style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
            <CloudUploadOutlined style={{ fontSize: "40px" }} />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">
            Drop Media Files Here
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm text-center">
            Files will be imported instantly and ready for trimming, conversion, or compression.
          </p>
        </div>
      )}

      {/* ── Top-Left Ambient Accent Glow Spotlight (Shows for all tools except Media Downloader) ── */}
      {activeTool !== "downloader" && (
        <div
          className="pointer-events-none absolute -top-24 -left-20 w-[550px] h-[420px] rounded-full blur-3xl opacity-25 dark:opacity-30 transition-all duration-700 select-none z-0"
          style={{
            background: `radial-gradient(ellipse at center, ${accentColor} 0%, transparent 75%)`,
          }}
        />
      )}

      {/* Main Tool Content with Floating Job Manager Mounted */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {renderActiveTool()}
        <FloatingJobManager />
      </div>
    </div>
  );
};
