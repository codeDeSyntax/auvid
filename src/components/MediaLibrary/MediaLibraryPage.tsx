import React, { useRef, useState } from "react";
import {
  FolderOpenOutlined,
  CloudUploadOutlined,
  HistoryOutlined,
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
  VideoCameraOutlined,
  AudioOutlined,
  ArrowRightOutlined,
  ScissorOutlined,
  CompressOutlined,
  SwapOutlined,
  TagsOutlined,
  CheckCircleFilled,
} from "@ant-design/icons";
import { useMediaContext } from "@/Provider/MediaContext";
import { useTheme } from "@/Provider/Theme";
import { MediaItem, OutputFile, MediaTool } from "@/types";
import { getAssetPath } from "@/utils/assets";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MediaLibraryPage: React.FC = () => {
  const {
    mediaList,
    outputFiles,
    setSelectedMedia,
    setActiveTool,
    addMediaFiles,
    removeMediaItem,
    clearAllMedia,
    clearOutputFiles,
  } = useMediaContext();

  const { accentColor } = useTheme();
  const [activeTab, setActiveTab] = useState<"workspace" | "recents">("workspace");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "audio" | "video">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      console.error("[Library] Failed to open storage folder:", err);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addMediaFiles(e.target.files);
      e.target.value = "";
    }
  };

  // Filtered lists
  const filteredMedia = mediaList.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || item.type === filterType;
    return matchesSearch && matchesType;
  });

  const filteredOutputs = outputFiles.filter((out) => {
    const matchesSearch = out.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || out.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50/90 dark:bg-zinc-950/95 text-zinc-900 dark:text-zinc-100 relative">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,video/*,.mp3,.wav,.flac,.aac,.m4a,.ogg,.opus,.wma,.aiff,.alac,.mp4,.mkv,.avi,.mov,.wmv,.flv,.webm,.m4v,.ts,.3gp"
        onChange={handleFileInput}
        className="hidden"
      />

      {/* ── Top Header ── */}
      <div className="px-8 pt-7 pb-4 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-1.5 border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-xs">
            <FolderOpenOutlined style={{ color: accentColor }} />
            <span style={{ color: accentColor }}>Media Library</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 leading-tight tracking-tight">
            Workspace Files &amp; Export History
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage staged files across your AUVID session and explore past exports.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5 shrink-0">
          <button
            onClick={handleOpenStorageFolder}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/60 shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <FolderOpenOutlined style={{ fontSize: "14px" }} />
            <span>Storage Folder</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <PlusOutlined style={{ fontSize: "13px", strokeWidth: 3 }} />
            <span>Upload Media</span>
          </button>
        </div>
      </div>

      {/* ── Subheader Controls (Tabs + Search + Filters) ── */}
      <div className="px-8 py-3.5 shrink-0 flex flex-col md:flex-row items-center justify-between gap-3 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/40 dark:bg-zinc-900/30">
        {/* Tab Switcher */}
        <div className="flex items-center space-x-2 p-1 rounded-2xl bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80">
          <button
            type="button"
            onClick={() => setActiveTab("workspace")}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "workspace"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <CloudUploadOutlined style={activeTab === "workspace" ? { color: accentColor } : undefined} />
            <span>Workspace Media</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-zinc-200/60 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
              {mediaList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("recents")}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "recents"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <HistoryOutlined style={activeTab === "recents" ? { color: accentColor } : undefined} />
            <span>Recent Exports</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-zinc-200/60 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
              {outputFiles.length}
            </span>
          </button>
        </div>

        {/* Right Search & Filters */}
        <div className="flex items-center space-x-3 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 md:w-64">
            <SearchOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Type Filter Pills */}
          <div className="flex items-center space-x-1 p-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            {(["all", "audio", "video"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-all cursor-pointer ${
                  filterType === t
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                    : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Clear Button */}
          {activeTab === "workspace" && mediaList.length > 0 && (
            <button
              onClick={clearAllMedia}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
            >
              <DeleteOutlined style={{ fontSize: "11px" }} />
              <span>Clear</span>
            </button>
          )}

          {activeTab === "recents" && outputFiles.length > 0 && (
            <button
              onClick={clearOutputFiles}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
            >
              <DeleteOutlined style={{ fontSize: "11px" }} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Main Tab Content ── */}
      <div className="flex-1 min-h-0 px-8 py-5 overflow-y-auto no-scrollbar">
        {activeTab === "workspace" ? (
          /* Workspace Files Tab */
          filteredMedia.length === 0 ? (
            <div className="h-full min-h-[380px] flex flex-col items-center justify-center p-8 text-center select-none rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/30">
              <div className="relative mb-3 group">
                <div
                  className="absolute inset-0 rounded-full blur-2xl opacity-25"
                  style={{ backgroundColor: accentColor }}
                />
                <img
                  src={getAssetPath("empty-trimmer.png")}
                  alt="Empty Workspace"
                  className="relative w-16 h-16 object-contain transition-transform group-hover:scale-105"
                />
              </div>
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                {searchQuery ? "No matching files found" : "Workspace Library is empty"}
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-sm leading-relaxed">
                {searchQuery
                  ? "Try adjusting your search keywords or filter settings."
                  : "Drop audio or video files anywhere in AUVID, or click the upload button to stage files for editing."}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-bold text-white shadow-md hover:brightness-105 transition-all cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  <PlusOutlined style={{ fontSize: "12px" }} />
                  <span>Upload Media Files</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredMedia.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-white dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm shrink-0"
                        style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                      >
                        {item.type === "video" ? <VideoCameraOutlined /> : <AudioOutlined />}
                      </div>
                      <div className="min-w-0">
                        <h4
                          className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate"
                          title={item.name}
                        >
                          {item.name}
                        </h4>
                        <div className="flex items-center space-x-2 text-[11px] font-mono text-zinc-400 dark:text-zinc-500 mt-0.5">
                          <span>{formatBytes(item.size)}</span>
                          {item.duration ? (
                            <>
                              <span>·</span>
                              <span>{Math.round(item.duration)}s</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded uppercase shrink-0">
                      {item.format}
                    </span>
                  </div>

                  {/* Suite Quick Action Buttons */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
                      {item.type === "audio" ? (
                        <>
                          <button
                            onClick={() => {
                              setSelectedMedia(item);
                              setActiveTool("audio-trim");
                            }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <ScissorOutlined />
                            <span>Trim</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedMedia(item);
                              setActiveTool("audio-compress");
                            }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <CompressOutlined />
                            <span>Compress</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setSelectedMedia(item);
                              setActiveTool("video-cut");
                            }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <ScissorOutlined />
                            <span>Cut</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedMedia(item);
                              setActiveTool("video-compress");
                            }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <CompressOutlined />
                            <span>Compress</span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => {
                          setSelectedMedia(item);
                          setActiveTool("converter");
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <SwapOutlined />
                        <span>Convert</span>
                      </button>
                    </div>

                    <button
                      onClick={() => removeMediaItem(item.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer shrink-0"
                      title="Remove file"
                    >
                      <DeleteOutlined style={{ fontSize: "12px" }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Recent Exports Tab */
          filteredOutputs.length === 0 ? (
            <div className="h-full min-h-[380px] flex flex-col items-center justify-center p-8 text-center select-none rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/30">
              <div className="relative mb-3 group">
                <div
                  className="absolute inset-0 rounded-full blur-2xl opacity-20"
                  style={{ backgroundColor: accentColor }}
                />
                <img
                  src={getAssetPath("empty-trimmer.png")}
                  alt="No outputs"
                  className="relative w-16 h-16 object-contain transition-transform group-hover:scale-105 opacity-80"
                />
              </div>
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                {searchQuery ? "No matching exports found" : "No recent export files"}
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-sm leading-relaxed">
                Rendered videos, trimmed audio, downloads, and compressed media will appear here.
              </p>
              <button
                onClick={handleOpenStorageFolder}
                className="mt-4 flex items-center space-x-2 px-4 py-2 rounded-2xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
              >
                <FolderOpenOutlined style={{ fontSize: "13px" }} />
                <span>Open Storage Folder</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredOutputs.map((out) => {
                const reduction =
                  out.originalSize > 0
                    ? Math.round((1 - out.size / out.originalSize) * 100)
                    : 0;

                return (
                  <div
                    key={out.id}
                    className="p-4 rounded-2xl bg-white dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm shrink-0"
                          style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                        >
                          {out.type === "video" ? <VideoCameraOutlined /> : <AudioOutlined />}
                        </div>
                        <div className="min-w-0">
                          <h4
                            className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate"
                            title={out.name}
                          >
                            {out.name}
                          </h4>
                          <div className="flex items-center space-x-2 text-[11px] font-mono text-zinc-400 dark:text-zinc-500 mt-0.5">
                            <span>{formatBytes(out.size)}</span>
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

                      <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded uppercase shrink-0">
                        {out.format}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircleFilled className="text-xs" />
                        <span>Completed</span>
                      </div>

                      <button
                        onClick={() => {
                          window.ipcRenderer?.invoke("shell:reveal-file", out.savedPath);
                        }}
                        className="px-3 py-1 rounded-lg text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center space-x-1.5 cursor-pointer"
                        title={out.savedPath}
                      >
                        <FolderOpenOutlined style={{ fontSize: "11px" }} />
                        <span>Reveal File</span>
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
  );
};
