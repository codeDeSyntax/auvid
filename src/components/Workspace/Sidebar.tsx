import React, { useRef } from "react";
import {
  AppstoreOutlined,
  CloudDownloadOutlined,
  CompressOutlined,
  CustomerServiceOutlined,
  ScissorOutlined,
  AudioOutlined,
  VideoCameraOutlined,
  SwapOutlined,
  AudioFilled,
  TagsOutlined,
  SettingOutlined,
  PlusOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";
import { useTheme } from "@/Provider/Theme";
import { useMediaContext } from "@/Provider/MediaContext";
import { useJobStore } from "@/Provider/JobStore";
import { MediaTool } from "@/types";

interface NavItem {
  id: MediaTool;
  label: string;
  icon: React.ReactNode;
}

const primaryNav: NavItem[] = [
  { id: "dashboard", label: "Studio", icon: <AppstoreOutlined /> },
  { id: "files", label: "Workspace Files", icon: <FolderOpenOutlined /> },
  { id: "downloader", label: "Media Downloader", icon: <CloudDownloadOutlined /> },
  { id: "audio-compress", label: "Audio Compressor", icon: <CustomerServiceOutlined /> },
  { id: "video-compress", label: "Video Compressor", icon: <CompressOutlined /> },
  { id: "audio-trim", label: "Audio Trimmer", icon: <ScissorOutlined /> },
  { id: "video-cut", label: "Video Editor", icon: <VideoCameraOutlined /> },
  { id: "converter", label: "Format Converter", icon: <SwapOutlined /> },
  { id: "recorder", label: "Sound Recorder", icon: <AudioFilled /> },
  { id: "metadata", label: "Metadata Editor", icon: <TagsOutlined /> },
];

const bottomNav: NavItem[] = [
  { id: "settings", label: "Settings", icon: <SettingOutlined /> },
];

export const Sidebar: React.FC = () => {
  const { accentColor } = useTheme();
  const { activeTool, setActiveTool, addMediaFiles } = useMediaContext();
  const { getJob } = useJobStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleQuickAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    addMediaFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const NavBtn: React.FC<NavItem> = ({ id, label, icon }) => {
    const isActive = activeTool === id;
    const job = getJob(id);
    const hasActiveJob = job?.status === 'processing';
    const hasError = job?.status === 'error';

    return (
      <div className="relative group flex items-center justify-center">
        <button
          onClick={() => setActiveTool(id)}
          className={`
            w-10 h-10 rounded-xl flex items-center justify-center text-[18px]
            transition-all duration-150 cursor-pointer relative
            ${isActive
              ? "bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 shadow-sm"
              : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50"}
          `}
          style={isActive ? { color: accentColor } : undefined}
          aria-label={label}
        >
          {/* Active indicator bar */}
          {isActive && (
            <span
              className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
              style={{ backgroundColor: accentColor }}
            />
          )}
          {icon}

          {/* Job activity badge — pulsing ring when a background job is running */}
          {(hasActiveJob || hasError) && !isActive && (
            <span
              className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-950 ${
                hasError
                  ? 'bg-red-500'
                  : 'animate-pulse'
              }`}
              style={hasActiveJob ? { backgroundColor: accentColor } : undefined}
              title={hasError ? 'Job failed' : `${Math.round(job?.progress ?? 0)}% complete`}
            />
          )}

          {/* Progress arc overlay on the button when active tool has a running job */}
          {hasActiveJob && isActive && (
            <span
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                boxShadow: `0 0 0 2px ${accentColor}55`,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          )}
        </button>

        {/* Hover Tooltip Bubble — also shows job progress */}
        <div
          className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 z-[9999]
                     w-max min-w-max inline-flex items-center gap-2
                     bg-zinc-900 dark:bg-zinc-800 text-white text-xs font-bold
                     px-3.5 py-1.5 rounded-xl shadow-2xl pointer-events-none select-none
                     opacity-0 group-hover:opacity-100 whitespace-nowrap
                     border border-zinc-700/80 dark:border-zinc-600/80
                     transition-all duration-150 transform scale-95 group-hover:scale-100 origin-left"
          style={{ width: "max-content", minWidth: "max-content" }}
        >
          <span>{label}</span>
          {hasActiveJob && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${accentColor}33`, color: accentColor }}
            >
              {Math.round(job?.progress ?? 0)}%
            </span>
          )}
          {hasError && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
              Failed
            </span>
          )}
          {/* Small left arrow */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-900 dark:border-r-zinc-800" />
        </div>
      </div>
    );
  };

  return (
    <aside
      className="w-[64px] flex flex-col items-center pt-3 pb-4
                 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100
                 shrink-0 transition-colors duration-200 select-none no-scrollbar
                 relative z-30 overflow-visible"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleQuickAdd}
        multiple
        accept="audio/*,video/*"
        className="hidden"
      />

      {/* Quick Add Button */}
      <div className="relative group mb-3 flex items-center justify-center">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold
                     bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black
                     shadow-md hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer"
          aria-label="Import Media Files"
        >
          <PlusOutlined style={{ fontSize: "16px", strokeWidth: 4 }} />
        </button>
        <div
          className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 z-[9999]
                     w-max min-w-max inline-flex items-center
                     bg-zinc-900 dark:bg-zinc-800 text-white text-xs font-bold
                     px-3.5 py-1.5 rounded-xl shadow-2xl pointer-events-none select-none
                     opacity-0 group-hover:opacity-100 whitespace-nowrap
                     border border-zinc-700/80 dark:border-zinc-600/80
                     transition-all duration-150 transform scale-95 group-hover:scale-100 origin-left"
          style={{ width: "max-content", minWidth: "max-content" }}
        >
          <span>Import Media Files</span>
          {/* Small left arrow */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-900 dark:border-r-zinc-800" />
        </div>
      </div>

      <div className="w-8 h-px bg-zinc-200/80 dark:border-zinc-800/80 mb-2" />

      {/* Primary nav */}
      <div className="flex flex-col items-center space-y-1.5 flex-1">
        {primaryNav.map((item) => (
          <NavBtn key={item.id} {...item} />
        ))}
      </div>

      {/* Bottom nav */}
      <div className="flex flex-col items-center space-y-1.5">
        {bottomNav.map((item) => (
          <NavBtn key={item.id} {...item} />
        ))}
      </div>
    </aside>
  );
};
